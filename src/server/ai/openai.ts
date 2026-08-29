import { z } from "zod";

/* ---------------------------------------------------------------------------
 * OpenAI transport.
 *
 * One job: send a prompt, get back an object that satisfies a Zod schema, or
 * throw. Everything about *what* to ask lives in the callers; this file knows
 * only how to ask it safely.
 *
 * Structured outputs, never free text. DPR §7 forbids storing a free-form
 * response as canonical profile data, and a model asked for prose will happily
 * invent a follower count in the middle of a sentence. A schema the API itself
 * enforces is the difference between a classification and a rumour.
 * ------------------------------------------------------------------------ */

const API = "https://api.openai.com/v1/chat/completions";

/** Bumped when the request shape changes in a way that alters outputs. */
export const OPENAI_PROMPT_VERSION = "1.0.0";

export class AiUnavailable extends Error {
  constructor(
    readonly reason: "credentials_missing" | "rate_limited" | "refused" | "upstream_error",
    message: string,
  ) {
    super(message);
    this.name = "AiUnavailable";
  }
}

export function openAiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-5.1";
}

/** Null rather than throwing, so provider health can be reported without a try/catch. */
export function openAiKey(): string | null {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

function requireKey(): string {
  const key = openAiKey();
  if (!key) {
    throw new AiUnavailable(
      "credentials_missing",
      "OPENAI_API_KEY is not set. AI enrichment cannot run.",
    );
  }
  return key;
}

const ErrorEnvelope = z.object({
  error: z.object({ message: z.string(), type: z.string().nullish(), code: z.string().nullish() }),
});

const Completion = z.object({
  model: z.string(),
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullish(),
        message: z.object({ content: z.string().nullable(), refusal: z.string().nullish() }),
      }),
    )
    .min(1),
  usage: z.object({ total_tokens: z.number() }).nullish(),
});

export interface AiCall<T> {
  value: T;
  model: string;
  promptVersion: string;
  totalTokens: number | null;
}

/**
 * Asks for one object matching `schema`.
 *
 * `strict` mode makes the API itself refuse to emit anything off-schema, and
 * the response is parsed through Zod afterwards anyway — the model is not
 * trusted to have honoured its own contract.
 */
export async function extract<S extends z.ZodType>(
  schema: S,
  options: {
    schemaName: string;
    system: string;
    user: string;
    /** Reasoning models spend budget before writing; too low returns empty content. */
    maxTokens?: number;
  },
): Promise<AiCall<z.infer<S>>> {
  const model = openAiModel();
  // Resolved before the try below: inside it, the missing-credential error
  // would be caught and rewritten as "OpenAI unreachable", which sends whoever
  // reads the message looking for a network fault instead of an unset variable.
  const key = requireKey();

  let response: Response;
  try {
    response = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: options.system },
          { role: "user", content: options.user },
        ],
        max_completion_tokens: options.maxTokens ?? 4096,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: options.schemaName,
            strict: true,
            schema: z.toJSONSchema(schema, { target: "draft-2020-12", io: "output" }),
          },
        },
      }),
    });
  } catch (cause) {
    throw new AiUnavailable("upstream_error", `OpenAI unreachable: ${String(cause)}`);
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = ErrorEnvelope.safeParse(body);
    const detail = parsed.success ? parsed.data.error.message : `HTTP ${response.status}`;
    if (response.status === 429) throw new AiUnavailable("rate_limited", `OpenAI: ${detail}`);
    if (response.status === 401 || response.status === 403) {
      throw new AiUnavailable("credentials_missing", `OpenAI rejected the key: ${detail}`);
    }
    throw new AiUnavailable("upstream_error", `OpenAI error: ${detail}`);
  }

  const completion = Completion.safeParse(body);
  if (!completion.success) {
    throw new AiUnavailable("upstream_error", "OpenAI returned an unexpected response shape.");
  }

  const choice = completion.data.choices[0];
  if (choice.message.refusal) {
    throw new AiUnavailable("refused", `OpenAI refused the request: ${choice.message.refusal}`);
  }
  if (!choice.message.content) {
    // A reasoning model that spends its whole budget thinking returns empty
    // content with finish_reason "length" — worth saying so plainly rather
    // than reporting an unparseable response.
    throw new AiUnavailable(
      "upstream_error",
      `OpenAI returned no content (finish_reason: ${choice.finish_reason ?? "unknown"}). ` +
        `Raise maxTokens if this persists.`,
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(choice.message.content);
  } catch {
    throw new AiUnavailable("upstream_error", "OpenAI returned content that was not JSON.");
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new AiUnavailable(
      "upstream_error",
      `OpenAI output failed validation: ${parsed.error.issues[0]?.message}`,
    );
  }

  return {
    value: parsed.data,
    model: completion.data.model,
    promptVersion: OPENAI_PROMPT_VERSION,
    totalTokens: completion.data.usage?.total_tokens ?? null,
  };
}

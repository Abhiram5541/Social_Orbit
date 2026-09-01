"use client";

import * as React from "react";
import { Check, Copy, KeyRound, RotateCw, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { API_SCOPES, type ApiKeyView, type ApiScope } from "@/lib/contracts/api-key";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/states";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { RelativeTime } from "@/components/ui/relative-time";

/* ---------------------------------------------------------------------------
 * API key management — DPR §17.2.
 *
 * The secret is displayed exactly once, at creation or rotation, because only
 * its hash is stored. The UI is explicit about that rather than letting a user
 * assume they can come back for it.
 * ------------------------------------------------------------------------ */

export function ApiKeyPanel({
  initialKeys,
  canWrite,
}: {
  initialKeys: ApiKeyView[];
  canWrite: boolean;
}) {
  const [keys, setKeys] = React.useState(initialKeys);
  const [creating, setCreating] = React.useState(false);
  const [secret, setSecret] = React.useState<{ name: string; value: string } | null>(null);
  const [scopes, setScopes] = React.useState<ApiScope[]>(["influencers:read"]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/internal/api-keys");
    if (response.ok) setKeys((await response.json()).items);
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "");
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/internal/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, scopes }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "Could not create the key.");
      setCreating(false);
      setSecret({ name, value: body.secret });
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function rotate(key: ApiKeyView) {
    if (
      !window.confirm(
        `Rotate “${key.name}”? The current secret stops working immediately and the replacement is shown once.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/internal/api-keys/${key.id}`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "Could not rotate the key.");
      setSecret({ name: key.name, value: body.secret });
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(key: ApiKeyView) {
    if (!window.confirm(`Revoke “${key.name}”? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/internal/api-keys/${key.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not revoke the key.");
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const active = keys.filter((key) => !key.revokedAt);

  return (
    <div className="space-y-4">
      {error && <Notice tone="critical">{error}</Notice>}

      {canWrite && (
        <div className="flex justify-end">
          <Button variant="primary" onClick={() => setCreating(true)} className="gap-1.5">
            <KeyRound className="size-4" aria-hidden />
            Create API key
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>API keys</CardTitle>
          <span className="text-[12px] text-ink-muted">
            {active.length} active of {keys.length}
          </span>
        </CardHeader>
        {keys.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="No API keys yet"
            description="Create a key to query the SocialOrbit database programmatically. Keys are hashed at rest, so the secret is shown only once."
            action={
              canWrite ? (
                <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
                  Create API key
                </Button>
              ) : undefined
            }
          />
        ) : (
          <TableWrap label="API keys">
            <Table>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Key</Th>
                  <Th>Scopes</Th>
                  <Th>Created</Th>
                  <Th>Last used</Th>
                  <Th>Status</Th>
                  {canWrite && (
                    <Th className="text-right">
                      <span className="sr-only">Actions</span>
                    </Th>
                  )}
                </Tr>
              </Thead>
              <Tbody>
                {keys.map((key) => (
                  <Tr key={key.id}>
                    <Td className="font-medium">{key.name}</Td>
                    <Td>
                      <code className="rounded bg-sunken px-1.5 py-0.5 font-num text-[12px] text-ink-muted">
                        {key.prefix}…
                      </code>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {key.scopes.map((scope) => (
                          <Badge key={scope} tone="neutral">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap text-[12px] text-ink-muted">
                      {formatDateTime(key.createdAt)}
                      <span className="block">by {key.createdByName}</span>
                    </Td>
                    <Td className="whitespace-nowrap text-[12px] text-ink-muted">
                      {key.lastUsedAt ? <RelativeTime at={key.lastUsedAt} /> : "never"}
                    </Td>
                    <Td>
                      <Badge tone={key.revokedAt ? "critical" : "positive"} dot>
                        {key.revokedAt ? "Revoked" : "Active"}
                      </Badge>
                    </Td>
                    {canWrite && (
                      <Td className="text-right">
                        {!key.revokedAt && (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => rotate(key)}
                              aria-label={`Rotate ${key.name}`}
                            >
                              <RotateCw className="size-3.5" aria-hidden />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => revoke(key)}
                              aria-label={`Revoke ${key.name}`}
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                            </Button>
                          </div>
                        )}
                      </Td>
                    )}
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="Create API key"
        description="Grant only the scopes the integration needs."
      >
        <form onSubmit={create} className="space-y-4">
          <Field label="Name" hint="How you will recognise this key later." required>
            <Input name="name" required autoFocus placeholder="Production integration" />
          </Field>

          <fieldset className="space-y-2">
            <legend className="text-[13px] font-medium text-ink">Scopes</legend>
            {API_SCOPES.map((scope) => (
              <Checkbox
                key={scope.id}
                label={scope.label}
                description={scope.detail}
                checked={scopes.includes(scope.id)}
                onChange={() =>
                  setScopes((previous) =>
                    previous.includes(scope.id)
                      ? previous.filter((item) => item !== scope.id)
                      : [...previous, scope.id],
                  )
                }
              />
            ))}
          </fieldset>

          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy} disabled={scopes.length === 0}>
              Create key
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(secret)}
        onClose={() => setSecret(null)}
        title="Copy your API key now"
        description="This is the only time it will be shown. SocialOrbit stores a hash, not the key."
        footer={
          <Button variant="primary" onClick={() => setSecret(null)}>
            I have stored it
          </Button>
        }
      >
        {secret && <SecretReveal name={secret.name} value={secret.value} />}
      </Dialog>
    </div>
  );
}

function SecretReveal({ name, value }: { name: string; value: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; the value stays selectable either way.
    }
  }

  return (
    <div className="space-y-3">
      <Notice tone="caution" title="Shown once">
        If you lose this key you cannot recover it — rotate the key to issue a replacement.
      </Notice>
      <p className="text-[13px] text-ink-muted">{name}</p>
      <div className="flex items-center gap-2 rounded-lg border border-line bg-sunken p-2">
        <code className="min-w-0 flex-1 break-all font-num text-[12px] text-ink">{value}</code>
        <Button size="sm" onClick={copy} className="shrink-0 gap-1.5">
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

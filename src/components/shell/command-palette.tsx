"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CornerDownLeft, Search } from "lucide-react";
import { cn } from "@/lib/class-names";
import { formatCompact } from "@/lib/format";
import type { Permission } from "@/lib/contracts/auth";
import type { InfluencerSummary } from "@/lib/contracts/influencer";
import type { SearchQuota } from "@/lib/contracts/search";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/button";
import { ScorePill } from "@/components/intelligence/score";
import { QuotaMeter } from "@/components/intelligence/quota-meter";

/* ---------------------------------------------------------------------------
 * Command palette.
 *
 * Search against the real endpoint, debounced, with the in-flight request
 * aborted whenever the query changes — otherwise a slow early response can
 * overwrite the results for what the user is actually typing.
 * ------------------------------------------------------------------------ */

interface Command {
  id: string;
  label: string;
  hint?: string;
  href: string;
  permission?: Permission;
}

const COMMANDS: Command[] = [
  { id: "discovery", label: "Discover influencers", hint: "Search and filter", href: "/discovery", permission: "influencer:search" },
  { id: "shortlists", label: "Shortlists", href: "/shortlists", permission: "shortlist:read" },
  { id: "compare", label: "Compare influencers", href: "/compare", permission: "influencer:compare" },
  { id: "campaigns", label: "Campaigns", href: "/campaigns", permission: "campaign:read" },
  { id: "reports", label: "Reports", href: "/reports", permission: "report:read" },
  { id: "api", label: "API keys", href: "/api-portal", permission: "api_key:read" },
  { id: "usage", label: "Usage and billing", href: "/usage", permission: "billing:read" },
  { id: "settings", label: "Settings", href: "/settings" },
];

export function CommandPalette({
  open,
  onClose,
  anchor,
  can,
  quota,
}: {
  open: boolean;
  onClose: () => void;
  /** The control that opens the palette; the panel drops from under it,
   *  right-aligned. Without one it is centred near the top. */
  anchor?: React.RefObject<HTMLElement | null>;
  can: (permission: Permission) => boolean;
  /** Metered plans show the spend before the user commits to a full search. */
  quota?: SearchQuota | null;
}) {
  const router = useRouter();
  const ref = React.useRef<HTMLDialogElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [cursor, setCursor] = React.useState(0);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) {
      // The palette is the search control's own panel, so it opens where the
      // control is — top-layer, so it is measured rather than laid out. The
      // preflight zeroes a dialog's UA `margin: auto`, which is why the
      // fallback centres explicitly.
      node.showModal();
      const box = anchor?.current?.getBoundingClientRect();
      if (box) {
        // Right edge under the control's, unless that would push the panel
        // off the left of a narrow screen — then it keeps the page gutter.
        const gutter = 16;
        const right = Math.max(
          gutter,
          Math.min(window.innerWidth - box.right, window.innerWidth - gutter - node.offsetWidth),
        );
        node.style.top = `${Math.round(box.bottom + 8)}px`;
        node.style.right = `${Math.round(right)}px`;
        node.style.left = "auto";
        node.style.bottom = "auto";
        node.style.margin = "0";
      }
      setQuery("");
      setCursor(0);
      inputRef.current?.focus();
    } else if (!open && node.open) {
      node.close();
    }
  }, [open, anchor]);

  const commands = React.useMemo(
    () =>
      COMMANDS.filter((command) => !command.permission || can(command.permission)).filter(
        (command) => command.label.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [can, query],
  );

  /*
   * `useDeferredValue` is the debounce: React keeps the last committed value
   * while a newer one is still rendering, so the query lags the keystrokes
   * without a timer to clear. React Query then owns the request itself —
   * cancelling the superseded one and caching what came back.
   */
  const deferred = React.useDeferredValue(query.trim());
  const term = deferred.length >= 2 ? deferred : "";

  const {
    data: results = [],
    isFetching,
    isError,
  } = useQuery({
    queryKey: ["quick-search", term],
    enabled: term.length >= 2,
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `/api/internal/influencers/quick-search?q=${encodeURIComponent(term)}`,
        { signal },
      );
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { items: InfluencerSummary[] };
      return body.items;
    },
  });

  const loading = isFetching;
  const failed = isError;

  const items: { key: string; href: string }[] = React.useMemo(
    () => [
      ...results.map((item) => ({ key: `i:${item.id}`, href: `/influencers/${item.id}` })),
      ...commands.map((command) => ({ key: `c:${command.id}`, href: command.href })),
    ],
    [results, commands],
  );

  // The highlighted row resets whenever the result list changes shape.
  const [cursorFor, setCursorFor] = React.useState(items.length);
  if (cursorFor !== items.length) {
    setCursorFor(items.length);
    setCursor(0);
  }

  function go(href: string) {
    onClose();
    router.push(href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => (items.length === 0 ? 0 : (c + 1) % items.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => (items.length === 0 ? 0 : (c - 1 + items.length) % items.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = items[cursor];
      if (target) go(target.href);
    }
  }

  const activeKey = items[cursor]?.key;
  // Stable option ids derived from row keys, for aria-activedescendant — the
  // input keeps DOM focus while the announced highlight moves.
  const optionId = (key: string) => `palette-opt-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const metered =
    quota != null && quota.limit !== null && quota.remaining !== null
      ? { used: quota.used, limit: quota.limit }
      : null;

  return (
    <dialog
      ref={ref}
      aria-label="Command palette"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="mx-auto mt-[9vh] w-[calc(100vw-2rem)] max-w-2xl rounded-2xl bg-surface p-0 text-ink shadow-overlay"
    >
      <div onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-2.5 border-b border-line px-4 transition-colors focus-within:border-brand">
          <Search className="size-4 shrink-0 text-ink-subtle" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search creators, or jump to a page…"
            aria-label="Search creators or jump to a page"
            role="combobox"
            aria-expanded={items.length > 0}
            aria-autocomplete="list"
            aria-controls="palette-results"
            aria-activedescendant={activeKey ? optionId(activeKey) : undefined}
            data-focus-custom
            className="h-12 min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-subtle"
          />
          {loading && <Spinner className="text-ink-subtle" />}
        </div>

        <div id="palette-results" role="listbox" className="max-h-80 overflow-y-auto p-1.5">
          {results.length > 0 && (
            <Group label="Creators">
              {results.map((item) => (
                <Row
                  key={item.id}
                  id={optionId(`i:${item.id}`)}
                  active={activeKey === `i:${item.id}`}
                  onSelect={() => go(`/influencers/${item.id}`)}
                >
                  <Avatar name={item.displayName} src={item.avatarUrl} size="xs" verification={item.verification} />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-ink">{item.displayName}</span>{" "}
                    <span className="text-ink-muted">@{item.primaryHandle}</span>
                  </span>
                  <span className="shrink-0 font-num text-sm text-ink-muted">
                    {formatCompact(item.followers)}
                  </span>
                  {/* Confidence beside the score, never folded into it. */}
                  <span className="shrink-0 text-sm text-ink-subtle">
                    <span className="font-num">{item.confidence}</span>
                    <span className="label-caps-sm ml-0.5">
                      <span className="sr-only">data </span>conf
                    </span>
                  </span>
                  <ScorePill value={item.healthScore} label="Health" />
                </Row>
              ))}
            </Group>
          )}

          {commands.length > 0 && (
            <Group label="Go to">
              {commands.map((command) => (
                <Row
                  key={command.id}
                  id={optionId(`c:${command.id}`)}
                  active={activeKey === `c:${command.id}`}
                  onSelect={() => go(command.href)}
                >
                  <span className="min-w-0 flex-1 truncate text-ink">{command.label}</span>
                  {command.hint && (
                    <span className="shrink-0 text-sm text-ink-subtle">{command.hint}</span>
                  )}
                </Row>
              ))}
            </Group>
          )}

          {items.length === 0 && (
            <p className="px-3 py-8 text-center text-base text-ink-muted">
              {failed
                ? "Search is unavailable right now. Try again in a moment."
                : query.trim().length < 2
                  ? "Type at least two characters to search creators."
                  : loading
                    ? "Searching…"
                    : `No matches for “${query.trim()}”.`}
            </p>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-3 border-t border-line bg-sunken/50 px-3 py-2 text-xs text-ink-muted">
          <Key>↑</Key>
          <Key>↓</Key>
          <span>navigate</span>
          <Key>
            <CornerDownLeft className="size-2.5" aria-hidden />
          </Key>
          <span>open</span>
          <Key>esc</Key>
          <span>close</span>
          {/* The spend is stated before the user commits, not after the block —
              Arch §3. Quick-search here is free; the full search page is not. */}
          {metered && (
            <span className="ml-auto flex items-center gap-2">
              <span>
                Full search spends <span className="font-num text-ink">1</span> of{" "}
                <span className="font-num text-ink">{metered.limit}</span> this month
              </span>
              <QuotaMeter spent={metered.used} limit={metered.limit} />
            </span>
          )}
        </footer>
      </div>
    </dialog>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1 last:mb-0">
      <p className="label-caps px-2 py-1 text-ink-subtle">{label}</p>
      {children}
    </div>
  );
}

function Row({
  id,
  active,
  onSelect,
  children,
}: {
  id: string;
  active: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <button
      ref={ref}
      id={id}
      type="button"
      role="option"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-base transition-colors",
        active ? "bg-brand-soft" : "hover:bg-sunken",
      )}
    >
      {children}
    </button>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid h-4 min-w-4 place-items-center rounded border border-line bg-surface px-1 font-num text-2xs text-ink-muted">
      {children}
    </kbd>
  );
}

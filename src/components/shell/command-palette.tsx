"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCompact } from "@/lib/format";
import type { Permission } from "@/lib/contracts/auth";
import type { InfluencerSummary } from "@/lib/contracts/influencer";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/button";
import { ScorePill } from "@/components/intelligence/score";

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
  can,
}: {
  open: boolean;
  onClose: () => void;
  can: (permission: Permission) => boolean;
}) {
  const router = useRouter();
  const ref = React.useRef<HTMLDialogElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<InfluencerSummary[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [cursor, setCursor] = React.useState(0);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
      setQuery("");
      setResults([]);
      setCursor(0);
      setFailed(false);
      inputRef.current?.focus();
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);

  const commands = React.useMemo(
    () =>
      COMMANDS.filter((command) => !command.permission || can(command.permission)).filter(
        (command) => command.label.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [can, query],
  );

  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/internal/influencers/quick-search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { items: InfluencerSummary[] };
        setResults(data.items);
        setFailed(false);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setResults([]);
          setFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const items: { key: string; href: string }[] = React.useMemo(
    () => [
      ...results.map((item) => ({ key: `i:${item.id}`, href: `/influencers/${item.id}` })),
      ...commands.map((command) => ({ key: `c:${command.id}`, href: command.href })),
    ],
    [results, commands],
  );

  React.useEffect(() => {
    setCursor(0);
  }, [items.length]);

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
      className="mt-[8vh] w-[calc(100vw-2rem)] max-w-xl rounded-xl border border-line bg-surface p-0 text-ink shadow-overlay backdrop:bg-ink/40"
    >
      <div onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search className="size-4 shrink-0 text-ink-subtle" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search creators, or jump to a page…"
            aria-label="Search creators or jump to a page"
            aria-controls="palette-results"
            className="h-12 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-subtle"
          />
          {loading && <Spinner className="text-ink-subtle" />}
        </div>

        <div id="palette-results" role="listbox" className="max-h-80 overflow-y-auto p-1.5">
          {results.length > 0 && (
            <Group label="Creators">
              {results.map((item) => (
                <Row
                  key={item.id}
                  active={activeKey === `i:${item.id}`}
                  onSelect={() => go(`/influencers/${item.id}`)}
                >
                  <Avatar name={item.displayName} src={item.avatarUrl} size="xs" verification={item.verification} />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-ink">{item.displayName}</span>{" "}
                    <span className="text-ink-muted">@{item.primaryHandle}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[12px] tabular-nums text-ink-muted">
                    {formatCompact(item.followers)}
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
                  active={activeKey === `c:${command.id}`}
                  onSelect={() => go(command.href)}
                >
                  <span className="min-w-0 flex-1 truncate text-ink">{command.label}</span>
                  {command.hint && (
                    <span className="shrink-0 text-[12px] text-ink-subtle">{command.hint}</span>
                  )}
                </Row>
              ))}
            </Group>
          )}

          {items.length === 0 && (
            <p className="px-3 py-8 text-center text-[13px] text-ink-muted">
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

        <footer className="flex items-center gap-3 border-t border-line bg-sunken/50 px-3 py-2 text-[11px] text-ink-muted">
          <Key>↑</Key>
          <Key>↓</Key>
          <span>navigate</span>
          <Key>
            <CornerDownLeft className="size-2.5" aria-hidden />
          </Key>
          <span>open</span>
          <Key>esc</Key>
          <span>close</span>
        </footer>
      </div>
    </dialog>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1 last:mb-0">
      <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-[0.05em] text-ink-subtle">
        {label}
      </p>
      {children}
    </div>
  );
}

function Row({
  active,
  onSelect,
  children,
}: {
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
      type="button"
      role="option"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
        active ? "bg-brand-soft" : "hover:bg-sunken",
      )}
    >
      {children}
    </button>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid h-4 min-w-4 place-items-center rounded border border-line bg-surface px-1 font-mono text-[10px] text-ink-muted">
      {children}
    </kbd>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { Radio } from "lucide-react";
import { formatCompact, formatDate, formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/states";
import { Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";

/* ---------------------------------------------------------------------------
 * Track a term through the indexed corpus.
 *
 * The coverage line is not a footnote: a mention count with no denominator is
 * the number people quote, so what was searched is printed beside what was
 * found, every time.
 * ------------------------------------------------------------------------ */

interface Single {
  term: string;
  from: string;
  to: string;
  mentions: number;
  creators: number;
  views: number | null;
  engagements: number | null;
  timeline: { week: string; mentions: number; views: number | null }[];
  topCreators: {
    influencerId: string;
    displayName: string;
    primaryHandle: string;
    mentions: number;
    followers: number | null;
    healthScore: number | null;
    views: number | null;
  }[];
  coTags: { tag: string; count: number }[];
  examples: {
    contentId: string;
    displayName: string;
    title: string;
    url: string;
    publishedAt: string;
    views: number | null;
    matchedIn: string;
  }[];
  coverage: { creatorsIndexed: number; postsSearched: number; postsInWindow: number };
}

interface Comparison {
  terms: { term: string; mentions: number; creators: number; views: number | null; share: number }[];
  totalMentions: number;
  coverage: Single["coverage"];
}

const isComparison = (value: Single | Comparison): value is Comparison => "terms" in value;

export function ListeningView() {
  const [input, setInput] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [result, setResult] = React.useState<Single | Comparison | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    const terms = input.split(",").map((term) => term.trim()).filter(Boolean).slice(0, 6);
    if (terms.length === 0) return;
    setBusy(true);
    setError(null);
    const response = await fetch("/api/internal/listening", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ terms, from: from || undefined }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message ?? "Could not run that.");
      return;
    }
    setResult((await response.json()) as Single | Comparison);
  }

  const peak = result && !isComparison(result)
    ? Math.max(1, ...result.timeline.map((point) => point.mentions))
    : 1;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Track a term</CardTitle>
        </CardHeader>
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <Field label="Term" hint="One term, or several separated by commas to compare.">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="biryani, dosa, pizza"
              onKeyDown={(event) => {
                if (event.key === "Enter") void run();
              }}
            />
          </Field>
          <Field label="Since" hint="Defaults to the last six months.">
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Button onClick={run} disabled={busy || input.trim().length < 2}>
            {busy ? "Scanning…" : "Listen"}
          </Button>
        </div>
      </Card>

      {error && (
        <Notice tone="critical" title="Not run">
          {error}
        </Notice>
      )}

      {!result && (
        <Card>
          <EmptyState
            icon={Radio}
            title="Nothing tracked yet"
            description="Search a brand, a product or a theme across every post SENSO has indexed — who is talking about it, how often, with what reach, and which tags travel with it."
          />
        </Card>
      )}

      {result && isComparison(result) && (
        <Card>
          <CardHeader>
            <CardTitle>Share of conversation</CardTitle>
          </CardHeader>
          <Table>
            <Thead>
              <Tr>
                <Th>Term</Th>
                <Th numeric>Mentions</Th>
                <Th numeric>Creators</Th>
                <Th numeric>Views</Th>
                <Th numeric>Share</Th>
              </Tr>
            </Thead>
            <Tbody>
              {result.terms.map((term) => (
                <Tr key={term.term}>
                  <Td>{term.term}</Td>
                  <Td numeric>{formatNumber(term.mentions)}</Td>
                  <Td numeric>{formatNumber(term.creators)}</Td>
                  <Td numeric>{term.views === null ? "—" : formatCompact(term.views)}</Td>
                  <Td numeric>{term.share}%</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <div className="border-t border-line px-4 py-2.5">
            <p className="text-sm text-ink-subtle">
              Share is of these {result.terms.length} terms within SENSO&rsquo;s indexed corpus —{" "}
              {formatNumber(result.coverage.creatorsIndexed)} creators,{" "}
              {formatNumber(result.coverage.postsInWindow)} posts in the window. It is not a share
              of the platform, and it does not include consumer posts: SENSO indexes creators.
            </p>
          </div>
        </Card>
      )}

      {result && !isComparison(result) && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{result.term}</CardTitle>
            </CardHeader>
            <div className="grid gap-px bg-rule sm:grid-cols-4">
              {[
                { label: "Mentions", value: formatNumber(result.mentions) },
                { label: "Creators", value: formatNumber(result.creators) },
                { label: "Views", value: result.views === null ? "—" : formatCompact(result.views) },
                {
                  label: "Engagements",
                  value: result.engagements === null ? "—" : formatCompact(result.engagements),
                },
              ].map((cell) => (
                <div key={cell.label} className="bg-surface px-4 py-3">
                  <p className="text-sm text-ink-muted">{cell.label}</p>
                  <p className="font-num text-2xl text-ink">{cell.value}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-line px-4 py-2.5">
              <p className="text-sm text-ink-subtle">
                Searched {formatNumber(result.coverage.postsInWindow)} posts from{" "}
                {formatNumber(result.coverage.creatorsIndexed)} indexed creators between{" "}
                {formatDate(result.from)} and {formatDate(result.to)}. Creator posts only —
                consumer conversation is not in this corpus.
              </p>
            </div>
          </Card>

          {result.timeline.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>By week</CardTitle>
              </CardHeader>
              <div className="flex h-32 items-end gap-0.5 px-4 py-3">
                {result.timeline.map((point) => (
                  <div
                    key={point.week}
                    className="min-w-0 flex-1 rounded-t-sm bg-brand/70"
                    style={{ height: `${Math.max(2, (point.mentions / peak) * 100)}%` }}
                    title={`${point.week}: ${point.mentions} mentions`}
                  />
                ))}
              </div>
              <div className="flex justify-between border-t border-line px-4 py-2 font-num text-sm text-ink-subtle">
                <span>{formatDate(result.timeline[0].week)}</span>
                <span>peak {peak} a week</span>
                <span>{formatDate(result.timeline[result.timeline.length - 1].week)}</span>
              </div>
            </Card>
          )}

          {result.coTags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tags that travel with it</CardTitle>
              </CardHeader>
              <div className="flex flex-wrap gap-2 px-4 py-3">
                {result.coTags.map((tag) => (
                  <Badge key={tag.tag} tone="neutral">
                    #{tag.tag} · {tag.count}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          {result.topCreators.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Who is talking about it</CardTitle>
              </CardHeader>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Creator</Th>
                    <Th numeric>Mentions</Th>
                    <Th numeric>Followers</Th>
                    <Th numeric>Health</Th>
                    <Th numeric>Views</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {result.topCreators.map((creator) => (
                    <Tr key={creator.influencerId}>
                      <Td>
                        <Link
                          href={`/influencers/${creator.influencerId}`}
                          prefetch={false}
                          className="font-medium text-ink hover:text-brand"
                        >
                          {creator.displayName}
                        </Link>
                        <span className="ml-2 text-sm text-ink-muted">@{creator.primaryHandle}</span>
                      </Td>
                      <Td numeric>{creator.mentions}</Td>
                      <Td numeric>
                        {creator.followers === null ? "—" : formatCompact(creator.followers)}
                      </Td>
                      <Td numeric>
                        {creator.healthScore === null ? "—" : Math.round(creator.healthScore)}
                      </Td>
                      <Td numeric>{creator.views === null ? "—" : formatCompact(creator.views)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Card>
          )}

          {result.examples.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent posts</CardTitle>
              </CardHeader>
              <ul className="divide-y divide-rule">
                {result.examples.map((example) => (
                  <li key={example.contentId} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1 basis-64">
                      <a
                        href={example.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-ink hover:text-brand"
                      >
                        {example.title || "Untitled"}
                      </a>
                      <p className="text-sm text-ink-muted">
                        {example.displayName} · {formatDate(example.publishedAt)} · matched in{" "}
                        {example.matchedIn}
                      </p>
                    </div>
                    <span className="font-num text-sm text-ink">
                      {example.views === null ? "—" : formatCompact(example.views)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

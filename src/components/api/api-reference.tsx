import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";

/** The v1 surface — DPR §17.1. Endpoints not yet implemented say so. */
const ENDPOINTS = [
  { method: "GET", path: "/v1/influencers", scope: "influencers:read", purpose: "Search and filter influencers.", status: "live" },
  { method: "GET", path: "/v1/influencers/{id}", scope: "influencers:read", purpose: "Complete influencer profile.", status: "live" },
  { method: "GET", path: "/v1/categories", scope: "influencers:read", purpose: "Taxonomy and supported platforms.", status: "live" },
  { method: "GET", path: "/v1/health", scope: "none", purpose: "Service liveness. Unauthenticated.", status: "live" },
  { method: "GET", path: "/v1/influencers/{id}/analytics", scope: "analytics:read", purpose: "Scores, components and evidence.", status: "planned" },
  { method: "GET", path: "/v1/influencers/{id}/growth", scope: "analytics:read", purpose: "Historical snapshots.", status: "planned" },
  { method: "GET", path: "/v1/influencers/{id}/posts", scope: "influencers:read", purpose: "Indexed content.", status: "planned" },
  { method: "GET", path: "/v1/influencers/{id}/benchmarks", scope: "analytics:read", purpose: "Category percentile position.", status: "planned" },
  { method: "POST", path: "/v1/shortlists", scope: "shortlists:write", purpose: "Create a shortlist.", status: "planned" },
] as const;

const PARAMETERS = [
  { name: "country", type: "string[]", detail: "ISO 3166-1 alpha-2, comma separated." },
  { name: "language", type: "string[]", detail: "ISO 639-1, comma separated." },
  { name: "category", type: "string[]", detail: "SocialOrbit taxonomy ids." },
  { name: "platform", type: "string[]", detail: "youtube, instagram." },
  { name: "followers_min / followers_max", type: "integer", detail: "Audience size bounds." },
  { name: "engagement_min", type: "number", detail: "Minimum engagement rate, percent." },
  { name: "health_min", type: "number", detail: "Minimum SocialOrbit Health score, 0–100." },
  { name: "campaign_fit_min", type: "number", detail: "Minimum campaign fit, 0–100." },
  { name: "verified", type: "boolean", detail: "Restrict to SocialOrbit Verified creators." },
  { name: "sort", type: "string", detail: "health_score_desc, followers_desc, engagement_desc." },
  { name: "page / page_size", type: "integer", detail: "Page defaults to 1; page_size to 25, max 100." },
];

export function ApiReference() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
          <span className="text-[12px] text-ink-muted">Base: /v1</span>
        </CardHeader>
        <TableWrap label="API endpoints">
          <Table>
            <Thead>
              <Tr>
                <Th>Method</Th>
                <Th>Path</Th>
                <Th>Scope</Th>
                <Th>Purpose</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {ENDPOINTS.map((endpoint) => (
                <Tr key={endpoint.path + endpoint.method}>
                  <Td>
                    <code className="font-num text-[12px] font-medium text-brand-ink">
                      {endpoint.method}
                    </code>
                  </Td>
                  <Td>
                    <code className="font-num text-[12px] text-ink">{endpoint.path}</code>
                  </Td>
                  <Td>
                    <code className="font-num text-[11px] text-ink-muted">{endpoint.scope}</code>
                  </Td>
                  <Td className="text-ink-muted">{endpoint.purpose}</Td>
                  <Td>
                    <Badge tone={endpoint.status === "live" ? "positive" : "neutral"}>
                      {endpoint.status}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Query parameters</CardTitle>
          <span className="text-[12px] text-ink-muted">GET /v1/influencers</span>
        </CardHeader>
        <TableWrap label="Query parameters">
          <Table>
            <Thead>
              <Tr>
                <Th>Parameter</Th>
                <Th>Type</Th>
                <Th>Detail</Th>
              </Tr>
            </Thead>
            <Tbody>
              {PARAMETERS.map((parameter) => (
                <Tr key={parameter.name}>
                  <Td>
                    <code className="font-num text-[12px] text-ink">{parameter.name}</code>
                  </Td>
                  <Td className="font-num text-[12px] text-ink-muted">{parameter.type}</Td>
                  <Td className="text-ink-muted">{parameter.detail}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      </Card>
    </div>
  );
}

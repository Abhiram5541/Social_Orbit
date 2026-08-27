"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Client-side data fetching.
 *
 * The interactive lists — discovery, the command palette — read from the
 * internal API rather than from a server render, because their state lives in
 * the URL and changes faster than a round trip. Doing that with `useEffect`
 * plus `useState` means setting loading state inside an effect, which triggers
 * a cascading render on every keystroke and double-fetches under React's
 * development double-invoke. This owns the request lifecycle instead:
 * deduplication, cancellation and caching, with no effect to get wrong.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Search results are cheap to refetch and must not go stale while
            // a buyer is comparing creators, but refetching on every window
            // focus would burn a metered search.
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

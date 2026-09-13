"use client";

import * as React from "react";

/**
 * Time-of-day greeting.
 *
 * Resolved in the browser rather than on the server: the server's clock is in
 * whatever region the deployment runs in, and greeting a London user "good
 * evening" at 9am is the kind of small wrongness that costs a product its
 * credibility. `useSyncExternalStore` gives the server a stable snapshot so
 * React never reports a hydration mismatch for a value it could not know.
 */
export function Greeting({ name }: { name: string }) {
  const salutation = React.useSyncExternalStore(
    () => () => {},
    () => {
      const hour = new Date().getHours();
      if (hour < 12) return "Good morning";
      if (hour < 18) return "Good afternoon";
      return "Good evening";
    },
    () => "Welcome back",
  );

  // The reference sets the salutation heavy and the name light.
  return (
    <>
      {salutation},{" "}
      <span className="font-medium text-ink-subtle">{name.split(" ")[0]}</span>
    </>
  );
}

"use client";

import * as React from "react";

/**
 * Tracks a media query in JavaScript.
 *
 * For choosing *which component to mount*, never for styling — CSS does styling
 * far better. The distinction earns its keep here: hiding one of two filter
 * surfaces with a class leaves both in the DOM, which puts a second copy of
 * every checkbox and label on the page. That was a real defect once, and this
 * is how it stays fixed.
 *
 * `useSyncExternalStore` rather than state-in-an-effect: `matchMedia` is an
 * external store, and subscribing to one properly avoids both the cascading
 * render and the torn state that the manual version risks.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    // The server has no viewport. Reporting false means the narrow layout is
    // rendered first and corrected on hydration, which is the safe direction:
    // a sheet on a wide screen is merely unusual, a dropdown on a phone is
    // unusable.
    () => false,
  );
}

import { CardSkeleton, Skeleton } from "@/components/ui/states";

/**
 * The instant state every workspace route shows while its server render
 * streams in: the header's shape, then three cards.
 *
 * This is also what makes navigation cheap. A route with no loading boundary
 * is prefetched *in full* — Next renders the whole page on the server for
 * every link on screen, and the rail alone carries a dozen. With the boundary
 * in place a prefetch stops here, the click paints this at once, and only the
 * page the person actually chose is rendered.
 */
export function PageLoading() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading">
      <div className="pt-1">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-3 h-9 w-72" />
        <Skeleton className="mt-3 h-3 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="rounded-xl bg-surface card-shadow p-4">
        <Skeleton className="h-3 w-40" />
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

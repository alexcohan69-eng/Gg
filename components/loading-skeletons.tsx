import { Skeleton } from "@/components/ui/skeleton"

/**
 * Feed-shaped placeholder used by route-level `loading.tsx` files while
 * a DB-backed page streams in. Mirrors `PostCard`'s layout (avatar +
 * author line + content + action row) so the swap to real content
 * doesn't shift the layout. `role="status"` announces the loading
 * state to assistive tech without spamming a live region per row.
 */
export function PostFeedSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      className="flex flex-col divide-y divide-border"
      role="status"
      aria-label="Loading posts"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-start gap-3 p-4">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2.5 pt-1">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3.5 w-full max-w-[18rem]" />
            <Skeleton className="h-3.5 w-full max-w-[12rem]" />
            <div className="mt-1 flex items-center gap-8">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-3 w-8" />
            </div>
          </div>
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  )
}

/**
 * Compact avatar + two-line placeholder for list-style pages
 * (notifications, message inbox, follower/following lists) where each
 * row is a single line of text rather than a full post.
 */
export function RowListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="flex flex-col divide-y divide-border"
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 p-4">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2 pt-0.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-48" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  )
}

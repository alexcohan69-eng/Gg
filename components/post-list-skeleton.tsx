import { Skeleton } from "@/components/ui/skeleton"

/**
 * Placeholder for a single `PostCard` row, matching its avatar +
 * two-line layout so the skeleton-to-content transition doesn't
 * shift the page.
 */
function PostCardSkeleton() {
  return (
    <div className="flex gap-3 border-b border-border p-4">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3.5 w-full max-w-md" />
        <Skeleton className="h-3.5 w-3/4 max-w-sm" />
        <div className="mt-1 flex max-w-md items-center justify-between">
          <Skeleton className="h-6 w-10" />
          <Skeleton className="h-6 w-10" />
          <Skeleton className="h-6 w-10" />
          <Skeleton className="h-6 w-6" />
        </div>
      </div>
    </div>
  )
}

/** Placeholder shown while a feed (home, profile, bookmarks, replies) loads. */
export function PostListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading posts">
      {Array.from({ length: count }).map((_, index) => (
        <PostCardSkeleton key={index} />
      ))}
    </div>
  )
}

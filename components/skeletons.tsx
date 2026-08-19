import { Skeleton } from "@/components/ui/skeleton"

/**
 * Shared loading placeholders used by the route-level `loading.tsx`
 * files. Each mirrors the real component's layout closely enough that
 * the swap to loaded content doesn't shift the page, and every list is
 * wrapped with `role="status"` + an `aria-label` so screen readers
 * announce a single "loading" region instead of a burst of empty rows.
 */

/** One post row — matches `PostCard`'s avatar + header + body layout. */
function PostCardSkeleton() {
  return (
    <div className="flex gap-3 border-b border-border p-4">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3.5 w-full max-w-[22rem]" />
        <Skeleton className="h-3.5 w-full max-w-[16rem]" />
        <div className="mt-1 flex items-center gap-10">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-3 w-8" />
        </div>
      </div>
    </div>
  )
}

export function PostListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col" role="status" aria-label="Loading posts">
      {Array.from({ length: count }).map((_, index) => (
        <PostCardSkeleton key={index} />
      ))}
      <span className="sr-only">Loading posts…</span>
    </div>
  )
}

/** One notification row — matches `NotificationItem`'s icon + avatar + text. */
export function NotificationListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="flex flex-col"
      role="status"
      aria-label="Loading notifications"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex items-start gap-3 border-b border-border p-4"
        >
          <Skeleton className="size-6 shrink-0 rounded-md" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
            <div className="flex items-center gap-2">
              <Skeleton className="size-6 shrink-0 rounded-full" />
              <Skeleton className="h-3.5 w-48" />
            </div>
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading notifications…</span>
    </div>
  )
}

/** One inbox row — matches `ConversationListItem`'s avatar + name + preview. */
export function ConversationListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="flex flex-col"
      role="status"
      aria-label="Loading conversations"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex items-start gap-3 border-b border-border p-4"
        >
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3.5 w-full max-w-[18rem]" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading conversations…</span>
    </div>
  )
}

/** One user row — matches `UserListItem`'s avatar + name/username + follow button. */
export function UserListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="flex flex-col" role="status" aria-label="Loading people">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex items-start gap-3 border-b border-border p-4"
        >
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <Skeleton className="h-8 w-20 shrink-0 rounded-full" />
        </div>
      ))}
      <span className="sr-only">Loading people…</span>
    </div>
  )
}

/** Matches `ProfileHeader`'s banner + overlapping avatar + meta block. */
export function ProfileHeaderSkeleton() {
  return (
    <div role="status" aria-label="Loading profile">
      <Skeleton className="h-36 w-full rounded-none sm:h-48" />
      <div className="px-4 pb-6">
        <div className="-mt-10 flex items-end justify-between sm:-mt-12">
          <Skeleton className="size-20 shrink-0 rounded-full border-4 border-background sm:size-24" />
          <Skeleton className="mt-10 h-9 w-28 rounded-full sm:mt-12" />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="mt-1 h-3.5 w-full max-w-[24rem]" />
          <div className="mt-1 flex gap-4">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        </div>
      </div>
      <span className="sr-only">Loading profile…</span>
    </div>
  )
}

/** Matches the message thread's alternating incoming/outgoing bubbles. */
export function MessageThreadSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="flex flex-1 flex-col gap-3 p-4"
      role="status"
      aria-label="Loading messages"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={index % 2 === 0 ? "flex justify-start" : "flex justify-end"}
        >
          <Skeleton
            className="h-10 rounded-2xl"
            style={{ width: `${45 + ((index * 13) % 35)}%` }}
          />
        </div>
      ))}
      <span className="sr-only">Loading messages…</span>
    </div>
  )
}

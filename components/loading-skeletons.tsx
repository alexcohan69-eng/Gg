import { Skeleton } from "@/components/ui/skeleton"

/**
 * Shared skeleton building blocks for route-level `loading.tsx` files.
 * Kept separate from the real list/header components (`PostList`,
 * `UserList`, `ProfileHeader`, ...) so those stay focused on their
 * actual data-driven empty/populated states, while every loading.tsx
 * can render an instant, layout-matching placeholder without waiting
 * on a database round trip.
 */

/** Placeholder for a single post row, matching `PostCard`'s layout. */
function PostRowSkeleton() {
  return (
    <div className="flex gap-3 border-b border-border p-4">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-16" />
        </div>
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
    </div>
  )
}

/** Placeholder for a list of posts, e.g. a feed, profile, or thread. */
export function PostListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading posts" className="flex flex-col">
      {Array.from({ length: count }).map((_, index) => (
        <PostRowSkeleton key={index} />
      ))}
    </div>
  )
}

/** Placeholder for a single user row, matching `UserListItem`'s layout. */
function UserRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4">
      <Skeleton className="size-11 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3.5 w-24" />
      </div>
      <Skeleton className="h-8 w-20 shrink-0 rounded-full" />
    </div>
  )
}

/** Placeholder for a list of users, e.g. followers/following/suggestions. */
export function UserListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading people" className="flex flex-col">
      {Array.from({ length: count }).map((_, index) => (
        <UserRowSkeleton key={index} />
      ))}
    </div>
  )
}

/** Placeholder matching `ProfileHeader`'s banner/avatar/bio layout. */
export function ProfileHeaderSkeleton() {
  return (
    <div role="status" aria-label="Loading profile" className="flex flex-col">
      <Skeleton className="h-36 w-full rounded-none sm:h-48" />
      <div className="px-4 pb-6">
        <div className="-mt-10 sm:-mt-12">
          <Skeleton className="size-20 rounded-full border-4 border-background sm:size-24" />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-24" />
        </div>
        <Skeleton className="mt-4 h-3.5 w-full max-w-sm" />
        <div className="mt-4 flex gap-5">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      </div>
    </div>
  )
}

/** Placeholder for a single conversation row, matching `ConversationListItem`. */
function ConversationRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4">
      <Skeleton className="size-11 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3.5 w-44" />
      </div>
    </div>
  )
}

/** Placeholder for the inbox list. */
export function ConversationListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading conversations" className="flex flex-col">
      {Array.from({ length: count }).map((_, index) => (
        <ConversationRowSkeleton key={index} />
      ))}
    </div>
  )
}

/** Placeholder for a message thread, alternating side to suggest a conversation. */
export function MessageThreadSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading conversation"
      className="flex flex-1 flex-col gap-3 p-4"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className={`flex ${index % 2 === 0 ? "justify-start" : "justify-end"}`}
        >
          <Skeleton
            className="h-9 rounded-2xl"
            style={{ width: `${45 + ((index * 13) % 35)}%` }}
          />
        </div>
      ))}
    </div>
  )
}

/** Placeholder for the notifications list, matching `NotificationItem`. */
function NotificationRowSkeleton() {
  return (
    <div className="flex items-start gap-3 border-b border-border p-4">
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3.5 w-1/2" />
      </div>
    </div>
  )
}

export function NotificationListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading notifications" className="flex flex-col">
      {Array.from({ length: count }).map((_, index) => (
        <NotificationRowSkeleton key={index} />
      ))}
    </div>
  )
}

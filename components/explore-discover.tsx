import { CompassIcon, FlameIcon, UserPlusIcon } from "lucide-react"
import { getSuggestedUsers, getTrendingPosts } from "@/lib/explore"
import { getBlockedUserIds } from "@/lib/blocks"
import { PostCard } from "@/components/post-card"
import { UserListItem } from "@/components/user-list-item"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <h2 className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="size-3.5" aria-hidden="true" />
      {children}
    </h2>
  )
}

/**
 * Explore's landing content, shown before the viewer types a search
 * query: a lightweight "trending" post ranking plus a "who to follow"
 * suggestion list. Fetches both server-side in parallel and reuses
 * `PostCard` / `UserListItem` unchanged, so this stays visually
 * consistent with the rest of the app and the actual search results
 * below it. Rendered inside a `Suspense` boundary by the Explore page,
 * so the search input itself is interactive immediately.
 */
export async function ExploreDiscover({ currentUserId }: { currentUserId: string }) {
  const blockedUserIds = await getBlockedUserIds(currentUserId)
  const [trendingPosts, suggestedUsers] = await Promise.all([
    getTrendingPosts(currentUserId, blockedUserIds),
    getSuggestedUsers(currentUserId, blockedUserIds),
  ])

  if (trendingPosts.length === 0 && suggestedUsers.length === 0) {
    return (
      <div className="p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CompassIcon />
            </EmptyMedia>
            <EmptyTitle>Nothing to discover yet</EmptyTitle>
            <EmptyDescription>
              Trending posts and account suggestions will show up here once
              there&apos;s more activity on Pulse. Try searching by name,
              username, or keyword in the meantime.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {suggestedUsers.length > 0 ? (
        <div>
          <SectionLabel icon={UserPlusIcon}>Who to follow</SectionLabel>
          <div className="flex flex-col">
            {suggestedUsers.map((suggestedUser) => (
              <UserListItem
                key={suggestedUser.id}
                user={suggestedUser}
                profileIdentifier={suggestedUser.username ?? suggestedUser.id}
              />
            ))}
          </div>
        </div>
      ) : null}

      {trendingPosts.length > 0 ? (
        <div>
          <SectionLabel icon={FlameIcon}>Trending</SectionLabel>
          <div className="flex flex-col">
            {trendingPosts.map((post) => (
              <PostCard key={post.id} post={post} currentUserId={currentUserId} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Loading placeholder shown while `ExploreDiscover` resolves. */
export function ExploreDiscoverSkeleton() {
  return (
    <div
      className="flex flex-col divide-y divide-border"
      role="status"
      aria-label="Loading suggestions"
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-start gap-3 p-4">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-48" />
          </div>
        </div>
      ))}
    </div>
  )
}

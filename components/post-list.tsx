import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import { PostCard } from "@/components/post-card"
import { PostFeed } from "@/components/post-feed"
import type { FeedPost } from "@/lib/posts"
import type { LucideIcon } from "lucide-react"

export function PostList({
  posts,
  currentUserId,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyDescription,
  loadMore,
}: {
  posts: FeedPost[]
  currentUserId: string
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyDescription: string
  /**
   * When provided, renders a "Load more" control that pages through
   * older posts via this bound server action. Omit it for lists that
   * are always shown in full (e.g. a post's replies).
   */
  loadMore?: (before: Date) => Promise<FeedPost[]>
}) {
  if (posts.length === 0) {
    return (
      <div className="p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <EmptyIcon />
            </EmptyMedia>
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            <EmptyDescription>{emptyDescription}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  if (loadMore) {
    return (
      <PostFeed
        initialPosts={posts}
        currentUserId={currentUserId}
        loadMore={loadMore}
      />
    )
  }

  return (
    <div className="flex flex-col">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} currentUserId={currentUserId} />
      ))}
    </div>
  )
}

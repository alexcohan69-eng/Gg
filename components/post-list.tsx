import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import { PostCard } from "@/components/post-card"
import type { FeedPost } from "@/lib/posts"
import type { LucideIcon } from "lucide-react"

export function PostList({
  posts,
  currentUserId,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyDescription,
}: {
  posts: FeedPost[]
  currentUserId: string
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyDescription: string
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

  return (
    <div className="flex flex-col">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} currentUserId={currentUserId} />
      ))}
    </div>
  )
}

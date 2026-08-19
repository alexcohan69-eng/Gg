"use client"

import { useEffect, useState, useTransition } from "react"
import { PostCard } from "@/components/post-card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { FEED_PAGE_SIZE, type FeedPost } from "@/lib/posts"

/**
 * Renders a feed's posts plus a "Load more" control that pages
 * through older results via a bound server action. Used by
 * `PostList` whenever a caller wires up pagination; kept as a
 * separate client component so `PostList` itself (and its plain,
 * icon-carrying empty state) can stay a server component.
 */
export function PostFeed({
  initialPosts,
  currentUserId,
  loadMore,
}: {
  initialPosts: FeedPost[]
  currentUserId: string
  /** Fetches the next page older than `before`, using each post's `sortKey`. */
  loadMore: (before: Date) => Promise<FeedPost[]>
}) {
  const [posts, setPosts] = useState(initialPosts)
  const [hasMore, setHasMore] = useState(initialPosts.length >= FEED_PAGE_SIZE)
  const [loadError, setLoadError] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Resync with the server whenever this page's own posts prop
  // changes (new navigation, or a revalidatePath from creating/
  // deleting a post) — otherwise a deleted post would keep showing in
  // this component's own accumulated state after router.refresh().
  // This does mean any already-loaded extra pages collapse back to
  // the first page on those events, which is the right trade-off:
  // correctness after a delete matters more than preserving scroll
  // depth through an infrequent action.
  useEffect(() => {
    setPosts(initialPosts)
    setHasMore(initialPosts.length >= FEED_PAGE_SIZE)
  }, [initialPosts])

  function handleLoadMore() {
    const last = posts[posts.length - 1]
    if (!last) return

    setLoadError(false)
    startTransition(async () => {
      try {
        const next = await loadMore(last.sortKey)
        setPosts((prev) => [...prev, ...next])
        setHasMore(next.length >= FEED_PAGE_SIZE)
      } catch {
        setLoadError(true)
      }
    })
  }

  return (
    <div className="flex flex-col">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} currentUserId={currentUserId} />
      ))}

      {hasMore ? (
        <div className="flex flex-col items-center gap-2 p-4">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={handleLoadMore}
            disabled={isPending}
          >
            {isPending ? <Spinner data-icon="inline-start" /> : null}
            Load more
          </Button>
          {loadError ? (
            <p className="text-sm text-destructive" role="alert">
              Couldn&apos;t load more posts. Try again.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

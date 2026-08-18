"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  MessageCircleIcon,
  Repeat2Icon,
  HeartIcon,
  BookmarkIcon,
  MoreHorizontalIcon,
  Trash2Icon,
} from "lucide-react"
import { deletePost } from "@/app/actions/posts"
import {
  bookmarkPost,
  likePost,
  removeBookmark,
  repostPost,
  undoRepost,
  unlikePost,
} from "@/app/actions/interactions"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn, getInitials, formatRelativeTime, profileHref } from "@/lib/utils"
import type { FeedPost } from "@/lib/posts"

/**
 * Renders `children` as a link to the post's detail page, or as a
 * plain `div` when navigation is disabled (e.g. the root post already
 * being viewed on its own detail page). Keeping this as one wrapper
 * avoids duplicating the header/content markup for both cases.
 */
function ClickWrapper({
  href,
  disabled,
  className,
  children,
}: {
  href: string
  disabled?: boolean
  className?: string
  children: React.ReactNode
}) {
  if (disabled) {
    return <div className={className}>{children}</div>
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}

export function PostCard({
  post,
  currentUserId,
  linkToDetail = true,
}: {
  post: FeedPost
  currentUserId: string
  /** Set to false when rendering the post being actively viewed on its own detail page. */
  linkToDetail?: boolean
}) {
  const router = useRouter()
  const [isDeleting, startDeleting] = useTransition()
  const isOwner = post.authorId === currentUserId
  const detailHref = `/post/${post.id}`

  const [liked, setLiked] = useState(post.isLiked)
  const [likeCount, setLikeCount] = useState(post.likeCount)
  const [, startLikeTransition] = useTransition()

  const [reposted, setReposted] = useState(post.isReposted)
  const [repostCount, setRepostCount] = useState(post.repostCount)
  const [, startRepostTransition] = useTransition()

  const [bookmarked, setBookmarked] = useState(post.isBookmarked)
  const [, startBookmarkTransition] = useTransition()

  function handleDelete() {
    startDeleting(async () => {
      const result = await deletePost(post.id)
      if (!result.success) {
        toast.error(result.error ?? "Couldn't delete post.")
        return
      }
      toast.success("Post deleted")
      router.refresh()
    })
  }

  function handleLikeToggle() {
    const next = !liked
    setLiked(next)
    setLikeCount((count) => Math.max(0, count + (next ? 1 : -1)))

    startLikeTransition(async () => {
      const result = next ? await likePost(post.id) : await unlikePost(post.id)
      if (!result.success) {
        setLiked(!next)
        setLikeCount((count) => Math.max(0, count + (next ? -1 : 1)))
        toast.error(result.error ?? "Something went wrong.")
      }
    })
  }

  function handleRepostToggle() {
    const next = !reposted
    setReposted(next)
    setRepostCount((count) => Math.max(0, count + (next ? 1 : -1)))

    startRepostTransition(async () => {
      const result = next ? await repostPost(post.id) : await undoRepost(post.id)
      if (!result.success) {
        setReposted(!next)
        setRepostCount((count) => Math.max(0, count + (next ? -1 : 1)))
        toast.error(result.error ?? "Something went wrong.")
      } else {
        toast.success(next ? "Reposted" : "Repost removed")
      }
    })
  }

  function handleBookmarkToggle() {
    const next = !bookmarked
    setBookmarked(next)

    startBookmarkTransition(async () => {
      const result = next
        ? await bookmarkPost(post.id)
        : await removeBookmark(post.id)
      if (!result.success) {
        setBookmarked(!next)
        toast.error(result.error ?? "Something went wrong.")
      } else {
        toast.success(next ? "Added to bookmarks" : "Removed from bookmarks")
      }
    })
  }

  return (
    <article
      className="flex gap-3 border-b border-border p-4 transition-colors hover:bg-muted/30"
      aria-busy={isDeleting}
    >
      <Link href={profileHref({ id: post.authorId, username: post.authorUsername })} className="shrink-0">
        <Avatar className="size-10">
          <AvatarImage src={post.authorImage ?? undefined} alt={post.authorName} />
          <AvatarFallback>{getInitials(post.authorName)}</AvatarFallback>
        </Avatar>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-1.5 text-sm">
            <Link
              href={profileHref({ id: post.authorId, username: post.authorUsername })}
              className="flex min-w-0 items-baseline gap-1.5 hover:underline"
            >
              <span className="truncate font-semibold text-foreground">
                {post.authorName}
              </span>
              <span className="truncate text-muted-foreground">
                @{post.authorUsername ?? "user"}
              </span>
            </Link>
            <ClickWrapper
              href={detailHref}
              disabled={!linkToDetail}
              className="inline-flex items-baseline gap-1.5"
            >
              <span className="text-muted-foreground">·</span>
              <time
                dateTime={new Date(post.createdAt).toISOString()}
                className="shrink-0 text-muted-foreground hover:underline"
                // The rendered label is a function of "now", so the server
                // render and the client's first render can legitimately
                // land a second apart (e.g. "10s" vs "11s").
                suppressHydrationWarning
              >
                {formatRelativeTime(post.createdAt)}
              </time>
            </ClickWrapper>
          </div>

          {isOwner ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="-mt-1 shrink-0 rounded-full text-muted-foreground"
                    aria-label="Post options"
                  >
                    <MoreHorizontalIcon />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  <Trash2Icon data-icon="inline-start" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <ClickWrapper href={detailHref} disabled={!linkToDetail}>
          <p className="whitespace-pre-wrap text-pretty break-words text-sm leading-relaxed text-foreground">
            {post.content}
          </p>
        </ClickWrapper>

        <div className="-ml-2 mt-1 flex max-w-md items-center justify-between text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-full hover:text-primary"
            aria-label="Reply"
            onClick={() => router.push(detailHref)}
          >
            <MessageCircleIcon />
            {post.replyCount > 0 ? post.replyCount : null}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={reposted}
            className={cn(
              "gap-1.5 rounded-full hover:text-emerald-500",
              reposted && "text-emerald-500",
            )}
            onClick={handleRepostToggle}
          >
            <Repeat2Icon />
            {repostCount > 0 ? repostCount : null}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={liked}
            className={cn(
              "gap-1.5 rounded-full hover:text-rose-500",
              liked && "text-rose-500",
            )}
            onClick={handleLikeToggle}
          >
            <HeartIcon fill={liked ? "currentColor" : "none"} />
            {likeCount > 0 ? likeCount : null}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-pressed={bookmarked}
            aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
            className={cn(
              "rounded-full hover:text-primary",
              bookmarked && "text-primary",
            )}
            onClick={handleBookmarkToggle}
          >
            <BookmarkIcon fill={bookmarked ? "currentColor" : "none"} />
          </Button>
        </div>
      </div>
    </article>
  )
}

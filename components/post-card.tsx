"use client"

import { useTransition } from "react"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getInitials, formatRelativeTime } from "@/lib/utils"
import type { FeedPost } from "@/lib/posts"

/** Action-bar buttons that don't have a live feature behind them yet. */
function comingSoon(label: string) {
  toast.info(`${label} are coming soon`)
}

export function PostCard({
  post,
  currentUserId,
}: {
  post: FeedPost
  currentUserId: string
}) {
  const router = useRouter()
  const [isDeleting, startDeleting] = useTransition()
  const isOwner = post.authorId === currentUserId

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

  return (
    <article
      className="flex gap-3 border-b border-border p-4 transition-colors hover:bg-muted/30"
      aria-busy={isDeleting}
    >
      <Avatar className="size-10 shrink-0">
        <AvatarImage src={post.authorImage ?? undefined} alt={post.authorName} />
        <AvatarFallback>{getInitials(post.authorName)}</AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-1.5 text-sm">
            <span className="truncate font-semibold text-foreground">
              {post.authorName}
            </span>
            <span className="truncate text-muted-foreground">
              @{post.authorUsername ?? "user"}
            </span>
            <span className="text-muted-foreground">·</span>
            <time
              dateTime={new Date(post.createdAt).toISOString()}
              className="shrink-0 text-muted-foreground"
              // The rendered label is a function of "now", so the server
              // render and the client's first render can legitimately
              // land a second apart (e.g. "10s" vs "11s").
              suppressHydrationWarning
            >
              {formatRelativeTime(post.createdAt)}
            </time>
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

        <p className="whitespace-pre-wrap text-pretty break-words text-sm leading-relaxed text-foreground">
          {post.content}
        </p>

        <div className="-ml-2 mt-1 flex max-w-md items-center justify-between text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-full hover:text-primary"
            onClick={() => comingSoon("Replies")}
          >
            <MessageCircleIcon />
            {post.replyCount > 0 ? post.replyCount : null}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-full hover:text-emerald-500"
            onClick={() => comingSoon("Reposts")}
          >
            <Repeat2Icon />
            {post.repostCount > 0 ? post.repostCount : null}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-full hover:text-rose-500"
            onClick={() => comingSoon("Likes")}
          >
            <HeartIcon />
            {post.likeCount > 0 ? post.likeCount : null}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full hover:text-primary"
            aria-label="Bookmark"
            onClick={() => comingSoon("Bookmarks")}
          >
            <BookmarkIcon />
          </Button>
        </div>
      </div>
    </article>
  )
}

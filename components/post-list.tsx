"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { PostComposer } from "@/components/post-composer"
import { PostCard } from "@/components/post-card"
import type { FeedPost } from "@/lib/posts"
import type { LucideIcon } from "lucide-react"

export function PostList({
  posts,
  currentUserId,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyDescription,
  isSelf = false,
  composerUser,
}: {
  posts: FeedPost[]
  currentUserId: string
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyDescription: string
  /** When true and `composerUser` is set, the empty state offers an "Add your first post" trigger. Mirrors TestimonialGrid's empty-state CTA. */
  isSelf?: boolean
  composerUser?: { name: string; image?: string | null }
}) {
  const router = useRouter()
  const [composerOpen, setComposerOpen] = useState(false)
  const canCompose = isSelf && Boolean(composerUser)

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
          {canCompose ? (
            <EmptyContent>
              <Button type="button" onClick={() => setComposerOpen(true)}>
                <PlusIcon data-icon="inline-start" />
                Add your first post
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>

        {canCompose ? (
          <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
            <DialogContent className="max-w-lg gap-0 p-0" showCloseButton>
              <DialogHeader className="px-4 pt-4 pb-2">
                <DialogTitle>Create post</DialogTitle>
              </DialogHeader>
              <PostComposer
                user={composerUser as { name: string; image?: string | null }}
                submitLabel="Post"
                autoFocus
                onPosted={() => {
                  setComposerOpen(false)
                  router.refresh()
                }}
              />
            </DialogContent>
          </Dialog>
        ) : null}
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

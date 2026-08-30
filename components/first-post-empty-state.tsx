"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MessageSquareTextIcon, PlusIcon } from "lucide-react"
import { PostComposer } from "@/components/post-composer"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty"

/**
 * Empty state for the self profile's Posts tab, mirroring the
 * "Add your first testimonial" pattern in TestimonialGrid: an
 * illustrated empty state with a CTA that reveals the actual
 * composer in place, rather than sending the owner elsewhere to post.
 */
export function FirstPostEmptyState({
  user,
}: {
  user: { name: string; image?: string | null }
}) {
  const router = useRouter()
  const [composing, setComposing] = useState(false)

  if (composing) {
    return (
      <PostComposer
        user={user}
        autoFocus
        submitLabel="Post"
        onPosted={() => {
          setComposing(false)
          router.refresh()
        }}
      />
    )
  }

  return (
    <div className="p-4">
      <Empty className="border border-dashed border-border bg-card/50 py-10">
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="size-12 rounded-2xl bg-primary/10 text-primary [&_svg:not([class*='size-'])]:size-5"
          >
            <MessageSquareTextIcon />
          </EmptyMedia>
          <EmptyTitle className="text-base">Share your first post</EmptyTitle>
          <EmptyDescription>
            Anything you post will show up here for people to see.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button type="button" onClick={() => setComposing(true)}>
            <PlusIcon data-icon="inline-start" />
            Add your first post
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}

"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { toast } from "sonner"
import { BriefcaseIcon, MessageSquareQuoteIcon, RadioTowerIcon, SparklesIcon } from "lucide-react"
import { createPost } from "@/app/actions/posts"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import type { MediaType } from "@/lib/media"

export type PublishToFeedItem = {
  type: "service" | "project" | "testimonial"
  id: string
  title: string
  subtitle: string | null
  image: string | null
  imageType: MediaType | null
}

const TYPE_META = {
  service: { label: "service", icon: BriefcaseIcon },
  project: { label: "project", icon: SparklesIcon },
  testimonial: { label: "testimonial", icon: MessageSquareQuoteIcon },
} as const

const MAX_CAPTION = 2000

/**
 * Lets the owner of a service/portfolio project/testimonial share it
 * to their home feed as a post with a rich preview card attached
 * (see `PostAttachmentCard`/`posts.attachedServiceId` etc.). Reuses
 * `createPost` under the hood — the caption is just the post's plain-
 * text content, and the "attachment" field tells the server action
 * which of the owner's own rows to link.
 */
export function PublishToFeedDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: PublishToFeedItem
}) {
  const router = useRouter()
  const [caption, setCaption] = useState("")
  const [isPending, startTransition] = useTransition()
  const { label, icon: TypeIcon } = TYPE_META[item.type]

  function handlePublish() {
    if (isPending) return

    const formData = new FormData()
    formData.set("content", caption.trim())
    formData.set("media", "[]")
    formData.set("attachment", `${item.type}:${item.id}`)

    startTransition(async () => {
      const result = await createPost(formData)
      if (!result.success) {
        toast.error(result.error ?? "Couldn't publish to feed. Try again.")
        return
      }
      toast.success("Published to your feed")
      setCaption("")
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isPending) onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publish to feed</DialogTitle>
          <DialogDescription>
            Share this {label} as a post — followers will see it in their home feed with a
            preview card linking back to it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
            {item.image ? (
              <Image src={item.image} alt="" fill unoptimized className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 via-muted to-muted">
                <TypeIcon className="size-5 text-primary" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="line-clamp-1 font-heading text-sm font-semibold tracking-tight text-foreground">
              {item.title}
            </p>
            {item.subtitle ? (
              <p className="line-clamp-1 text-xs text-muted-foreground">{item.subtitle}</p>
            ) : null}
          </div>
        </div>

        <Field>
          <FieldLabel htmlFor="publish-to-feed-caption">Caption</FieldLabel>
          <Textarea
            id="publish-to-feed-caption"
            placeholder={`Say something about this ${label}...`}
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))}
            disabled={isPending}
            rows={3}
            autoFocus
          />
          <FieldDescription>Optional — the preview card speaks for itself either way.</FieldDescription>
        </Field>

        <DialogFooter>
          <Button type="button" onClick={handlePublish} disabled={isPending}>
            {isPending ? <Spinner data-icon="inline-start" /> : <RadioTowerIcon data-icon="inline-start" />}
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

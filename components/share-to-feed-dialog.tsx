"use client"

import { toast } from "sonner"
import { PostComposer, type ComposerAttachedItem } from "@/components/post-composer"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * The "Share to feed" entry point for a service/work project/
 * testimonial — wraps `PostComposer` in its `attachedItem` mode so the
 * owner can add an optional caption before posting the preview card to
 * their feed. Opened from the "..." menu on each of their own tiles
 * (ServiceGrid/PortfolioGrid/TestimonialGrid).
 */
export function ShareToFeedDialog({
  open,
  onOpenChange,
  attachedItem,
  user,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  attachedItem: ComposerAttachedItem
  user: { name: string; image?: string | null }
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share to feed</DialogTitle>
          <DialogDescription>Post this to your feed so followers can see it.</DialogDescription>
        </DialogHeader>

        {/* Remounts if a different item is shared while the dialog is
            still mounted, so the editor/attachments never carry over
            from a previous item. */}
        <PostComposer
          key={attachedItem.id}
          user={user}
          attachedItem={attachedItem}
          placeholder="Say something about it…"
          submitLabel="Share"
          autoFocus
          className="rounded-2xl border-b-0 p-0"
          onPosted={() => {
            toast.success("Shared to feed")
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

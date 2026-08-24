"use client"

import { useEffect } from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react"
import type { MediaAttachment } from "@/lib/media"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Full-screen media viewer for a portfolio case study's gallery.
 * Built directly on the base-ui Dialog primitive (rather than the
 * shared `Dialog`/`DialogContent` in components/ui/dialog.tsx) because
 * that component is styled as a small centered card — the wrong shape
 * for a full-bleed image/video viewer with prev/next controls.
 */
export function MediaLightbox({
  items,
  index,
  onIndexChange,
  onClose,
  altPrefix,
}: {
  items: MediaAttachment[]
  /** Index into `items` currently shown, or null when the lightbox is closed. */
  index: number | null
  onIndexChange: (index: number) => void
  onClose: () => void
  /** Prefix used to build each item's accessible label, e.g. the project title. */
  altPrefix: string
}) {
  const open = index !== null
  const current = index !== null ? items[index] : null

  const goPrev = () => {
    if (index === null) return
    onIndexChange((index - 1 + items.length) % items.length)
  }
  const goNext = () => {
    if (index === null) return
    onIndexChange((index + 1) % items.length)
  }

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goPrev()
      if (e.key === "ArrowRight") goNext()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, items.length])

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-background/95 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed inset-0 z-50 flex flex-col outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0">
          <DialogPrimitive.Title className="sr-only">
            {altPrefix} gallery viewer
          </DialogPrimitive.Title>

          <div className="flex items-center justify-between gap-4 p-4">
            <span className="text-sm font-medium text-muted-foreground">
              {index !== null ? `${index + 1} / ${items.length}` : null}
            </span>
            <DialogPrimitive.Close
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="rounded-full"
                  aria-label="Close gallery viewer"
                />
              }
            >
              <XIcon />
            </DialogPrimitive.Close>
          </div>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-4">
            {items.length > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full sm:left-4"
                aria-label="Previous item"
                onClick={goPrev}
              >
                <ChevronLeftIcon />
              </Button>
            ) : null}

            {current ? (
              current.type === "video" ? (
                <video
                  key={current.url}
                  src={current.url}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-full max-w-full rounded-lg bg-black"
                  aria-label={`Video ${index !== null ? index + 1 : ""} in ${altPrefix} gallery`}
                >
                  Your browser doesn&apos;t support embedded video playback.
                </video>
              ) : (
                // Plain <img>, not next/image: the lightbox needs the
                // media's natural aspect ratio at viewport scale, which
                // next/image's fixed fill/width-height model doesn't fit.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={current.url}
                  src={current.url || "/placeholder.svg"}
                  alt={
                    current.type === "gif"
                      ? `GIF ${index !== null ? index + 1 : ""} in ${altPrefix} gallery`
                      : `Image ${index !== null ? index + 1 : ""} in ${altPrefix} gallery`
                  }
                  className={cn("max-h-full max-w-full rounded-lg object-contain")}
                />
              )
            ) : null}

            {items.length > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full sm:right-4"
                aria-label="Next item"
                onClick={goNext}
              >
                <ChevronRightIcon />
              </Button>
            ) : null}
          </div>

          {items.length > 1 ? (
            <div className="flex justify-center gap-1.5 overflow-x-auto p-4 pt-0">
              {items.map((item, i) => (
                <button
                  key={item.url}
                  type="button"
                  onClick={() => onIndexChange(i)}
                  aria-label={`Go to item ${i + 1}`}
                  aria-current={i === index}
                  className={cn(
                    "size-1.5 shrink-0 rounded-full transition-all",
                    i === index ? "w-4 bg-primary" : "bg-muted-foreground/30",
                  )}
                />
              ))}
            </div>
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

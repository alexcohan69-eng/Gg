"use client"

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type DragEvent,
} from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { upload } from "@vercel/blob/client"
import { BriefcaseIcon, ImageIcon, QuoteIcon, TypeIcon, VideoIcon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { createPost } from "@/app/actions/posts"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  RichTextEditor,
  RichTextToolbar,
  useRichTextEditor,
} from "@/components/rich-text-editor"
import { cn, getInitials } from "@/lib/utils"
import {
  MAX_MEDIA_PER_POST,
  MAX_VIDEOS_PER_POST,
  validateMediaFile,
  type MediaAttachment,
  type MediaType,
} from "@/lib/media"

type Attachment = {
  id: string
  previewUrl: string
  type: MediaType
  status: "uploading" | "done" | "error"
  url?: string
}

/**
 * Uploads media attachments for the composer. Each file is validated
 * client-side (fast feedback) and then uploaded individually to
 * `/api/upload`, which re-validates and is the actual security
 * boundary — the client check is only a UX shortcut. Videos can't be
 * mixed with images/GIFs and are capped at one per post, mirrored by
 * `validateMediaAttachments` server-side in createPost.
 */
function useMediaAttachments() {
  const [attachments, setAttachments] = useState<Attachment[]>([])

  const hasVideo = attachments.some((a) => a.type === "video")
  const hasImageOrGif = attachments.some((a) => a.type !== "video")

  function addFiles(files: File[], kind: "image" | "video") {
    if (kind === "video" && (hasVideo || hasImageOrGif)) {
      toast.error("You can only attach one video, and it can't be combined with images or GIFs.")
      return
    }
    if (kind === "image" && hasVideo) {
      toast.error("Videos can't be combined with images or GIFs in the same post.")
      return
    }

    const room =
      kind === "video"
        ? MAX_VIDEOS_PER_POST - attachments.length
        : MAX_MEDIA_PER_POST - attachments.length
    if (room <= 0) {
      toast.error(
        kind === "video"
          ? "You can only attach one video per post."
          : `You can attach up to ${MAX_MEDIA_PER_POST} images or GIFs.`,
      )
      return
    }

    for (const file of files.slice(0, room)) {
      const validationError = validateMediaFile(file)
      if (validationError) {
        toast.error(validationError)
        continue
      }

      const type: MediaType =
        file.type === "image/gif" ? "gif" : kind === "video" ? "video" : "image"

      const id = crypto.randomUUID()
      const previewUrl = URL.createObjectURL(file)
      setAttachments((prev) => [
        ...prev,
        { id, previewUrl, type, status: "uploading" },
      ])

      // Uploaded straight to Blob storage from the browser (not proxied
      // through /api/upload) so large videos never hit a serverless
      // function's request-body cap. /api/upload only issues the
      // short-lived upload token.
      upload(`posts/${file.name}`, file, {
        access: "private",
        handleUploadUrl: "/api/upload",
        clientPayload: JSON.stringify({ mime: file.type }),
      })
        .then((blob) => {
          const url = `/api/media?pathname=${encodeURIComponent(blob.pathname)}`
          setAttachments((prev) =>
            prev.map((a) => (a.id === id ? { ...a, status: "done", url } : a)),
          )
        })
        .catch((error: Error) => {
          toast.error(error.message || "Couldn't upload file.")
          setAttachments((prev) => prev.filter((a) => a.id !== id))
        })
    }

    if (files.length > room) {
      toast.error(
        kind === "video"
          ? "You can only attach one video per post."
          : `You can attach up to ${MAX_MEDIA_PER_POST} images or GIFs.`,
      )
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((a) => a.id !== id)
    })
  }

  function reset() {
    for (const a of attachments) URL.revokeObjectURL(a.previewUrl)
    setAttachments([])
  }

  const isUploading = attachments.some((a) => a.status === "uploading")
  const uploadedMedia: MediaAttachment[] = attachments
    .filter((a) => a.status === "done" && a.url)
    .map((a) => ({ url: a.url as string, type: a.type }))

  return {
    attachments,
    addFiles,
    removeAttachment,
    reset,
    isUploading,
    uploadedMedia,
    hasVideo,
    hasImageOrGif,
  }
}

export type ComposerAttachedItem = {
  kind: "service" | "project" | "testimonial"
  id: string
  /** Rendered in the composer's static preview — title for services/projects, quote/author for testimonials. */
  label: string
  sublabel?: string
}

export function PostComposer({
  user,
  replyToId,
  replyToUsername,
  attachedItem,
  placeholder = "What's happening?",
  submitLabel = "Post",
  autoFocus = false,
  className,
  onPosted,
}: {
  user: { name: string; image?: string | null }
  /** When set, the created post is a reply to this post id. */
  replyToId?: string
  /** Author of the post being replied to, shown as a "Replying to @…" context line. */
  replyToUsername?: string | null
  /**
   * When set, the created post embeds a preview card linking to this
   * service/project/testimonial (see attachedKind/attachedId in
   * createPost). Media attach buttons are hidden — the composer is
   * caption-only in this mode — and an empty caption is allowed since
   * the attachment itself is the content.
   */
  attachedItem?: ComposerAttachedItem
  placeholder?: string
  submitLabel?: string
  autoFocus?: boolean
  /** Overrides the outer form's default feed-row styling (e.g. inside a dialog). */
  className?: string
  /** Called after a successful post, e.g. to refocus or scroll a list. */
  onPosted?: () => void
}) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [isEmpty, setIsEmpty] = useState(true)
  const [isFocused, setIsFocused] = useState(autoFocus)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [showFormatting, setShowFormatting] = useState(false)
  const {
    attachments,
    addFiles,
    removeAttachment,
    reset: resetAttachments,
    isUploading,
    uploadedMedia,
    hasVideo,
    hasImageOrGif,
  } = useMediaAttachments()

  const editor = useRichTextEditor({
    placeholder,
    autofocus: autoFocus,
    onUpdate: (editor) => {
      setIsEmpty(editor.isEmpty)
    },
  })

  useEffect(() => {
    if (!editor) return
    const onFocus = () => setIsFocused(true)
    const onBlur = () => setIsFocused(!editor.isEmpty)
    editor.on("focus", onFocus)
    editor.on("blur", onBlur)
    return () => {
      editor.off("focus", onFocus)
      editor.off("blur", onBlur)
    }
  }, [editor])

  const canSubmit = editor && (!isEmpty || attachments.length > 0 || Boolean(attachedItem))
  const canAddMoreImages = !hasVideo && attachments.length < MAX_MEDIA_PER_POST
  const canAddVideo = !hasVideo && !hasImageOrGif
  // The composer only needs its full surface (attachments grid, toolbar,
  // Post button) once someone is actually composing. Otherwise it collapses
  // to a slim, low-noise row so it doesn't compete with the feed below it.
  // `showFormatting` is included so opening the formatting row can't blur
  // the (still-empty) editor and collapse the whole composer out from
  // under it. An attached item always shows the full surface — the
  // ShareToFeedDialog wrapping it has no other content to collapse to.
  const isExpanded =
    isFocused || !isEmpty || attachments.length > 0 || showFormatting || Boolean(attachedItem)

  function handleImagesSelected(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) addFiles(files, "image")
    e.target.value = ""
  }

  function handleVideoSelected(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) addFiles(files, "video")
    e.target.value = ""
  }

  /** Lets people drag image/video files straight onto the composer instead of only using the toolbar buttons. */
  function handleDrop(e: DragEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsDraggingOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (!files.length) return
    const videos = files.filter((f) => f.type.startsWith("video/"))
    const images = files.filter((f) => !f.type.startsWith("video/"))
    if (videos.length) addFiles(videos, "video")
    if (images.length) addFiles(images, "image")
  }

  function handleSubmit() {
    if (!editor || !canSubmit || isPending || isUploading) return

    const formData = new FormData()
    formData.set("content", editor.getHTML())
    if (replyToId) {
      formData.set("replyToId", replyToId)
    }
    if (attachedItem) {
      formData.set("attachedKind", attachedItem.kind)
      formData.set("attachedId", attachedItem.id)
    }
    formData.set("media", JSON.stringify(uploadedMedia))

    startTransition(async () => {
      const result = await createPost(formData)
      if (!result.success) {
        toast.error(result.error ?? "Something went wrong. Try again.")
        return
      }
      editor.commands.clearContent(true)
      setIsEmpty(true)
      resetAttachments()
      setIsFocused(autoFocus)
      onPosted?.()
      router.refresh()
    })
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault()
        handleSubmit()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDraggingOver(true)
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
      className={cn("border-b border-border p-3 sm:p-4", className)}
    >
      {/* Single elevated surface so the composer reads as one focused
          object rather than a loose stack of controls. Idle and empty, it
          collapses to a slim row; it only grows into the full surface
          (attachments, toolbar, Post button) once someone starts typing,
          focuses it, or attaches media. */}
      <div
        className={cn(
          "relative flex flex-col gap-2 rounded-3xl border border-border bg-card/50 p-2 shadow-xs transition-all duration-200",
          isExpanded && "border-primary/40 bg-card shadow-sm ring-4 ring-primary/10",
          isDraggingOver && "border-dashed border-primary bg-primary/5",
        )}
      >
        {isDraggingOver ? (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-3xl bg-primary/5">
            <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm">
              Drop to attach
            </span>
          </div>
        ) : null}

        {replyToUsername && isExpanded ? (
          <p className="px-2 pt-1 text-sm text-muted-foreground">
            Replying to <span className="font-medium text-primary">@{replyToUsername}</span>
          </p>
        ) : null}

        <div
          className="flex gap-3"
          onKeyDown={(e) => {
            // Cmd/Ctrl+Enter submits, so people don't have to reach for the mouse.
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault()
              handleSubmit()
            }
          }}
          onClick={() => {
            // While collapsed, the row (including the avatar) acts as one
            // big target for opening the composer, not just the text itself.
            if (!isExpanded) editor?.commands.focus()
          }}
        >
          <Avatar
            className={cn(
              "shrink-0 ring-2 ring-background transition-all duration-200",
              isExpanded ? "mt-1 size-10" : "size-9",
            )}
          >
            <AvatarImage src={user.image ?? undefined} alt={user.name} />
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>

          <RichTextEditor
            editor={editor}
            className={cn(
              // Generous inner padding gives the text room to breathe and
              // makes the whole area feel like a real, clickable input.
              "flex-1 cursor-text px-2 text-[17px] leading-relaxed transition-all duration-200",
              isExpanded ? cn("py-2.5", replyToId ? "min-h-14" : "min-h-20") : "flex items-center py-2",
            )}
          />
        </div>

        {isExpanded && attachedItem ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card/50 p-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {attachedItem.kind === "testimonial" ? (
                <QuoteIcon className="size-4" aria-hidden="true" />
              ) : attachedItem.kind === "service" ? (
                <BriefcaseIcon className="size-4" aria-hidden="true" />
              ) : (
                <ImageIcon className="size-4" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              <p className="line-clamp-1 text-sm font-medium text-foreground">{attachedItem.label}</p>
              {attachedItem.sublabel ? (
                <p className="line-clamp-1 text-xs text-muted-foreground">{attachedItem.sublabel}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {isExpanded && attachments.length > 0 ? (
          <ul
            className={cn(
              "grid gap-2",
              attachments.length === 1 ? "grid-cols-1" : "grid-cols-2",
            )}
          >
            {attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="relative aspect-video overflow-hidden rounded-xl border border-border bg-muted"
              >
                {attachment.type === "video" ? (
                  <video
                    src={attachment.previewUrl}
                    className={cn(
                      "size-full object-cover",
                      attachment.status === "uploading" && "opacity-60",
                    )}
                    muted
                    playsInline
                    aria-label="Attached video preview"
                  />
                ) : (
                  <Image
                    src={attachment.previewUrl}
                    alt={
                      attachment.type === "gif"
                        ? "Attached GIF preview"
                        : "Attached image preview"
                    }
                    fill
                    className={cn(
                      "object-cover",
                      attachment.status === "uploading" && "opacity-60",
                    )}
                    unoptimized
                  />
                )}
                {attachment.status === "uploading" ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Spinner className="text-white" />
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  className="absolute top-1.5 right-1.5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
                  aria-label={`Remove ${attachment.type === "video" ? "video" : attachment.type === "gif" ? "GIF" : "image"}`}
                  onClick={() => removeAttachment(attachment.id)}
                  disabled={isPending}
                >
                  <XIcon />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        {/* Formatting lives on its own row behind the "Aa" toggle so the
            action bar below stays a single uncluttered line, even on
            narrow screens — it never renders alongside the icon row. */}
        {isExpanded && showFormatting ? (
          <div className="rounded-2xl bg-muted/50 px-1.5 py-1">
            <RichTextToolbar editor={editor} />
          </div>
        ) : null}

        {isExpanded ? (
          <div className="flex items-center justify-between gap-2 border-t border-border/60 px-1 pt-2">
            <div className="flex min-w-0 items-center gap-0.5">
              {!attachedItem ? (
                <>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    onChange={handleImagesSelected}
                    className="sr-only"
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full text-primary hover:bg-primary/10"
                    aria-label="Add image or GIF"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isPending || !canAddMoreImages}
                  >
                    <ImageIcon />
                  </Button>

                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={handleVideoSelected}
                    className="sr-only"
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full text-primary hover:bg-primary/10"
                    aria-label="Add video"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={isPending || !canAddVideo}
                  >
                    <VideoIcon />
                  </Button>

                  <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
                </>
              ) : null}

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-pressed={showFormatting}
                className={cn(
                  "rounded-full text-primary hover:bg-primary/10",
                  showFormatting && "bg-primary/15",
                )}
                aria-label={showFormatting ? "Hide formatting options" : "Show formatting options"}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowFormatting((v) => !v)}
              >
                <TypeIcon />
              </Button>
            </div>

            <div className="flex items-center gap-3">
              {canSubmit ? (
                <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground sm:inline-block">
                  ⌘ + ↵
                </kbd>
              ) : null}
              <Button
                type="submit"
                className="rounded-full px-5 font-semibold shadow-xs transition-transform active:scale-95"
                disabled={!canSubmit || isPending || isUploading}
              >
                {isPending || isUploading ? <Spinner data-icon="inline-start" /> : null}
                {submitLabel}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </form>
  )
}

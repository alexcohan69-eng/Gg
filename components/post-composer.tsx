"use client"

import { useEffect, useRef, useState, useTransition, type ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ImageIcon, VideoIcon, XIcon } from "lucide-react"
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

      const body = new FormData()
      body.set("file", file)

      fetch("/api/upload", { method: "POST", body })
        .then(async (res) => {
          const data = await res.json()
          if (!res.ok) throw new Error(data.error ?? "Upload failed.")
          setAttachments((prev) =>
            prev.map((a) => (a.id === id ? { ...a, status: "done", url: data.url } : a)),
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

export function PostComposer({
  user,
  replyToId,
  placeholder = "What's happening?",
  submitLabel = "Post",
  autoFocus = false,
  onPosted,
}: {
  user: { name: string; image?: string | null }
  /** When set, the created post is a reply to this post id. */
  replyToId?: string
  placeholder?: string
  submitLabel?: string
  autoFocus?: boolean
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
    onUpdate: (editor) => setIsEmpty(editor.isEmpty),
  })

  useEffect(() => {
    if (!editor) return
    const onFocus = () => setIsFocused(true)
    editor.on("focus", onFocus)
    return () => {
      editor.off("focus", onFocus)
    }
  }, [editor])

  const canSubmit = editor && (!isEmpty || attachments.length > 0)
  const canAddMoreImages = !hasVideo && attachments.length < MAX_MEDIA_PER_POST
  const canAddVideo = !hasVideo && !hasImageOrGif

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

  function handleSubmit() {
    if (!editor || !canSubmit || isPending || isUploading) return

    const formData = new FormData()
    formData.set("content", editor.getHTML())
    if (replyToId) {
      formData.set("replyToId", replyToId)
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
      className="flex gap-3 border-b border-border p-4"
    >
      <Avatar className="size-10 shrink-0">
        <AvatarImage src={user.image ?? undefined} alt={user.name} />
        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
      </Avatar>

      <div className="flex flex-1 flex-col gap-3">
        <div
          className={cn(
            "rounded-2xl transition-colors",
            isFocused && "ring-1 ring-primary/30",
          )}
        >
          <RichTextEditor
            editor={editor}
            className={cn(
              "cursor-text py-1 text-lg leading-relaxed",
              replyToId ? "min-h-16" : "min-h-11",
            )}
          />
        </div>

        {attachments.length > 0 ? (
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex items-center gap-1">
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

            <RichTextToolbar editor={editor} />
          </div>

          <Button
            type="submit"
            className="rounded-full"
            disabled={!canSubmit || isPending || isUploading}
          >
            {isPending || isUploading ? <Spinner data-icon="inline-start" /> : null}
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}

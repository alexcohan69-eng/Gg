"use client"

import { useRef, useState, useTransition, type ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ImageIcon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { createPost } from "@/app/actions/posts"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { cn, getInitials } from "@/lib/utils"
import { MAX_IMAGES_PER_POST, validateImageFile } from "@/lib/media"

const MAX_POST_LENGTH = 280

type Attachment = {
  id: string
  previewUrl: string
  status: "uploading" | "done" | "error"
  url?: string
}

/**
 * Uploads image attachments for the composer. Each file is validated
 * client-side (fast feedback) and then uploaded individually to
 * `/api/upload`, which re-validates and is the actual security
 * boundary — the client check is only a UX shortcut.
 */
function useImageAttachments() {
  const [attachments, setAttachments] = useState<Attachment[]>([])

  function addFiles(files: File[]) {
    const room = MAX_IMAGES_PER_POST - attachments.length
    if (room <= 0) {
      toast.error(`You can attach up to ${MAX_IMAGES_PER_POST} images.`)
      return
    }

    for (const file of files.slice(0, room)) {
      console.log("[v0] selected file", file.name, file.size, file.type)
      const validationError = validateImageFile(file)
      if (validationError) {
        toast.error(validationError)
        continue
      }

      const id = crypto.randomUUID()
      const previewUrl = URL.createObjectURL(file)
      setAttachments((prev) => [
        ...prev,
        { id, previewUrl, status: "uploading" },
      ])

      const body = new FormData()
      body.set("file", file)

      fetch("/api/upload", { method: "POST", body })
        .then(async (res) => {
          const data = await res.json()
          if (!res.ok) throw new Error(data.error ?? "Upload failed.")
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === id ? { ...a, status: "done", url: data.url } : a,
            ),
          )
        })
        .catch((error: Error) => {
          toast.error(error.message || "Couldn't upload image.")
          setAttachments((prev) => prev.filter((a) => a.id !== id))
        })
    }

    if (files.length > room) {
      toast.error(`You can attach up to ${MAX_IMAGES_PER_POST} images.`)
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
  const uploadedUrls = attachments
    .filter((a) => a.status === "done" && a.url)
    .map((a) => a.url as string)

  return {
    attachments,
    addFiles,
    removeAttachment,
    reset,
    isUploading,
    uploadedUrls,
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [content, setContent] = useState("")
  const [isPending, startTransition] = useTransition()
  const {
    attachments,
    addFiles,
    removeAttachment,
    reset: resetAttachments,
    isUploading,
    uploadedUrls,
  } = useImageAttachments()

  const remaining = MAX_POST_LENGTH - content.length
  const isEmpty = content.trim().length === 0 && attachments.length === 0
  const isOverLimit = remaining < 0
  const canAddMoreImages = attachments.length < MAX_IMAGES_PER_POST

  function handleFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) addFiles(files)
    e.target.value = ""
  }

  function handleSubmit(formData: FormData) {
    if (replyToId) {
      formData.set("replyToId", replyToId)
    }
    formData.set("imageUrls", JSON.stringify(uploadedUrls))

    startTransition(async () => {
      const result = await createPost(formData)
      if (!result.success) {
        toast.error(result.error ?? "Something went wrong. Try again.")
        return
      }
      setContent("")
      resetAttachments()
      formRef.current?.reset()
      onPosted?.()
      router.refresh()
    })
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="flex gap-3 border-b border-border p-4"
    >
      <Avatar className="size-10 shrink-0">
        <AvatarImage src={user.image ?? undefined} alt={user.name} />
        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
      </Avatar>

      <div className="flex flex-1 flex-col gap-3">
        <Textarea
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          aria-label={replyToId ? "Reply content" : "Post content"}
          rows={replyToId ? 3 : 2}
          autoFocus={autoFocus}
          className="border-none px-0 py-1 text-lg focus-visible:ring-0"
          disabled={isPending}
        />

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
                <Image
                  src={attachment.previewUrl}
                  alt="Attached image preview"
                  fill
                  className={cn(
                    "object-cover",
                    attachment.status === "uploading" && "opacity-60",
                  )}
                  unoptimized
                />
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
                  aria-label="Remove image"
                  onClick={() => removeAttachment(attachment.id)}
                  disabled={isPending}
                >
                  <XIcon />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={handleFilesSelected}
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full text-primary hover:bg-primary/10"
            aria-label="Add image"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending || !canAddMoreImages}
          >
            <ImageIcon />
          </Button>

          <div className="flex items-center gap-3">
            <span
              className={cn(
                "text-xs text-muted-foreground",
                isOverLimit && "font-medium text-destructive",
              )}
              aria-live="polite"
            >
              {remaining}
            </span>
            <Button
              type="submit"
              className="rounded-full"
              disabled={isEmpty || isOverLimit || isPending || isUploading}
            >
              {isPending || isUploading ? (
                <Spinner data-icon="inline-start" />
              ) : null}
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}

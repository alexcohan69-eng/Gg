"use client"

import { useRef, useState, useTransition } from "react"
import Image from "next/image"
import { upload } from "@vercel/blob/client"
import { toast } from "sonner"
import { CameraIcon, ImagePlusIcon, PlayIcon, StarIcon, XIcon } from "lucide-react"
import { addTestimonial, updateTestimonial } from "@/app/actions/testimonials"
import type { Testimonial } from "@/lib/testimonials"
import { useRichTextEditor, RichTextEditor, RichTextToolbar } from "@/components/rich-text-editor"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import {
  ALLOWED_MEDIA_TYPES,
  MAX_GALLERY_ITEMS,
  getMediaTypeForMime,
  validateGalleryMedia,
  validateMediaFile,
  validateProfileImageFile,
  type MediaAttachment,
  type MediaType,
} from "@/lib/media"
import { cn } from "@/lib/utils"
import { getInitials } from "@/lib/utils"

const MAX_CONTENT = 600

/** Accept attribute covering every image/GIF/video mime the upload route allows for the avatar/proof gallery. */
const MEDIA_ACCEPT = ALLOWED_MEDIA_TYPES.join(",")
/** Inline content images are stills only, same convention as the service/portfolio description editors. */
const CONTENT_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif"

/**
 * Uploads a single file straight to Blob storage from the browser
 * (not proxied through /api/upload/testimonials, which only issues
 * the short-lived upload token) and returns its proxy URL + resolved
 * media type. Mirrors uploadServiceMedia/uploadPortfolioMedia.
 */
async function uploadTestimonialMedia(file: File, kind: "avatar" | "gallery"): Promise<MediaAttachment> {
  const blob = await upload(`testimonials/${kind}-${file.name}`, file, {
    access: "private",
    handleUploadUrl: "/api/upload/testimonials",
    clientPayload: JSON.stringify({ kind, mime: file.type }),
  })
  const url = `/api/media?pathname=${encodeURIComponent(blob.pathname)}`
  return { url, type: getMediaTypeForMime(file.type) ?? "image" }
}

function StarRatingInput({ value, onChange }: { value: number | null; onChange: (rating: number | null) => void }) {
  return (
    <Field>
      <FieldLabel>Rating</FieldLabel>
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, index) => {
          const star = index + 1
          const filled = value !== null && star <= value
          return (
            <button
              key={star}
              type="button"
              onClick={() => onChange(value === star ? null : star)}
              className="rounded-sm p-0.5 transition-colors hover:text-primary"
              aria-label={`${star} star${star === 1 ? "" : "s"}`}
              aria-pressed={filled}
            >
              <StarIcon className={filled ? "size-5 fill-primary text-primary" : "size-5 text-muted-foreground/40"} />
            </button>
          )
        })}
        {value !== null ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        ) : null}
      </div>
      <FieldDescription>Optional — leave unrated if the client didn&apos;t give a star score.</FieldDescription>
    </Field>
  )
}

function AvatarPicker({
  name,
  value,
  onChange,
}: {
  name: string
  value: string | null
  onChange: (url: string | null) => void
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSelect(file: File | undefined) {
    if (!file) return
    const validationError = validateProfileImageFile(file)
    if (validationError) {
      toast.error(validationError)
      return
    }

    setUploading(true)
    uploadTestimonialMedia(file, "avatar")
      .then((media) => onChange(media.url))
      .catch((error: Error) => toast.error(error.message || "Upload failed."))
      .finally(() => setUploading(false))
  }

  return (
    <Field>
      <FieldLabel>Client photo</FieldLabel>
      <div className="flex items-center gap-3">
        <Avatar className="size-14">
          <AvatarImage src={value ?? undefined} alt={name || "Client"} />
          <AvatarFallback>{getInitials(name || "?")}</AvatarFallback>
        </Avatar>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <Spinner data-icon="inline-start" /> : <CameraIcon data-icon="inline-start" />}
            {value ? "Change" : "Upload"}
          </Button>
          {value ? (
            <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={() => onChange(null)}>
              <XIcon data-icon="inline-start" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => {
          handleSelect(e.target.files?.[0])
          e.target.value = ""
        }}
      />
      <FieldDescription>Optional — a photo of the client giving this testimonial.</FieldDescription>
    </Field>
  )
}

/** Optional proof-media attachments (screenshots of the client's message, before/after shots, etc.). */
function ProofMediaPicker({
  value,
  onChange,
}: {
  value: MediaAttachment[]
  onChange: (media: MediaAttachment[]) => void
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSelect(files: FileList | null) {
    if (!files || files.length === 0) return
    const incoming = Array.from(files)
    const remaining = MAX_GALLERY_ITEMS - value.length
    if (remaining <= 0) {
      toast.error(`You can add up to ${MAX_GALLERY_ITEMS} proof media items.`)
      return
    }
    const toUpload = incoming.slice(0, remaining)
    if (incoming.length > toUpload.length) {
      toast.error(`Only added the first ${toUpload.length} — proof media is capped at ${MAX_GALLERY_ITEMS} items.`)
    }

    const validFiles: File[] = []
    for (const file of toUpload) {
      const validationError = validateMediaFile(file)
      if (validationError) {
        toast.error(validationError)
        continue
      }
      validFiles.push(file)
    }
    if (validFiles.length === 0) return

    setUploading(true)
    Promise.allSettled(validFiles.map((file) => uploadTestimonialMedia(file, "gallery")))
      .then((results) => {
        const uploaded: MediaAttachment[] = []
        let failures = 0
        for (const result of results) {
          if (result.status === "fulfilled") uploaded.push(result.value)
          else failures += 1
        }
        if (uploaded.length > 0) onChange([...value, ...uploaded])
        if (failures > 0) toast.error(`${failures} file${failures > 1 ? "s" : ""} failed to upload.`)
      })
      .finally(() => setUploading(false))
  }

  return (
    <Field>
      <FieldLabel>Proof media</FieldLabel>
      <div className="grid grid-cols-3 gap-2">
        {value.map((item, index) => (
          <div key={item.url} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
            {item.type === "video" ? (
              <>
                <video src={item.url} muted playsInline preload="metadata" className="size-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                  <PlayIcon className="size-4 fill-background text-background" aria-hidden="true" />
                </div>
              </>
            ) : (
              <Image src={item.url} alt={`Proof media ${index + 1}`} fill unoptimized className="object-cover" />
            )}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v.url !== item.url))}
              aria-label="Remove proof media item"
              className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              <XIcon className="size-3" aria-hidden="true" />
            </button>
          </div>
        ))}
        {value.length < MAX_GALLERY_ITEMS ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input text-muted-foreground transition-colors hover:border-ring hover:text-foreground disabled:opacity-60"
          >
            {uploading ? <Spinner /> : <ImagePlusIcon className="size-5" />}
            <span className="text-xs">Add</span>
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={MEDIA_ACCEPT}
        multiple
        className="sr-only"
        onChange={(e) => {
          handleSelect(e.target.files)
          e.target.value = ""
        }}
      />
      <FieldDescription>
        Optional — up to {MAX_GALLERY_ITEMS} images, GIFs, or videos, e.g. a screenshot of the client&apos;s message or
        before/after shots.
      </FieldDescription>
    </Field>
  )
}

/**
 * Links this testimonial to at most one of the owner's own services
 * or portfolio projects, so it can surface as a "Client reviews"
 * section on that listing's detail page (see
 * lib/testimonials.ts's getTestimonialsForService/Project). Encoded
 * as a single "service:<id>" / "project:<id>" value since a
 * testimonial is about one or the other, never both.
 */
function LinkPicker({
  value,
  onChange,
  serviceOptions,
  projectOptions,
}: {
  value: string
  onChange: (value: string) => void
  serviceOptions: { id: string; title: string }[]
  projectOptions: { id: string; title: string }[]
}) {
  if (serviceOptions.length === 0 && projectOptions.length === 0) return null

  return (
    <Field>
      <FieldLabel htmlFor="testimonial-link">Link to</FieldLabel>
      <Select
        value={value || "none"}
        onValueChange={(next) => onChange(!next || next === "none" ? "" : next)}
      >
        <SelectTrigger id="testimonial-link" className="w-full">
          <SelectValue placeholder="None" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="none">None</SelectItem>
          </SelectGroup>
          {serviceOptions.length > 0 ? (
            <SelectGroup>
              <SelectLabel>Services</SelectLabel>
              {serviceOptions.map((service) => (
                <SelectItem key={service.id} value={`service:${service.id}`}>
                  {service.title}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : null}
          {projectOptions.length > 0 ? (
            <SelectGroup>
              <SelectLabel>Work</SelectLabel>
              {projectOptions.map((project) => (
                <SelectItem key={project.id} value={`project:${project.id}`}>
                  {project.title}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : null}
        </SelectContent>
      </Select>
      <FieldDescription>
        Optional — attach this quote to a specific service or project so it also shows in that listing&apos;s client
        reviews.
      </FieldDescription>
    </Field>
  )
}

export function TestimonialDialog({
  open,
  onOpenChange,
  testimonial,
  onSaved,
  serviceOptions = [],
  projectOptions = [],
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  testimonial?: Testimonial
  onSaved: () => void
  serviceOptions?: { id: string; title: string }[]
  projectOptions?: { id: string; title: string }[]
}) {
  const [authorName, setAuthorName] = useState(testimonial?.authorName ?? "")
  const [authorAvatar, setAuthorAvatar] = useState<string | null>(testimonial?.authorAvatar ?? null)
  const [rating, setRating] = useState<number | null>(testimonial?.rating ?? null)
  const [media, setMedia] = useState<MediaAttachment[]>(testimonial?.media ?? [])
  const [link, setLink] = useState<string>(
    testimonial?.serviceId
      ? `service:${testimonial.serviceId}`
      : testimonial?.projectId
        ? `project:${testimonial.projectId}`
        : "",
  )
  const [error, setError] = useState<string | null>(null)
  const [insertingImage, setInsertingImage] = useState(false)
  const [isPending, startTransition] = useTransition()
  const contentImageInputRef = useRef<HTMLInputElement>(null)

  const editor = useRichTextEditor({
    placeholder: "What did the client say about working with you?",
    images: true,
  })
  const [hasHydrated, setHasHydrated] = useState(false)
  if (editor && !hasHydrated) {
    editor.commands.setContent(testimonial?.content ?? "")
    setHasHydrated(true)
  }

  function handleInsertContentImage(file: File | undefined) {
    if (!file || !editor) return
    const validationError = validateProfileImageFile(file)
    if (validationError) {
      toast.error(validationError)
      return
    }
    setInsertingImage(true)
    uploadTestimonialMedia(file, "gallery")
      .then((uploaded) => {
        editor.chain().focus().setImage({ src: uploaded.url, alt: "" }).run()
      })
      .catch((error: Error) => toast.error(error.message || "Upload failed."))
      .finally(() => setInsertingImage(false))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const mediaError = validateGalleryMedia(media)
    if (mediaError) {
      setError(mediaError)
      return
    }

    const formData = new FormData(e.currentTarget)
    formData.set("authorAvatar", authorAvatar ?? "")
    formData.set("rating", rating !== null ? String(rating) : "")
    formData.set("content", editor?.getHTML() ?? "")
    formData.set("media", JSON.stringify(media))
    formData.set("link", link)

    startTransition(async () => {
      const result = testimonial
        ? await updateTestimonial(testimonial.id, formData)
        : await addTestimonial(formData)
      if (!result.success) {
        setError(result.error ?? "Something went wrong. Try again.")
        return
      }
      onSaved()
      onOpenChange(false)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isPending) onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{testimonial ? "Edit testimonial" : "Add testimonial"}</DialogTitle>
          <DialogDescription>
            Shown as a client quote on your Testimonials tab.
          </DialogDescription>
        </DialogHeader>

        <form key={testimonial?.id ?? "new"} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <AvatarPicker name={authorName} value={authorAvatar} onChange={setAuthorAvatar} />

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="authorName">Client name</FieldLabel>
                <Input
                  id="authorName"
                  name="authorName"
                  placeholder="e.g. Sarah Chen"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  maxLength={60}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="authorTitle">Client title</FieldLabel>
                <Input
                  id="authorTitle"
                  name="authorTitle"
                  placeholder="e.g. Founder, Acme Co."
                  defaultValue={testimonial?.authorTitle ?? ""}
                  maxLength={80}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="projectTitle">Project label</FieldLabel>
              <Input
                id="projectTitle"
                name="projectTitle"
                placeholder="Optional — e.g. Brand redesign"
                defaultValue={testimonial?.projectTitle ?? ""}
                maxLength={80}
              />
            </Field>

            <LinkPicker
              value={link}
              onChange={setLink}
              serviceOptions={serviceOptions}
              projectOptions={projectOptions}
            />

            <StarRatingInput value={rating} onChange={setRating} />

            <Field>
              <FieldLabel>Testimonial</FieldLabel>
              <div
                className={cn(
                  "rounded-lg border bg-background transition-colors",
                  "border-input focus-within:border-ring",
                )}
              >
                <RichTextEditor editor={editor} className="px-3 pt-3" />
                <RichTextToolbar
                  editor={editor}
                  className="border-t px-2 py-1.5"
                  onInsertImage={() => contentImageInputRef.current?.click()}
                  insertingImage={insertingImage}
                />
              </div>
              <input
                ref={contentImageInputRef}
                type="file"
                accept={CONTENT_IMAGE_ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  handleInsertContentImage(e.target.files?.[0])
                  e.target.value = ""
                }}
              />
              <FieldDescription>Up to {MAX_CONTENT} characters of plain text, formatting included.</FieldDescription>
            </Field>

            <ProofMediaPicker value={media} onChange={setMedia} />
          </FieldGroup>

          {error ? <FieldError>{error}</FieldError> : null}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              {testimonial ? "Save changes" : "Add testimonial"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

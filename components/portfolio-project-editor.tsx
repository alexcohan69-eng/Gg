"use client"

import { useRef, useState, useTransition } from "react"
import Image from "next/image"
import { upload } from "@vercel/blob/client"
import { toast } from "sonner"
import { CameraIcon, ImagePlusIcon, PlayIcon, XIcon } from "lucide-react"
import { addPortfolioProject, updatePortfolioProject } from "@/app/actions/portfolio"
import type { PortfolioProject } from "@/lib/portfolio"
import { useRichTextEditor, RichTextEditor, RichTextToolbar } from "@/components/rich-text-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field"
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
  MAX_VIDEO_SIZE_BYTES,
  getMediaTypeForMime,
  validateMediaFile,
  validateProfileImageFile,
  type MediaAttachment,
  type MediaType,
} from "@/lib/media"
import { prepareVideoForUpload } from "@/lib/video-processing"
import { cn } from "@/lib/utils"

/**
 * Runs any video file through prepareVideoForUpload (always strips
 * audio; compresses if still over the cap) before it's validated and
 * uploaded. Images/GIFs pass through untouched. A shared toast id is
 * used so cover + gallery pickers never show overlapping progress
 * toasts.
 */
async function preparePortfolioFile(file: File, toastId: string): Promise<File> {
  if (getMediaTypeForMime(file.type) !== "video") return file
  try {
    return await prepareVideoForUpload(file, MAX_VIDEO_SIZE_BYTES, (_stage, label) => {
      toast.loading(label, { id: toastId })
    })
  } finally {
    toast.dismiss(toastId)
  }
}

const MAX_TAGS = 6

/** Accept attribute covering every image/GIF/video mime the upload route allows for cover/gallery. */
const MEDIA_ACCEPT = ALLOWED_MEDIA_TYPES.join(",")
/** Inline description images are stills only (see /api/upload/portfolio's "description" kind). */
const DESCRIPTION_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif"

/**
 * Uploads a single file straight to Blob storage from the browser
 * (not proxied through /api/upload/portfolio, which only issues the
 * short-lived upload token) and returns its proxy URL + resolved
 * media type. Going through the server would fail large videos in
 * production once they exceed a serverless function's request-body
 * cap.
 */
async function uploadPortfolioMedia(
  file: File,
  kind: "cover" | "gallery" | "description",
): Promise<MediaAttachment> {
  const blob = await upload(`portfolio/${kind}-${file.name}`, file, {
    access: "private",
    handleUploadUrl: "/api/upload/portfolio",
    clientPayload: JSON.stringify({ kind, mime: file.type }),
  })
  const url = `/api/media?pathname=${encodeURIComponent(blob.pathname)}`
  return { url, type: getMediaTypeForMime(file.type) ?? "image" }
}

function CoverMediaPicker({
  value,
  onChange,
}: {
  value: MediaAttachment | null
  onChange: (media: MediaAttachment | null) => void
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSelect(file: File | undefined) {
    if (!file) return
    const mediaType = getMediaTypeForMime(file.type)
    if (!mediaType) {
      toast.error("Only JPEG, PNG, WebP, GIF images and MP4, WebM, or MOV videos are supported.")
      return
    }

    setUploading(true)
    let preparedFile: File
    try {
      preparedFile = await preparePortfolioFile(file, "cover-video-processing")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't process video.")
      setUploading(false)
      return
    }

    const validationError = validateMediaFile(preparedFile)
    if (validationError) {
      toast.error(validationError)
      setUploading(false)
      return
    }

    uploadPortfolioMedia(preparedFile, "cover")
      .then(onChange)
      .catch((error: Error) => toast.error(error.message || "Upload failed."))
      .finally(() => setUploading(false))
  }

  return (
    <Field>
      <FieldLabel>Cover image or video</FieldLabel>
      <div className="relative h-36 w-full overflow-hidden rounded-lg border border-dashed border-input bg-muted">
        {value ? (
          value.type === "video" ? (
            <video
              src={value.url}
              autoPlay
              loop
              muted
              playsInline
              disablePictureInPicture
              preload="auto"
              className="size-full object-cover"
            />
          ) : (
            <Image src={value.url} alt="Cover" fill unoptimized className="object-cover" />
          )
        ) : null}
        {value?.type === "video" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <PlayIcon className="size-6 fill-background text-background" aria-hidden="true" />
          </div>
        ) : null}
        <div className="absolute inset-0 flex items-center justify-center gap-2">
          {!value ? (
            <p className="text-sm text-muted-foreground">No cover media yet</p>
          ) : null}
        </div>
        <div className="absolute right-2 bottom-2 flex gap-2">
          {value ? (
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              className="rounded-full"
              disabled={uploading}
              onClick={() => onChange(null)}
              aria-label="Remove cover media"
            >
              <XIcon className="size-4" />
            </Button>
          ) : null}
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            className="rounded-full"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            aria-label="Upload cover image or video"
          >
            {uploading ? <Spinner /> : <CameraIcon className="size-4" />}
          </Button>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={MEDIA_ACCEPT}
        className="sr-only"
        onChange={(e) => {
          handleSelect(e.target.files?.[0])
          e.target.value = ""
        }}
      />
      <FieldDescription>Image, GIF, or video — shown as the banner for this case study.</FieldDescription>
    </Field>
  )
}

function GalleryPicker({
  value,
  onChange,
}: {
  value: MediaAttachment[]
  onChange: (media: MediaAttachment[]) => void
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSelect(files: FileList | null) {
    if (!files || files.length === 0) return
    const incoming = Array.from(files)
    const remaining = MAX_GALLERY_ITEMS - value.length
    if (remaining <= 0) {
      toast.error(`You can add up to ${MAX_GALLERY_ITEMS} gallery items.`)
      return
    }
    const toUpload = incoming.slice(0, remaining)
    if (incoming.length > toUpload.length) {
      toast.error(`Only added the first ${toUpload.length} — the gallery is capped at ${MAX_GALLERY_ITEMS} items.`)
    }

    const candidates: File[] = []
    for (const file of toUpload) {
      const mediaType = getMediaTypeForMime(file.type)
      if (!mediaType) {
        toast.error("Only JPEG, PNG, WebP, GIF images and MP4, WebM, or MOV videos are supported.")
        continue
      }
      candidates.push(file)
    }
    if (candidates.length === 0) return

    setUploading(true)

    // Videos are processed one at a time (they share a single
    // ffmpeg.wasm instance, so running them concurrently would race
    // on its virtual filesystem) before the whole batch is validated
    // and uploaded together.
    const validFiles: File[] = []
    let processingFailures = 0
    for (const file of candidates) {
      let preparedFile: File
      try {
        preparedFile = await preparePortfolioFile(file, "gallery-video-processing")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't process video.")
        processingFailures += 1
        continue
      }
      const validationError = validateMediaFile(preparedFile)
      if (validationError) {
        toast.error(validationError)
        processingFailures += 1
        continue
      }
      validFiles.push(preparedFile)
    }
    if (validFiles.length === 0) {
      setUploading(false)
      return
    }

    Promise.allSettled(validFiles.map((file) => uploadPortfolioMedia(file, "gallery")))
      .then((results) => {
        const uploaded: MediaAttachment[] = []
        let failures = processingFailures
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
      <FieldLabel>Gallery</FieldLabel>
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
              <Image src={item.url} alt={`Gallery item ${index + 1}`} fill unoptimized className="object-cover" />
            )}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v.url !== item.url))}
              aria-label="Remove gallery item"
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
        Optional — up to {MAX_GALLERY_ITEMS} images, GIFs, or videos. Select multiple files at once to add them
        together.
      </FieldDescription>
    </Field>
  )
}

function TagInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("")

  function addTag() {
    const tag = draft.trim()
    if (!tag) return
    if (value.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      setDraft("")
      return
    }
    if (value.length >= MAX_TAGS) {
      toast.error(`You can add up to ${MAX_TAGS} tags.`)
      return
    }
    onChange([...value, tag])
    setDraft("")
  }

  return (
    <Field>
      <FieldLabel>Tags</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="h-7 gap-1 px-3">
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((item) => item !== tag))}
              className="rounded-full p-0.5 hover:bg-foreground/10"
              aria-label={`Remove ${tag}`}
            >
              <XIcon className="size-3" aria-hidden="true" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addTag()
            }
          }}
          placeholder="e.g. Brand identity"
          maxLength={30}
        />
        <Button type="button" variant="outline" onClick={addTag}>
          Add
        </Button>
      </div>
      <FieldDescription>
        {value.length}/{MAX_TAGS} tags
      </FieldDescription>
    </Field>
  )
}

export function PortfolioProjectDialog({
  open,
  onOpenChange,
  project,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: PortfolioProject
  onSaved: () => void
}) {
  const [coverMedia, setCoverMedia] = useState<MediaAttachment | null>(
    project?.coverImage ? { url: project.coverImage, type: project.coverImageType } : null,
  )
  const [gallery, setGallery] = useState<MediaAttachment[]>(project?.gallery ?? [])
  const [tags, setTags] = useState<string[]>(project?.tags ?? [])
  const [error, setError] = useState<string | null>(null)
  const [insertingImage, setInsertingImage] = useState(false)
  const [isPending, startTransition] = useTransition()
  const descriptionImageInputRef = useRef<HTMLInputElement>(null)

  const editor = useRichTextEditor({
    placeholder: "Tell the story behind this project — the goal, your approach, the outcome...",
    images: true,
  })
  const [hasHydrated, setHasHydrated] = useState(false)
  if (editor && !hasHydrated) {
    editor.commands.setContent(project?.description ?? "")
    setHasHydrated(true)
  }

  function handleInsertDescriptionImage(file: File | undefined) {
    if (!file || !editor) return
    const validationError = validateProfileImageFile(file)
    if (validationError) {
      toast.error(validationError)
      return
    }
    setInsertingImage(true)
    uploadPortfolioMedia(file, "description")
      .then((media) => {
        editor.chain().focus().setImage({ src: media.url, alt: "" }).run()
      })
      .catch((error: Error) => toast.error(error.message || "Upload failed."))
      .finally(() => setInsertingImage(false))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set("coverImage", coverMedia?.url ?? "")
    formData.set("coverImageType", coverMedia?.type ?? "")
    formData.set("gallery", JSON.stringify(gallery))
    formData.set("tags", JSON.stringify(tags))
    formData.set("description", editor?.getHTML() ?? "")

    startTransition(async () => {
      const result = project
        ? await updatePortfolioProject(project.id, formData)
        : await addPortfolioProject(formData)
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
          <DialogTitle>{project ? "Edit project" : "Add project"}</DialogTitle>
          <DialogDescription>
            Shown as a case study on your Work tab.
          </DialogDescription>
        </DialogHeader>

        <form key={project?.id ?? "new"} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <CoverMediaPicker value={coverMedia} onChange={setCoverMedia} />

            <Field>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input id="title" name="title" defaultValue={project?.title} maxLength={80} required />
            </Field>

            <Field>
              <FieldLabel htmlFor="tagline">Tagline</FieldLabel>
              <Input
                id="tagline"
                name="tagline"
                placeholder="A one-line summary of the project"
                defaultValue={project?.tagline}
                maxLength={150}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="client">Client</FieldLabel>
                <Input
                  id="client"
                  name="client"
                  placeholder="Optional"
                  defaultValue={project?.client ?? ""}
                  maxLength={80}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="externalUrl">Link</FieldLabel>
                <Input
                  id="externalUrl"
                  name="externalUrl"
                  type="url"
                  placeholder="https://..."
                  defaultValue={project?.externalUrl ?? ""}
                />
              </Field>
            </div>

            <TagInput value={tags} onChange={setTags} />

            <Field>
              <FieldLabel>Description</FieldLabel>
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
                  onInsertImage={() => descriptionImageInputRef.current?.click()}
                  insertingImage={insertingImage}
                />
              </div>
              <input
                ref={descriptionImageInputRef}
                type="file"
                accept={DESCRIPTION_IMAGE_ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  handleInsertDescriptionImage(e.target.files?.[0])
                  e.target.value = ""
                }}
              />
              <FieldDescription>
                Optional — the full story behind the project. Use the image button in the toolbar to drop a photo
                anywhere in the text.
              </FieldDescription>
            </Field>

            <GalleryPicker value={gallery} onChange={setGallery} />
          </FieldGroup>

          {error ? <FieldError>{error}</FieldError> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              {project ? "Save changes" : "Add project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

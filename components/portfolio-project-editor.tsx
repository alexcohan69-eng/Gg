"use client"

import { useRef, useState, useTransition } from "react"
import Image from "next/image"
import { toast } from "sonner"
import { CameraIcon, ImagePlusIcon, XIcon } from "lucide-react"
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
import { validateProfileImageFile } from "@/lib/media"
import { cn } from "@/lib/utils"

const MAX_TAGS = 6
const MAX_GALLERY_IMAGES = 6

/** Uploads a single file to /api/upload/portfolio and returns its proxy URL. */
async function uploadPortfolioImage(file: File, kind: "cover" | "gallery"): Promise<string> {
  const body = new FormData()
  body.set("file", file)
  body.set("kind", kind)
  const res = await fetch("/api/upload/portfolio", { method: "POST", body })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? "Upload failed.")
  return data.url as string
}

function CoverImagePicker({
  value,
  onChange,
}: {
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
    uploadPortfolioImage(file, "cover")
      .then(onChange)
      .catch((error: Error) => toast.error(error.message || "Upload failed."))
      .finally(() => setUploading(false))
  }

  return (
    <Field>
      <FieldLabel>Cover image</FieldLabel>
      <div className="relative h-36 w-full overflow-hidden rounded-lg border border-dashed border-input bg-muted">
        {value ? (
          <Image src={value} alt="Cover" fill unoptimized className="object-cover" />
        ) : null}
        <div className="absolute inset-0 flex items-center justify-center gap-2">
          {!value ? (
            <p className="text-sm text-muted-foreground">No cover image yet</p>
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
              aria-label="Remove cover image"
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
            aria-label="Upload cover image"
          >
            {uploading ? <Spinner /> : <CameraIcon className="size-4" />}
          </Button>
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
    </Field>
  )
}

function GalleryPicker({
  value,
  onChange,
}: {
  value: string[]
  onChange: (urls: string[]) => void
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSelect(file: File | undefined) {
    if (!file) return
    if (value.length >= MAX_GALLERY_IMAGES) {
      toast.error(`You can add up to ${MAX_GALLERY_IMAGES} gallery images.`)
      return
    }
    const validationError = validateProfileImageFile(file)
    if (validationError) {
      toast.error(validationError)
      return
    }
    setUploading(true)
    uploadPortfolioImage(file, "gallery")
      .then((url) => onChange([...value, url]))
      .catch((error: Error) => toast.error(error.message || "Upload failed."))
      .finally(() => setUploading(false))
  }

  return (
    <Field>
      <FieldLabel>Gallery</FieldLabel>
      <div className="grid grid-cols-3 gap-2">
        {value.map((url, index) => (
          <div key={url} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
            <Image src={url} alt={`Gallery image ${index + 1}`} fill unoptimized className="object-cover" />
            <button
              type="button"
              onClick={() => onChange(value.filter((u) => u !== url))}
              aria-label="Remove gallery image"
              className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              <XIcon className="size-3" aria-hidden="true" />
            </button>
          </div>
        ))}
        {value.length < MAX_GALLERY_IMAGES ? (
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
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => {
          handleSelect(e.target.files?.[0])
          e.target.value = ""
        }}
      />
      <FieldDescription>
        Optional — up to {MAX_GALLERY_IMAGES} images to show alongside your case study.
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
  const [coverImage, setCoverImage] = useState<string | null>(project?.coverImage ?? null)
  const [gallery, setGallery] = useState<string[]>(project?.gallery ?? [])
  const [tags, setTags] = useState<string[]>(project?.tags ?? [])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const editor = useRichTextEditor({
    placeholder: "Tell the story behind this project — the goal, your approach, the outcome...",
  })
  const [hasHydrated, setHasHydrated] = useState(false)
  if (editor && !hasHydrated) {
    editor.commands.setContent(project?.description ?? "")
    setHasHydrated(true)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set("coverImage", coverImage ?? "")
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
            <CoverImagePicker value={coverImage} onChange={setCoverImage} />

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
                <RichTextToolbar editor={editor} className="border-t px-2 py-1.5" />
              </div>
              <FieldDescription>Optional — the full story behind the project.</FieldDescription>
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

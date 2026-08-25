"use client"

import { useRef, useState, useTransition } from "react"
import Image from "next/image"
import { upload } from "@vercel/blob/client"
import { toast } from "sonner"
import { CameraIcon, CheckIcon, ImagePlusIcon, PlayIcon, PlusIcon, XIcon } from "lucide-react"
import { addService, updateService } from "@/app/actions/services"
import type { Service, ServicePackage } from "@/lib/services"
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
 * uploaded. Images/GIFs pass through untouched. Mirrors the
 * portfolio editor's own helper.
 */
async function prepareServiceFile(file: File, toastId: string): Promise<File> {
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
/** Inline description images are stills only (see /api/upload/services's "description" kind). */
const DESCRIPTION_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif"

/**
 * Uploads a single file straight to Blob storage from the browser
 * (not proxied through /api/upload/services, which only issues the
 * short-lived upload token) and returns its proxy URL + resolved
 * media type. Mirrors uploadPortfolioMedia.
 */
async function uploadServiceMedia(
  file: File,
  kind: "cover" | "gallery" | "description",
): Promise<MediaAttachment> {
  const blob = await upload(`services/${kind}-${file.name}`, file, {
    access: "private",
    handleUploadUrl: "/api/upload/services",
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
      preparedFile = await prepareServiceFile(file, "cover-video-processing")
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

    uploadServiceMedia(preparedFile, "cover")
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
      <FieldDescription>Image, GIF, or video — shown as the banner for this listing.</FieldDescription>
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
        preparedFile = await prepareServiceFile(file, "gallery-video-processing")
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

    Promise.allSettled(validFiles.map((file) => uploadServiceMedia(file, "gallery")))
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
          placeholder="e.g. Logo design"
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

type PackageDraft = {
  name: string
  price: string
  deliveryDays: string
  description: string
  features: string[]
}

const MAX_PACKAGES = 3
const MAX_PACKAGE_FEATURES = 8
const PACKAGE_PRESET_NAMES = ["Basic", "Standard", "Premium"]

function emptyPackageDraft(index: number): PackageDraft {
  return { name: PACKAGE_PRESET_NAMES[index] ?? "", price: "", deliveryDays: "", description: "", features: [] }
}

function packageToDraft(pkg: ServicePackage): PackageDraft {
  return {
    name: pkg.name,
    price: String(pkg.price),
    deliveryDays: String(pkg.deliveryDays),
    description: pkg.description,
    features: pkg.features,
  }
}

function PackageFeatureInput({
  value,
  onChange,
}: {
  value: string[]
  onChange: (features: string[]) => void
}) {
  const [draft, setDraft] = useState("")

  function addFeature() {
    const feature = draft.trim()
    if (!feature) return
    if (value.length >= MAX_PACKAGE_FEATURES) {
      toast.error(`You can add up to ${MAX_PACKAGE_FEATURES} features per package.`)
      return
    }
    onChange([...value, feature])
    setDraft("")
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {value.map((feature, index) => (
            <li
              key={index}
              className="flex items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-sm text-foreground"
            >
              <CheckIcon className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span className="flex-1 truncate">{feature}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                aria-label={`Remove ${feature}`}
              >
                <XIcon className="size-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addFeature()
            }
          }}
          placeholder="e.g. 3 rounds of revisions"
          maxLength={80}
        />
        <Button type="button" variant="outline" size="sm" onClick={addFeature}>
          Add
        </Button>
      </div>
    </div>
  )
}

/**
 * Optional Basic/Standard/Premium pricing tiers, Fiverr-gig style.
 * Each tier has its own price, delivery time, short description, and
 * checklist of included features. A listing with none of these still
 * works — it just falls back to the flat starting price/delivery
 * fields above.
 */
function PackagesEditor({
  value,
  onChange,
}: {
  value: PackageDraft[]
  onChange: (packages: PackageDraft[]) => void
}) {
  function updatePackage(index: number, patch: Partial<PackageDraft>) {
    onChange(value.map((pkg, i) => (i === index ? { ...pkg, ...patch } : pkg)))
  }

  return (
    <Field>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel>Pricing packages</FieldLabel>
        {value.length < MAX_PACKAGES ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange([...value, emptyPackageDraft(value.length)])}
          >
            <PlusIcon data-icon="inline-start" />
            Add tier
          </Button>
        ) : null}
      </div>
      <FieldDescription>
        Optional — break this listing into tiers (Basic, Standard, Premium) so clients can pick the scope that fits
        instead of one flat price.
      </FieldDescription>

      {value.length > 0 ? (
        <div className="flex flex-col gap-3">
          {value.map((pkg, index) => (
            <div key={index} className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <Input
                  value={pkg.name}
                  onChange={(e) => updatePackage(index, { name: e.target.value })}
                  placeholder={PACKAGE_PRESET_NAMES[index] ?? "Tier name"}
                  maxLength={30}
                  className="h-8 max-w-[160px] font-medium"
                  aria-label={`Package ${index + 1} name`}
                />
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                  className="rounded-full p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                  aria-label={`Remove ${pkg.name || "package"} tier`}
                >
                  <XIcon className="size-3.5" aria-hidden="true" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1_000_000}
                  step={1}
                  value={pkg.price}
                  onChange={(e) => updatePackage(index, { price: e.target.value })}
                  placeholder="Price (USD)"
                  aria-label={`${pkg.name || "Package"} price`}
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={365}
                  step={1}
                  value={pkg.deliveryDays}
                  onChange={(e) => updatePackage(index, { deliveryDays: e.target.value })}
                  placeholder="Delivery days"
                  aria-label={`${pkg.name || "Package"} delivery days`}
                />
              </div>
              <Input
                value={pkg.description}
                onChange={(e) => updatePackage(index, { description: e.target.value })}
                placeholder="What's included in this tier"
                maxLength={300}
                aria-label={`${pkg.name || "Package"} description`}
              />
              <PackageFeatureInput
                value={pkg.features}
                onChange={(features) => updatePackage(index, { features })}
              />
            </div>
          ))}
        </div>
      ) : null}
    </Field>
  )
}

export function ServiceDialog({
  open,
  onOpenChange,
  service,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  service?: Service
  onSaved: () => void
}) {
  const [coverMedia, setCoverMedia] = useState<MediaAttachment | null>(
    service?.coverImage ? { url: service.coverImage, type: service.coverImageType } : null,
  )
  const [gallery, setGallery] = useState<MediaAttachment[]>(service?.gallery ?? [])
  const [tags, setTags] = useState<string[]>(service?.tags ?? [])
  const [packages, setPackages] = useState<PackageDraft[]>((service?.packages ?? []).map(packageToDraft))
  const [error, setError] = useState<string | null>(null)
  const [insertingImage, setInsertingImage] = useState(false)
  const [isPending, startTransition] = useTransition()
  const descriptionImageInputRef = useRef<HTMLInputElement>(null)

  const editor = useRichTextEditor({
    placeholder: "Describe exactly what a client gets — scope, revisions, what you need from them to start...",
    images: true,
  })
  const [hasHydrated, setHasHydrated] = useState(false)
  if (editor && !hasHydrated) {
    editor.commands.setContent(service?.description ?? "")
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
    uploadServiceMedia(file, "description")
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

    // Drop any tier the owner started but never gave a name + price —
    // an incomplete draft shouldn't block or corrupt the save.
    const cleanPackages = packages
      .filter((pkg) => pkg.name.trim() && pkg.price.trim())
      .map((pkg) => ({
        name: pkg.name.trim(),
        price: Number(pkg.price),
        deliveryDays: Number(pkg.deliveryDays) || 1,
        description: pkg.description.trim(),
        features: pkg.features,
      }))
    formData.set("packages", JSON.stringify(cleanPackages))

    startTransition(async () => {
      const result = service
        ? await updateService(service.id, formData)
        : await addService(formData)
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
          <DialogTitle>{service ? "Edit service" : "Add service"}</DialogTitle>
          <DialogDescription>
            Shown as a listing on your Services tab, like a gig clients can book.
          </DialogDescription>
        </DialogHeader>

        <form key={service?.id ?? "new"} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <CoverMediaPicker value={coverMedia} onChange={setCoverMedia} />

            <Field>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input
                id="title"
                name="title"
                placeholder="e.g. I will design a modern logo"
                defaultValue={service?.title}
                maxLength={80}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="tagline">Tagline</FieldLabel>
              <Input
                id="tagline"
                name="tagline"
                placeholder="A one-line summary of what you're offering"
                defaultValue={service?.tagline}
                maxLength={150}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="startingPrice">Starting price (USD)</FieldLabel>
                <Input
                  id="startingPrice"
                  name="startingPrice"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1_000_000}
                  step={1}
                  placeholder="150"
                  defaultValue={service?.startingPrice}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="deliveryDays">Delivery time (days)</FieldLabel>
                <Input
                  id="deliveryDays"
                  name="deliveryDays"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={365}
                  step={1}
                  placeholder="3"
                  defaultValue={service?.deliveryDays}
                  required
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="category">Category</FieldLabel>
              <Input
                id="category"
                name="category"
                placeholder="Optional — e.g. Graphic Design"
                defaultValue={service?.category ?? ""}
                maxLength={40}
              />
            </Field>

            <TagInput value={tags} onChange={setTags} />

            <PackagesEditor value={packages} onChange={setPackages} />

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
                Optional — what's included, revisions, and what you need from the client to get started.
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
              {service ? "Save changes" : "Add service"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

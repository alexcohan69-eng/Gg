"use client"

import { useRef, useState, useTransition } from "react"
import { upload } from "@vercel/blob/client"
import { toast } from "sonner"
import { CameraIcon, StarIcon, XIcon } from "lucide-react"
import { addTestimonial, updateTestimonial } from "@/app/actions/testimonials"
import type { Testimonial } from "@/lib/testimonials"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { getInitials } from "@/lib/utils"

const MAX_CONTENT = 600

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
    upload(`testimonials/avatar-${file.name}`, file, {
      access: "private",
      handleUploadUrl: "/api/upload/testimonials",
      clientPayload: JSON.stringify({ mime: file.type }),
    })
      .then((blob) => {
        onChange(`/api/media?pathname=${encodeURIComponent(blob.pathname)}`)
      })
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

export function TestimonialDialog({
  open,
  onOpenChange,
  testimonial,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  testimonial?: Testimonial
  onSaved: () => void
}) {
  const [authorName, setAuthorName] = useState(testimonial?.authorName ?? "")
  const [authorAvatar, setAuthorAvatar] = useState<string | null>(testimonial?.authorAvatar ?? null)
  const [rating, setRating] = useState<number | null>(testimonial?.rating ?? null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set("authorAvatar", authorAvatar ?? "")
    formData.set("rating", rating !== null ? String(rating) : "")

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

            <StarRatingInput value={rating} onChange={setRating} />

            <Field>
              <FieldLabel htmlFor="content">Testimonial</FieldLabel>
              <Textarea
                id="content"
                name="content"
                placeholder="What did the client say about working with you?"
                defaultValue={testimonial?.content ?? ""}
                maxLength={MAX_CONTENT}
                rows={5}
                required
              />
              <FieldDescription>Up to {MAX_CONTENT} characters.</FieldDescription>
            </Field>
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

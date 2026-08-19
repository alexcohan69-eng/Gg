"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CameraIcon, XIcon } from "lucide-react"
import { updateProfileImage } from "@/app/actions/profile"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { getInitials } from "@/lib/utils"
import { validateProfileImageFile } from "@/lib/media"

type ImageKind = "avatar" | "banner"

/**
 * Lets the signed-in user set or remove their avatar and banner
 * image. Uploads go straight to /api/upload/profile-image on file
 * select (not deferred to the surrounding settings form's "Save
 * changes"), since a photo picker benefits from immediate feedback
 * and shouldn't be blocked on unrelated fields like bio or website.
 */
export function ProfileImageEditor({
  name,
  avatarUrl,
  bannerUrl,
}: {
  name: string
  avatarUrl: string | null
  bannerUrl: string | null
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [pendingKind, setPendingKind] = useState<ImageKind | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  function handleSelect(kind: ImageKind, file: File | undefined) {
    if (!file) return

    const validationError = validateProfileImageFile(file)
    if (validationError) {
      toast.error(validationError)
      return
    }

    setPendingKind(kind)
    const body = new FormData()
    body.set("file", file)
    body.set("kind", kind)

    fetch("/api/upload/profile-image", { method: "POST", body })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Upload failed.")
        return updateProfileImage(kind, data.url as string)
      })
      .then((result) => {
        if (result && !result.success) {
          throw new Error(result.error ?? "Something went wrong.")
        }
        toast.success(kind === "avatar" ? "Avatar updated" : "Banner updated")
        startTransition(() => router.refresh())
      })
      .catch((error: Error) => {
        toast.error(error.message || "Upload failed. Please try again.")
      })
      .finally(() => setPendingKind(null))
  }

  function handleRemove(kind: ImageKind) {
    setPendingKind(kind)
    updateProfileImage(kind, null)
      .then((result) => {
        if (!result.success) {
          throw new Error(result.error ?? "Something went wrong.")
        }
        toast.success(kind === "avatar" ? "Avatar removed" : "Banner removed")
        startTransition(() => router.refresh())
      })
      .catch((error: Error) => {
        toast.error(error.message || "Something went wrong. Try again.")
      })
      .finally(() => setPendingKind(null))
  }

  const busy = pendingKind !== null

  return (
    <div className="flex flex-col">
      <div
        className="relative h-32 w-full rounded-lg bg-gradient-to-br from-primary/40 via-accent to-primary/10 sm:h-40"
        style={
          bannerUrl
            ? {
                backgroundImage: `url(${bannerUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <div className="absolute right-2 bottom-2 flex gap-2">
          {bannerUrl ? (
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              className="rounded-full"
              disabled={busy}
              onClick={() => handleRemove("banner")}
              aria-label="Remove banner image"
            >
              {pendingKind === "banner" ? <Spinner /> : <XIcon className="size-4" />}
            </Button>
          ) : null}
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            className="rounded-full"
            disabled={busy}
            onClick={() => bannerInputRef.current?.click()}
            aria-label="Change banner image"
          >
            {pendingKind === "banner" ? <Spinner /> : <CameraIcon className="size-4" />}
          </Button>
        </div>
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => {
            handleSelect("banner", e.target.files?.[0])
            e.target.value = ""
          }}
        />
      </div>

      <div className="-mt-8 flex items-end gap-3 px-2 sm:-mt-10">
        <div className="relative">
          <Avatar className="size-16 border-4 border-background sm:size-20">
            <AvatarImage src={avatarUrl ?? undefined} alt={name} />
            <AvatarFallback className="text-xl">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            className="absolute -right-1 -bottom-1 rounded-full"
            disabled={busy}
            onClick={() => avatarInputRef.current?.click()}
            aria-label="Change avatar"
          >
            {pendingKind === "avatar" ? <Spinner /> : <CameraIcon className="size-3.5" />}
          </Button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => {
              handleSelect("avatar", e.target.files?.[0])
              e.target.value = ""
            }}
          />
        </div>

        {avatarUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-1 text-muted-foreground"
            disabled={busy}
            onClick={() => handleRemove("avatar")}
          >
            Remove avatar
          </Button>
        ) : null}
      </div>
    </div>
  )
}

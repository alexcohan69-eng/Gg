"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { toast } from "sonner"
import {
  BriefcaseIcon,
  ExpandIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlayIcon,
  Trash2Icon,
} from "lucide-react"
import { deleteService } from "@/app/actions/services"
import { sanitizePostHtml } from "@/lib/sanitize-html"
import type { Service } from "@/lib/services"
import { ServiceDialog } from "@/components/service-editor"
import { ServicePackages } from "@/components/service-packages"
import { MediaLightbox } from "@/components/media-lightbox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { Spinner } from "@/components/ui/spinner"

/** Full gig-style view for a single service listing. */
export function ServiceDetail({
  service,
  profileIdentifier,
  sellerId,
  sellerName,
  isSelf,
}: {
  service: Service
  profileIdentifier: string
  sellerId: string
  sellerName: string
  isSelf: boolean
}) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleChanged() {
    router.refresh()
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteService(service.id)
      if (!result.success) {
        toast.error(result.error ?? "Couldn't remove service. Try again.")
        return
      }
      toast.success("Service removed")
      router.push(`/profile/${profileIdentifier}/services`)
    })
  }

  // Defense-in-depth: re-sanitize before dangerouslySetInnerHTML, same
  // as the Work tab's case-study render (the server action already
  // sanitizes at write time).
  const descriptionHtml = service.description ? sanitizePostHtml(service.description) : null

  const hasMeta = service.category || service.tags.length > 0

  // The cover doubles as the first lightbox item, followed by the
  // gallery, so opening the banner and paging through the gallery
  // browse the same continuous set of media.
  const lightboxItems = service.coverImage
    ? [{ url: service.coverImage, type: service.coverImageType }, ...service.gallery]
    : service.gallery

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => service.coverImage && setLightboxIndex(0)}
        disabled={!service.coverImage}
        aria-label={service.coverImage ? `View cover media for ${service.title}` : undefined}
        className="group relative aspect-video w-full bg-muted disabled:cursor-default"
      >
        {service.coverImage ? (
          service.coverImageType === "video" ? (
            <>
              <video
                src={service.coverImage}
                autoPlay
                loop
                muted
                playsInline
                disablePictureInPicture
                preload="auto"
                className="absolute inset-0 size-full object-cover"
                aria-hidden="true"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/20 group-hover:opacity-100">
                <span className="flex size-11 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm">
                  <ExpandIcon className="size-4" aria-hidden="true" />
                </span>
              </div>
            </>
          ) : (
            <Image
              src={service.coverImage}
              alt={`Cover ${service.coverImageType === "gif" ? "GIF" : "image"} for ${service.title}`}
              fill
              unoptimized
              priority
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BriefcaseIcon className="size-10 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
        {service.coverImageType === "gif" ? (
          <span className="absolute bottom-2 left-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground backdrop-blur-sm">
            GIF
          </span>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent" aria-hidden="true" />
      </button>

      {/* Overlaps the hero by rounding up and pulling the content up, a
          Fiverr/Upwork-style "listing card floats over the banner" treatment
          that reads as more polished than a hard seam. */}
      <div className="relative z-10 -mt-5 flex flex-col gap-6 rounded-t-3xl bg-background p-4 pb-10 sm:-mt-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">
              {service.category || "Service"}
            </p>
            <h1 className="mt-1.5 font-heading text-2xl font-semibold tracking-tight text-foreground text-balance">
              {service.title}
            </h1>
            <p className="mt-1.5 text-base leading-relaxed text-muted-foreground text-pretty">{service.tagline}</p>
          </div>
          {isSelf ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="shrink-0 rounded-full"
                    aria-label="Service options"
                  >
                    <MoreHorizontalIcon />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <PencilIcon data-icon="inline-start" />
                  Edit service
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2Icon data-icon="inline-start" />
                  Delete service
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <ServicePackages
          packages={service.packages}
          sellerId={sellerId}
          sellerName={sellerName}
          isSelf={isSelf}
          fallbackPrice={service.startingPrice}
          fallbackDeliveryDays={service.deliveryDays}
        />

        {hasMeta ? (
          <div className="flex flex-col gap-3">
            {service.tags.length > 0 ? (
              <div className="flex items-center gap-3">
                <span className="shrink-0 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Focus
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {service.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {descriptionHtml ? (
          <div
            className="prose-post max-w-none text-pretty text-foreground"
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
        ) : null}

        {service.gallery.length > 0 ? (
          <div className="flex flex-col gap-3">
            <h2 className="font-heading text-sm font-semibold tracking-tight text-foreground">
              Gallery
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {service.gallery.map((item, index) => {
                // Cover (if any) occupies lightbox index 0, so gallery
                // items are offset by one in the shared item list.
                const lightboxItemIndex = service.coverImage ? index + 1 : index
                return (
                  <button
                    key={item.url}
                    type="button"
                    onClick={() => setLightboxIndex(lightboxItemIndex)}
                    aria-label={`View ${item.type === "video" ? "video" : item.type === "gif" ? "GIF" : "image"} ${index + 1} for ${service.title}`}
                    className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted"
                  >
                    {item.type === "video" ? (
                      <>
                        <video
                          src={item.url}
                          muted
                          playsInline
                          preload="metadata"
                          className="absolute inset-0 size-full object-cover"
                          aria-hidden="true"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/20">
                          <span className="flex size-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm">
                            <PlayIcon className="size-3.5 fill-current" aria-hidden="true" />
                          </span>
                        </div>
                      </>
                    ) : (
                      <Image
                        src={item.url}
                        alt={`Gallery ${item.type === "gif" ? "GIF" : "image"} ${index + 1} for ${service.title}`}
                        fill
                        unoptimized
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    )}
                    {item.type === "gif" ? (
                      <span className="absolute bottom-1.5 left-1.5 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground backdrop-blur-sm">
                        GIF
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>

      <MediaLightbox
        items={lightboxItems}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
        altPrefix={service.title}
      />

      {isSelf ? (
        <>
          <ServiceDialog open={editOpen} onOpenChange={setEditOpen} service={service} onSaved={handleChanged} />

          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove this service?</AlertDialogTitle>
                <AlertDialogDescription>
                  &ldquo;{service.title}&rdquo; will be removed from your Services tab, along
                  with its cover and gallery images.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={isPending}
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isPending ? <Spinner data-icon="inline-start" /> : null}
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  )
}

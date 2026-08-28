"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { toast } from "sonner"
import {
  ExpandIcon,
  ExternalLinkIcon,
  ImageIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlayIcon,
  RadioTowerIcon,
  Trash2Icon,
} from "lucide-react"
import { deletePortfolioProject } from "@/app/actions/portfolio"
import { sanitizePostHtml } from "@/lib/sanitize-html"
import type { PortfolioProject } from "@/lib/portfolio"
import type { Testimonial } from "@/lib/testimonials"
import { PortfolioProjectDialog } from "@/components/portfolio-project-editor"
import { PublishToFeedDialog } from "@/components/publish-to-feed-dialog"
import { ClientReviewsSection } from "@/components/client-reviews-section"
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

/** Full case-study view for a single portfolio project. */
export function PortfolioProjectDetail({
  project,
  profileIdentifier,
  isSelf,
  testimonials,
}: {
  project: PortfolioProject
  profileIdentifier: string
  isSelf: boolean
  testimonials: Testimonial[]
}) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleChanged() {
    router.refresh()
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePortfolioProject(project.id)
      if (!result.success) {
        toast.error(result.error ?? "Couldn't remove project. Try again.")
        return
      }
      toast.success("Project removed")
      router.push(`/profile/${profileIdentifier}/work`)
    })
  }

  // Defense-in-depth: re-sanitize before dangerouslySetInnerHTML, same
  // as the About page's rich-text render (the server action already
  // sanitizes at write time).
  const descriptionHtml = project.description ? sanitizePostHtml(project.description) : null

  const hasMeta = project.client || project.externalUrl || project.tags.length > 0

  // The cover doubles as the first lightbox item, followed by the
  // gallery, so opening the banner and paging through the gallery
  // browse the same continuous set of media.
  const lightboxItems = project.coverImage
    ? [{ url: project.coverImage, type: project.coverImageType }, ...project.gallery]
    : project.gallery

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => project.coverImage && setLightboxIndex(0)}
        disabled={!project.coverImage}
        aria-label={project.coverImage ? `View cover media for ${project.title}` : undefined}
        className="group relative aspect-video w-full bg-muted disabled:cursor-default"
      >
        {project.coverImage ? (
          project.coverImageType === "video" ? (
            <>
              <video
                src={project.coverImage}
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
              src={project.coverImage}
              alt={`Cover ${project.coverImageType === "gif" ? "GIF" : "image"} for ${project.title}`}
              fill
              unoptimized
              priority
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="size-10 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
        {project.coverImageType === "gif" ? (
          <span className="absolute bottom-2 left-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground backdrop-blur-sm">
            GIF
          </span>
        ) : null}
      </button>

      <div className="flex flex-col gap-6 p-4 pb-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">Case study</p>
            <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-foreground text-balance">
              {project.title}
            </h1>
            <p className="mt-1.5 text-base text-muted-foreground text-pretty">{project.tagline}</p>
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
                    aria-label="Project options"
                  >
                    <MoreHorizontalIcon />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setPublishOpen(true)}>
                  <RadioTowerIcon data-icon="inline-start" />
                  Publish to feed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <PencilIcon data-icon="inline-start" />
                  Edit project
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2Icon data-icon="inline-start" />
                  Delete project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {hasMeta ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-4">
            {project.client ? (
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Client</span>
                <span className="font-medium text-foreground">{project.client}</span>
              </div>
            ) : null}
            {project.tags.length > 0 ? (
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="shrink-0 text-muted-foreground">Focus</span>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {project.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {project.externalUrl ? (
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Link</span>
                <a
                  href={project.externalUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  Visit project
                  <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
                </a>
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

        {project.gallery.length > 0 ? (
          <div className="flex flex-col gap-3">
            <h2 className="font-heading text-sm font-semibold tracking-tight text-foreground">
              Gallery
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {project.gallery.map((item, index) => {
                // Cover (if any) occupies lightbox index 0, so gallery
                // items are offset by one in the shared item list.
                const lightboxItemIndex = project.coverImage ? index + 1 : index
                return (
                  <button
                    key={item.url}
                    type="button"
                    onClick={() => setLightboxIndex(lightboxItemIndex)}
                    aria-label={`View ${item.type === "video" ? "video" : item.type === "gif" ? "GIF" : "image"} ${index + 1} for ${project.title}`}
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
                        alt={`Gallery ${item.type === "gif" ? "GIF" : "image"} ${index + 1} for ${project.title}`}
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

        <ClientReviewsSection testimonials={testimonials} profileIdentifier={profileIdentifier} />
      </div>

      <MediaLightbox
        items={lightboxItems}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
        altPrefix={project.title}
      />

      {isSelf ? (
        <>
          <PortfolioProjectDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            project={project}
            onSaved={handleChanged}
          />

          <PublishToFeedDialog
            open={publishOpen}
            onOpenChange={setPublishOpen}
            item={{
              type: "project",
              id: project.id,
              title: project.title,
              subtitle: project.tagline,
              image: project.coverImage,
              imageType: project.coverImageType,
            }}
          />

          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove this project?</AlertDialogTitle>
                <AlertDialogDescription>
                  &ldquo;{project.title}&rdquo; will be removed from your Work tab, along
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

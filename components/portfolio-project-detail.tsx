"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { toast } from "sonner"
import { ExternalLinkIcon, ImageIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { deletePortfolioProject } from "@/app/actions/portfolio"
import { sanitizePostHtml } from "@/lib/sanitize-html"
import type { PortfolioProject } from "@/lib/portfolio"
import { PortfolioProjectDialog } from "@/components/portfolio-project-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
}: {
  project: PortfolioProject
  profileIdentifier: string
  isSelf: boolean
}) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
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

  return (
    <div className="flex flex-col">
      <div className="relative aspect-video w-full bg-muted">
        {project.coverImage ? (
          <Image
            src={project.coverImage}
            alt={`Cover image for ${project.title}`}
            fill
            unoptimized
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="size-10 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground text-balance">
              {project.title}
            </h1>
            <p className="mt-1 text-base text-muted-foreground text-pretty">{project.tagline}</p>
          </div>
          {isSelf ? (
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setEditOpen(true)}
                aria-label="Edit project"
              >
                <PencilIcon />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
                aria-label="Delete project"
              >
                <Trash2Icon />
              </Button>
            </div>
          ) : null}
        </div>

        {(project.client || project.externalUrl || project.tags.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {project.client ? (
              <Badge variant="secondary">Client: {project.client}</Badge>
            ) : null}
            {project.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
            {project.externalUrl ? (
              <a
                href={project.externalUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Visit project
                <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        )}

        {descriptionHtml ? (
          <div
            className="prose-post max-w-none text-pretty text-foreground"
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
        ) : null}

        {project.gallery.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {project.gallery.map((url, index) => (
              <div key={url} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                <Image
                  src={url}
                  alt={`Gallery image ${index + 1} for ${project.title}`}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {isSelf ? (
        <>
          <PortfolioProjectDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            project={project}
            onSaved={handleChanged}
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

"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BriefcaseIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { deletePortfolioProject, movePortfolioProject } from "@/app/actions/portfolio"
import type { PortfolioProject } from "@/lib/portfolio"
import { PortfolioProjectCard } from "@/components/portfolio-project-card"
import { PortfolioProjectDialog } from "@/components/portfolio-project-editor"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty"
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

const MAX_PROJECTS = 30

function OwnerProjectTile({
  project,
  profileIdentifier,
  isFirst,
  isLast,
  onChanged,
}: {
  project: PortfolioProject
  profileIdentifier: string
  isFirst: boolean
  isLast: boolean
  onChanged: () => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleMove(direction: "up" | "down") {
    startTransition(async () => {
      const result = await movePortfolioProject(project.id, direction)
      if (!result.success) {
        toast.error(result.error ?? "Couldn't reorder. Try again.")
        return
      }
      onChanged()
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePortfolioProject(project.id)
      if (!result.success) {
        toast.error(result.error ?? "Couldn't remove project. Try again.")
        return
      }
      toast.success("Project removed")
      setDeleteOpen(false)
      onChanged()
    })
  }

  return (
    <div className="relative">
      <PortfolioProjectCard project={project} profileIdentifier={profileIdentifier} />
      <div className="absolute right-2 top-2 flex gap-1 rounded-full bg-background/90 p-1 shadow-sm backdrop-blur-sm">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          disabled={isFirst || isPending}
          onClick={() => handleMove("up")}
          aria-label="Move up"
        >
          <ArrowUpIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          disabled={isLast || isPending}
          onClick={() => handleMove("down")}
          aria-label="Move down"
        >
          <ArrowDownIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          disabled={isPending}
          onClick={() => setEditOpen(true)}
          aria-label="Edit project"
        >
          <PencilIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full text-destructive hover:text-destructive"
          disabled={isPending}
          onClick={() => setDeleteOpen(true)}
          aria-label="Delete project"
        >
          <Trash2Icon />
        </Button>
      </div>

      <PortfolioProjectDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
        onSaved={onChanged}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this project?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{project.title}&rdquo; will be removed from your Work tab, along with
              its cover and gallery images.
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
    </div>
  )
}

/**
 * The Work tab's content: a responsive grid of case-study cards.
 * Owners get an add trigger plus per-card move/edit/delete controls
 * layered over the same public-facing card; other viewers just see
 * the plain grid.
 */
export function PortfolioGrid({
  projects,
  profileIdentifier,
  isSelf,
  name,
}: {
  projects: PortfolioProject[]
  profileIdentifier: string
  isSelf: boolean
  name: string
}) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)

  function handleChanged() {
    router.refresh()
  }

  if (projects.length === 0) {
    return (
      <div className="p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BriefcaseIcon />
            </EmptyMedia>
            <EmptyTitle>No projects yet</EmptyTitle>
            <EmptyDescription>
              {isSelf
                ? "Add your first case study to start building your portfolio."
                : `${name} hasn't added any projects yet.`}
            </EmptyDescription>
          </EmptyHeader>
          {isSelf ? (
            <EmptyContent>
              <Button type="button" onClick={() => setAddOpen(true)}>
                <PlusIcon data-icon="inline-start" />
                Add project
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>

        <PortfolioProjectDialog open={addOpen} onOpenChange={setAddOpen} onSaved={handleChanged} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {isSelf ? (
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setAddOpen(true)}
            disabled={projects.length >= MAX_PROJECTS}
          >
            <PlusIcon data-icon="inline-start" />
            Add project
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {projects.map((project, index) =>
          isSelf ? (
            <OwnerProjectTile
              key={project.id}
              project={project}
              profileIdentifier={profileIdentifier}
              isFirst={index === 0}
              isLast={index === projects.length - 1}
              onChanged={handleChanged}
            />
          ) : (
            <PortfolioProjectCard
              key={project.id}
              project={project}
              profileIdentifier={profileIdentifier}
            />
          ),
        )}
      </div>

      <PortfolioProjectDialog open={addOpen} onOpenChange={setAddOpen} onSaved={handleChanged} />
    </div>
  )
}

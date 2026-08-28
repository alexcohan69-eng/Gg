"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  MessageSquareQuoteIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { deleteTestimonial, moveTestimonial } from "@/app/actions/testimonials"
import type { Testimonial } from "@/lib/testimonials"
import { TestimonialCard } from "@/components/testimonial-card"
import { TestimonialDialog } from "@/components/testimonial-editor"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

export const MAX_TESTIMONIALS = 30

function OwnerTestimonialTile({
  testimonial,
  isFirst,
  isLast,
  onChanged,
  serviceOptions,
  projectOptions,
}: {
  testimonial: Testimonial
  isFirst: boolean
  isLast: boolean
  onChanged: () => void
  serviceOptions: { id: string; title: string }[]
  projectOptions: { id: string; title: string }[]
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleMove(direction: "up" | "down") {
    startTransition(async () => {
      const result = await moveTestimonial(testimonial.id, direction)
      if (!result.success) {
        toast.error(result.error ?? "Couldn't reorder. Try again.")
        return
      }
      onChanged()
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTestimonial(testimonial.id)
      if (!result.success) {
        toast.error(result.error ?? "Couldn't remove testimonial. Try again.")
        return
      }
      toast.success("Testimonial removed")
      setDeleteOpen(false)
      onChanged()
    })
  }

  return (
    <div className="relative">
      <TestimonialCard testimonial={testimonial} />

      <div className="absolute top-3 right-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur-sm hover:bg-background"
                disabled={isPending}
                aria-label="Testimonial options"
              >
                {isPending ? <Spinner /> : <MoreHorizontalIcon />}
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={isFirst || isPending} onClick={() => handleMove("up")}>
              <ArrowUpIcon data-icon="inline-start" />
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isLast || isPending} onClick={() => handleMove("down")}>
              <ArrowDownIcon data-icon="inline-start" />
              Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={isPending} onClick={() => setEditOpen(true)}>
              <PencilIcon data-icon="inline-start" />
              Edit testimonial
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" disabled={isPending} onClick={() => setDeleteOpen(true)}>
              <Trash2Icon data-icon="inline-start" />
              Delete testimonial
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <TestimonialDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        testimonial={testimonial}
        onSaved={onChanged}
        serviceOptions={serviceOptions}
        projectOptions={projectOptions}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this testimonial?</AlertDialogTitle>
            <AlertDialogDescription>
              The quote from &ldquo;{testimonial.authorName}&rdquo; will be removed from your Testimonials tab.
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
 * The Testimonials tab's content: a responsive grid of client-quote
 * cards. Owners get an add trigger plus per-card move/edit/delete
 * controls layered over the same public-facing card; other viewers
 * just see the plain grid. Mirrors ServiceGrid/PortfolioGrid.
 */
export function TestimonialGrid({
  testimonials,
  isSelf,
  name,
  serviceOptions = [],
  projectOptions = [],
}: {
  testimonials: Testimonial[]
  isSelf: boolean
  name: string
  serviceOptions?: { id: string; title: string }[]
  projectOptions?: { id: string; title: string }[]
}) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)

  function handleChanged() {
    router.refresh()
  }

  if (testimonials.length === 0) {
    return (
      <div className="p-4">
        <Empty className="border border-dashed border-border bg-card/50 py-10">
          <EmptyHeader>
            <EmptyMedia
              variant="icon"
              className="size-12 rounded-2xl bg-primary/10 text-primary [&_svg:not([class*='size-'])]:size-5"
            >
              <MessageSquareQuoteIcon />
            </EmptyMedia>
            <EmptyTitle className="text-base">
              {isSelf ? "Show off what clients say" : "No testimonials yet"}
            </EmptyTitle>
            <EmptyDescription>
              {isSelf
                ? "Add a quote from a happy client to build trust with people visiting your profile."
                : `${name} hasn't added any testimonials yet.`}
            </EmptyDescription>
          </EmptyHeader>
          {isSelf ? (
            <EmptyContent>
              <Button type="button" onClick={() => setAddOpen(true)}>
                <PlusIcon data-icon="inline-start" />
                Add your first testimonial
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>

        <TestimonialDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onSaved={handleChanged}
          serviceOptions={serviceOptions}
          projectOptions={projectOptions}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">Testimonials</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {testimonials.length} {testimonials.length === 1 ? "testimonial" : "testimonials"}
            {isSelf ? ` · ${MAX_TESTIMONIALS - testimonials.length} remaining` : null}
          </p>
        </div>
        {isSelf ? (
          <Button
            type="button"
            size="sm"
            onClick={() => setAddOpen(true)}
            disabled={testimonials.length >= MAX_TESTIMONIALS}
          >
            <PlusIcon data-icon="inline-start" />
            Add testimonial
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {testimonials.map((testimonial, index) =>
          isSelf ? (
            <OwnerTestimonialTile
              key={testimonial.id}
              testimonial={testimonial}
              isFirst={index === 0}
              isLast={index === testimonials.length - 1}
              onChanged={handleChanged}
              serviceOptions={serviceOptions}
              projectOptions={projectOptions}
            />
          ) : (
            <TestimonialCard key={testimonial.id} testimonial={testimonial} />
          ),
        )}
      </div>

      <TestimonialDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={handleChanged}
        serviceOptions={serviceOptions}
        projectOptions={projectOptions}
      />
    </div>
  )
}

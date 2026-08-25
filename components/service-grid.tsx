"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BriefcaseIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { deleteService, moveService } from "@/app/actions/services"
import type { Service } from "@/lib/services"
import { ServiceCard } from "@/components/service-card"
import { ServiceDialog } from "@/components/service-editor"
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

export const MAX_SERVICES = 30

function OwnerServiceTile({
  service,
  profileIdentifier,
  isFirst,
  isLast,
  onChanged,
}: {
  service: Service
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
      const result = await moveService(service.id, direction)
      if (!result.success) {
        toast.error(result.error ?? "Couldn't reorder. Try again.")
        return
      }
      onChanged()
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteService(service.id)
      if (!result.success) {
        toast.error(result.error ?? "Couldn't remove service. Try again.")
        return
      }
      toast.success("Service removed")
      setDeleteOpen(false)
      onChanged()
    })
  }

  return (
    <div className="relative">
      <ServiceCard service={service} profileIdentifier={profileIdentifier} />

      <div className="absolute top-2.5 right-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur-sm hover:bg-background"
                disabled={isPending}
                aria-label="Service options"
              >
                {isPending ? <Spinner /> : <MoreHorizontalIcon />}
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={isFirst || isPending}
              onClick={() => handleMove("up")}
            >
              <ArrowUpIcon data-icon="inline-start" />
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isLast || isPending}
              onClick={() => handleMove("down")}
            >
              <ArrowDownIcon data-icon="inline-start" />
              Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={isPending} onClick={() => setEditOpen(true)}>
              <PencilIcon data-icon="inline-start" />
              Edit service
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={isPending}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2Icon data-icon="inline-start" />
              Delete service
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ServiceDialog open={editOpen} onOpenChange={setEditOpen} service={service} onSaved={onChanged} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this service?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{service.title}&rdquo; will be removed from your Services tab, along with
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
 * The Services tab's content: a responsive grid of gig-style listing
 * cards. Owners get an add trigger plus per-card move/edit/delete
 * controls layered over the same public-facing card; other viewers
 * just see the plain grid. Mirrors PortfolioGrid.
 */
export function ServiceGrid({
  services,
  profileIdentifier,
  isSelf,
  name,
}: {
  services: Service[]
  profileIdentifier: string
  isSelf: boolean
  name: string
}) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)

  function handleChanged() {
    router.refresh()
  }

  if (services.length === 0) {
    return (
      <div className="p-4">
        <Empty className="border border-dashed border-border bg-card/50 py-10">
          <EmptyHeader>
            <EmptyMedia
              variant="icon"
              className="size-12 rounded-2xl bg-primary/10 text-primary [&_svg:not([class*='size-'])]:size-5"
            >
              <BriefcaseIcon />
            </EmptyMedia>
            <EmptyTitle className="text-base">
              {isSelf ? "List what you offer" : "No services yet"}
            </EmptyTitle>
            <EmptyDescription>
              {isSelf
                ? "Add a service with a price and delivery time so clients know exactly what to book."
                : `${name} hasn't listed any services yet.`}
            </EmptyDescription>
          </EmptyHeader>
          {isSelf ? (
            <EmptyContent>
              <Button type="button" onClick={() => setAddOpen(true)}>
                <PlusIcon data-icon="inline-start" />
                Add your first service
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>

        <ServiceDialog open={addOpen} onOpenChange={setAddOpen} onSaved={handleChanged} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {services.length} {services.length === 1 ? "service" : "services"}
          {isSelf ? ` · ${MAX_SERVICES - services.length} remaining` : null}
        </p>
        {isSelf ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAddOpen(true)}
            disabled={services.length >= MAX_SERVICES}
          >
            <PlusIcon data-icon="inline-start" />
            Add service
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {services.map((service, index) =>
          isSelf ? (
            <OwnerServiceTile
              key={service.id}
              service={service}
              profileIdentifier={profileIdentifier}
              isFirst={index === 0}
              isLast={index === services.length - 1}
              onChanged={handleChanged}
            />
          ) : (
            <ServiceCard key={service.id} service={service} profileIdentifier={profileIdentifier} />
          ),
        )}
      </div>

      <ServiceDialog open={addOpen} onOpenChange={setAddOpen} onSaved={handleChanged} />
    </div>
  )
}

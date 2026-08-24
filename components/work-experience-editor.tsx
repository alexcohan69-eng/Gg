"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import {
  addWorkExperience,
  deleteWorkExperience,
  moveWorkExperience,
  updateWorkExperience,
} from "@/app/actions/career"
import type { WorkExperienceEntry } from "@/lib/career"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
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

const MAX_ENTRIES = 20

function ExperienceFormFields({
  entry,
  isCurrent,
  onCurrentChange,
}: {
  entry?: WorkExperienceEntry
  isCurrent: boolean
  onCurrentChange: (checked: boolean) => void
}) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="role">Role</FieldLabel>
        <Input id="role" name="role" defaultValue={entry?.role} maxLength={80} required />
      </Field>
      <Field>
        <FieldLabel htmlFor="company">Company</FieldLabel>
        <Input
          id="company"
          name="company"
          defaultValue={entry?.company}
          maxLength={80}
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel htmlFor="startDate">Start date</FieldLabel>
          <Input
            id="startDate"
            name="startDate"
            placeholder="e.g. Jan 2022"
            defaultValue={entry?.startDate}
            maxLength={30}
            required
          />
        </Field>
        <Field data-disabled={isCurrent}>
          <FieldLabel htmlFor="endDate">End date</FieldLabel>
          <Input
            id="endDate"
            name="endDate"
            placeholder="e.g. Mar 2024"
            defaultValue={entry?.endDate ?? ""}
            maxLength={30}
            disabled={isCurrent}
          />
        </Field>
      </div>
      {/*
        The visible Checkbox is purely for interaction; whether Base UI
        syncs a native input for it is an internal detail we don't want
        to depend on. A plain hidden input driven by the same state is
        what the server action's `formData.get("isCurrent")` actually
        reads, so it works regardless.
      */}
      <input type="hidden" name="isCurrent" value={isCurrent ? "on" : ""} />
      <FieldLabel htmlFor="isCurrent" className="flex-row items-center">
        <Checkbox
          id="isCurrent"
          checked={isCurrent}
          onCheckedChange={(checked) => onCurrentChange(checked === true)}
        />
        I currently work here
      </FieldLabel>
      <Field>
        <FieldLabel htmlFor="description">Description</FieldLabel>
        <Textarea
          id="description"
          name="description"
          defaultValue={entry?.description ?? ""}
          maxLength={500}
          placeholder="What did you work on?"
          className="min-h-20"
        />
        <FieldDescription>Optional — a couple sentences is plenty.</FieldDescription>
      </Field>
    </FieldGroup>
  )
}

function ExperienceDialog({
  open,
  onOpenChange,
  entry,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry?: WorkExperienceEntry
  onSaved: () => void
}) {
  const [isCurrent, setIsCurrent] = useState(entry?.isCurrent ?? false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = entry
        ? await updateWorkExperience(entry.id, formData)
        : await addWorkExperience(formData)
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry ? "Edit role" : "Add role"}</DialogTitle>
          <DialogDescription>
            Shown in the experience timeline on your About page.
          </DialogDescription>
        </DialogHeader>

        <form
          key={entry?.id ?? "new"}
          action={handleSubmit}
          className="flex flex-col gap-4"
        >
          <ExperienceFormFields
            entry={entry}
            isCurrent={isCurrent}
            onCurrentChange={setIsCurrent}
          />
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
              {entry ? "Save changes" : "Add role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ExperienceRow({
  entry,
  isFirst,
  isLast,
  onChanged,
}: {
  entry: WorkExperienceEntry
  isFirst: boolean
  isLast: boolean
  onChanged: () => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleMove(direction: "up" | "down") {
    startTransition(async () => {
      const result = await moveWorkExperience(entry.id, direction)
      if (!result.success) {
        toast.error(result.error ?? "Couldn't reorder. Try again.")
        return
      }
      onChanged()
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteWorkExperience(entry.id)
      if (!result.success) {
        toast.error(result.error ?? "Couldn't remove role. Try again.")
        return
      }
      toast.success("Role removed")
      setDeleteOpen(false)
      onChanged()
    })
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{entry.role}</p>
        <p className="text-sm text-muted-foreground">{entry.company}</p>
        <p className="text-xs text-muted-foreground">
          {entry.startDate} – {entry.isCurrent ? "Present" : entry.endDate || "—"}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
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
          onClick={() => setEditOpen(true)}
          aria-label="Edit role"
        >
          <PencilIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setDeleteOpen(true)}
          aria-label="Delete role"
        >
          <Trash2Icon />
        </Button>
      </div>

      <ExperienceDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        entry={entry}
        onSaved={onChanged}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this role?</AlertDialogTitle>
            <AlertDialogDescription>
              {entry.role} at {entry.company} will be removed from your
              experience timeline.
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
    </li>
  )
}

export function WorkExperienceEditor({
  experience,
}: {
  experience: WorkExperienceEntry[]
}) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)

  function handleChanged() {
    router.refresh()
  }

  return (
    <div className="flex max-w-lg flex-col gap-4">
      {experience.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No roles added yet. Add the positions that show your career history.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {experience.map((entry, index) => (
            <ExperienceRow
              key={entry.id}
              entry={entry}
              isFirst={index === 0}
              isLast={index === experience.length - 1}
              onChanged={handleChanged}
            />
          ))}
        </ol>
      )}

      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setAddOpen(true)}
          disabled={experience.length >= MAX_ENTRIES}
        >
          <PlusIcon data-icon="inline-start" />
          Add role
        </Button>
      </div>

      <ExperienceDialog open={addOpen} onOpenChange={setAddOpen} onSaved={handleChanged} />
    </div>
  )
}

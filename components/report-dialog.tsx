"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { FlagIcon } from "lucide-react"
import { reportPost, reportUser } from "@/app/actions/reports"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  FieldSet,
  FieldLegend,
  FieldLabel,
  Field,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { REPORT_REASONS, type ReportReason } from "@/lib/moderation"

/**
 * Shared report modal for both posts and user profiles. Renders as a
 * controlled `Dialog` so callers (a `DropdownMenuItem` in `PostCard`,
 * a button on `ProfileHeader`) can open it without the trigger and
 * content fighting over base-ui's dropdown/dialog focus handling.
 */
export function ReportDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target:
    | { type: "post"; id: string }
    | { type: "user"; id: string; name: string }
}) {
  const [reason, setReason] = useState<ReportReason>("spam")
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    startTransition(async () => {
      const result =
        target.type === "post"
          ? await reportPost(target.id, reason)
          : await reportUser(target.id, reason)

      if (!result.success) {
        toast.error(result.error ?? "Couldn't submit report.")
        return
      }

      toast.success("Thanks, we'll take a look.")
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
          <DialogTitle>
            {target.type === "post" ? "Report post" : `Report ${target.name}`}
          </DialogTitle>
          <DialogDescription>
            Tell us what&apos;s wrong. Your report is anonymous to the
            person you&apos;re reporting.
          </DialogDescription>
        </DialogHeader>

        <FieldSet>
          <FieldLegend variant="label" className="sr-only">
            Reason
          </FieldLegend>
          <RadioGroup
            value={reason}
            onValueChange={(value) => setReason(value as ReportReason)}
          >
            {REPORT_REASONS.map((option) => (
              <FieldLabel key={option.value} htmlFor={`reason-${option.value}`}>
                <Field orientation="horizontal">
                  <RadioGroupItem
                    id={`reason-${option.value}`}
                    value={option.value}
                  />
                  {option.label}
                </Field>
              </FieldLabel>
            ))}
          </RadioGroup>
        </FieldSet>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={isPending} onClick={handleSubmit}>
            {isPending ? <Spinner data-icon="inline-start" /> : <FlagIcon data-icon="inline-start" />}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

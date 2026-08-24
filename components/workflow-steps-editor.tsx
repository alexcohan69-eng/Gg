"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { updateWorkflowSteps } from "@/app/actions/career"
import type { WorkflowStep } from "@/lib/db/schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"

const MAX_STEPS = 8

export function WorkflowStepsEditor({ steps }: { steps: WorkflowStep[] }) {
  const router = useRouter()
  const [items, setItems] = useState<WorkflowStep[]>(
    steps.length > 0 ? steps : [],
  )
  const [isPending, startTransition] = useTransition()
  const isDirty = JSON.stringify(items) !== JSON.stringify(steps)

  function updateStep(index: number, patch: Partial<WorkflowStep>) {
    setItems(items.map((step, i) => (i === index ? { ...step, ...patch } : step)))
  }

  function addStep() {
    if (items.length >= MAX_STEPS) {
      toast.error(`You can list up to ${MAX_STEPS} steps.`)
      return
    }
    setItems([...items, { title: "", description: "" }])
  }

  function removeStep(index: number) {
    setItems(items.filter((_, i) => i !== index))
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateWorkflowSteps(items)
      if (!result.success) {
        toast.error(result.error ?? "Something went wrong. Try again.")
        return
      }
      toast.success("Workflow updated")
      router.refresh()
    })
  }

  return (
    <div className="flex max-w-lg flex-col gap-4">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No workflow steps added yet. Describe how you take a project from kickoff
          to delivery.
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {items.map((step, index) => (
            <li
              key={index}
              className="flex flex-col gap-3 rounded-lg border border-border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeStep(index)}
                  aria-label={`Remove step ${index + 1}`}
                >
                  <Trash2Icon />
                </Button>
              </div>
              <Field>
                <FieldLabel htmlFor={`step-title-${index}`} className="sr-only">
                  Step title
                </FieldLabel>
                <Input
                  id={`step-title-${index}`}
                  value={step.title}
                  onChange={(e) => updateStep(index, { title: e.target.value })}
                  placeholder="e.g. Discovery call"
                  maxLength={60}
                />
              </Field>
              <Field>
                <FieldLabel
                  htmlFor={`step-description-${index}`}
                  className="sr-only"
                >
                  Step description
                </FieldLabel>
                <Textarea
                  id={`step-description-${index}`}
                  value={step.description}
                  onChange={(e) =>
                    updateStep(index, { description: e.target.value })
                  }
                  placeholder="What happens at this stage?"
                  maxLength={200}
                  className="min-h-14"
                />
              </Field>
            </li>
          ))}
        </ol>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={addStep}
          disabled={items.length >= MAX_STEPS}
        >
          <PlusIcon data-icon="inline-start" />
          Add step
        </Button>
        <FieldDescription>
          {items.length}/{MAX_STEPS}
        </FieldDescription>
      </div>

      <div className="flex justify-end">
        <Button type="button" disabled={isPending || !isDirty} onClick={handleSave}>
          {isPending ? <Spinner data-icon="inline-start" /> : null}
          Save changes
        </Button>
      </div>
    </div>
  )
}

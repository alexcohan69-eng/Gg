"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updateCareerStats } from "@/app/actions/career"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"

type CareerStats = {
  yearsExperience: number | null
  totalClients: number | null
  totalProjects: number | null
}

export function CareerStatsForm({ stats }: { stats: CareerStats }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await updateCareerStats(formData)
      if (!result.success) {
        setError(result.error ?? "Something went wrong. Try again.")
        return
      }
      toast.success("Career highlights updated")
      router.refresh()
    })
  }

  return (
    <form
      key={`${stats.yearsExperience}-${stats.totalClients}-${stats.totalProjects}`}
      action={handleSubmit}
      className="max-w-lg"
    >
      <FieldGroup>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="yearsExperience">Years of experience</FieldLabel>
            <Input
              id="yearsExperience"
              name="yearsExperience"
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              placeholder="e.g. 6"
              defaultValue={stats.yearsExperience ?? ""}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="totalClients">Clients served</FieldLabel>
            <Input
              id="totalClients"
              name="totalClients"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="e.g. 40"
              defaultValue={stats.totalClients ?? ""}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="totalProjects">Projects completed</FieldLabel>
            <Input
              id="totalProjects"
              name="totalProjects"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="e.g. 120"
              defaultValue={stats.totalProjects ?? ""}
            />
          </Field>
        </div>

        {error ? <FieldError>{error}</FieldError> : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? <Spinner data-icon="inline-start" /> : null}
            Save changes
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}

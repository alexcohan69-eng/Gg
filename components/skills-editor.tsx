"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { XIcon } from "lucide-react"
import { updateSkills } from "@/app/actions/career"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldDescription } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"

const MAX_SKILLS = 24

export function SkillsEditor({ skills }: { skills: string[] }) {
  const router = useRouter()
  const [items, setItems] = useState(skills)
  const [draft, setDraft] = useState("")
  const [isPending, startTransition] = useTransition()
  const isDirty = JSON.stringify(items) !== JSON.stringify(skills)

  function addSkill() {
    const value = draft.trim()
    if (!value) return
    if (items.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setDraft("")
      return
    }
    if (items.length >= MAX_SKILLS) {
      toast.error(`You can list up to ${MAX_SKILLS} skills.`)
      return
    }
    setItems([...items, value])
    setDraft("")
  }

  function removeSkill(skill: string) {
    setItems(items.filter((item) => item !== skill))
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateSkills(items)
      if (!result.success) {
        toast.error(result.error ?? "Something went wrong. Try again.")
        return
      }
      toast.success("Skills updated")
      router.refresh()
    })
  }

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <Field>
        <div className="flex flex-wrap gap-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No skills added yet.
            </p>
          ) : (
            items.map((skill) => (
              <Badge key={skill} variant="secondary" className="h-7 gap-1 px-3">
                {skill}
                <button
                  type="button"
                  onClick={() => removeSkill(skill)}
                  className="rounded-full p-0.5 hover:bg-foreground/10"
                  aria-label={`Remove ${skill}`}
                >
                  <XIcon className="size-3" aria-hidden="true" />
                </button>
              </Badge>
            ))
          )}
        </div>
      </Field>

      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addSkill()
            }
          }}
          placeholder="e.g. Brand strategy"
          maxLength={30}
        />
        <Button type="button" variant="outline" onClick={addSkill}>
          Add
        </Button>
      </div>
      <FieldDescription>
        Press Enter or click Add after typing a skill. {items.length}/{MAX_SKILLS}
      </FieldDescription>

      <div className="flex justify-end">
        <Button type="button" disabled={isPending || !isDirty} onClick={handleSave}>
          {isPending ? <Spinner data-icon="inline-start" /> : null}
          Save changes
        </Button>
      </div>
    </div>
  )
}

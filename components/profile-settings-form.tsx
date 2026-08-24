"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { updateProfile } from "@/app/actions/profile"
import type { WorkflowStep, WorkExperience } from "@/lib/db/schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"

type Profile = {
  name: string
  username: string | null
  bio: string | null
  website: string | null
  location: string | null
  profession: string | null
  totalClients: number | null
  totalProjects: number | null
  yearsExperience: number | null
  skills: string[]
  workflow: WorkflowStep[]
  workExperience: WorkExperience[]
}

export function ProfileSettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [bioLength, setBioLength] = useState(profile.bio?.length ?? 0)

  // Repeatable sections are controlled so the user can add/remove rows.
  // They're serialized to hidden inputs as JSON on submit.
  const [workflow, setWorkflow] = useState<WorkflowStep[]>(
    profile.workflow.length ? profile.workflow : [],
  )
  const [workExperience, setWorkExperience] = useState<WorkExperience[]>(
    profile.workExperience.length ? profile.workExperience : [],
  )

  function handleSubmit(formData: FormData) {
    setError(null)
    // Attach the controlled repeatable sections as JSON payloads.
    formData.set("workflow", JSON.stringify(workflow))
    formData.set("workExperience", JSON.stringify(workExperience))
    startTransition(async () => {
      const result = await updateProfile(formData)
      if (!result.success) {
        setError(result.error ?? "Something went wrong. Try again.")
        return
      }
      toast.success("Profile updated")
      router.refresh()
    })
  }

  function updateWorkflow(index: number, patch: Partial<WorkflowStep>) {
    setWorkflow((prev) =>
      prev.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    )
  }

  function updateWorkExperience(index: number, patch: Partial<WorkExperience>) {
    setWorkExperience((prev) =>
      prev.map((job, i) => (i === index ? { ...job, ...patch } : job)),
    )
  }

  return (
    <form
      // Remount with fresh defaultValues after a successful save + router.refresh()
      // instead of mutating an already-mounted uncontrolled input's defaultValue.
      key={`${profile.name}-${profile.username}-${profile.bio}-${profile.location}-${profile.website}-${profile.profession}`}
      action={handleSubmit}
      className="max-w-lg"
    >
      <FieldGroup>
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            name="name"
            defaultValue={profile.name}
            maxLength={50}
            required
            aria-invalid={!!error}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <Input
            id="username"
            name="username"
            defaultValue={profile.username ?? ""}
            maxLength={20}
            pattern="[a-zA-Z0-9_]{3,20}"
            required
          />
          <FieldDescription>
            3-20 characters: letters, numbers, and underscores only.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="bio">Bio</FieldLabel>
          <Input
            id="bio"
            name="bio"
            defaultValue={profile.bio ?? ""}
            maxLength={160}
            onChange={(e) => setBioLength(e.target.value.length)}
          />
          <FieldDescription>{bioLength}/160</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="location">Location</FieldLabel>
          <Input
            id="location"
            name="location"
            defaultValue={profile.location ?? ""}
            maxLength={30}
          />
        </Field>

        <Field data-invalid={!!error}>
          <FieldLabel htmlFor="website">Website</FieldLabel>
          <Input
            id="website"
            name="website"
            type="url"
            placeholder="https://example.com"
            defaultValue={profile.website ?? ""}
            aria-invalid={!!error}
          />
        </Field>
      </FieldGroup>

      <Separator className="my-8" />

      <div className="mb-4">
        <h3 className="font-heading text-base font-semibold text-foreground">
          Professional overview
        </h3>
        <p className="text-sm text-muted-foreground">
          Powers the career sections on your About page.
        </p>
      </div>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="profession">Headline</FieldLabel>
          <Input
            id="profession"
            name="profession"
            placeholder="e.g. Senior Product Designer"
            defaultValue={profile.profession ?? ""}
            maxLength={80}
          />
          <FieldDescription>Your role or professional title.</FieldDescription>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="yearsExperience">Years experience</FieldLabel>
            <Input
              id="yearsExperience"
              name="yearsExperience"
              type="number"
              min={0}
              max={100000}
              placeholder="8"
              defaultValue={profile.yearsExperience ?? ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="totalClients">Total clients</FieldLabel>
            <Input
              id="totalClients"
              name="totalClients"
              type="number"
              min={0}
              max={100000}
              placeholder="120"
              defaultValue={profile.totalClients ?? ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="totalProjects">Total projects</FieldLabel>
            <Input
              id="totalProjects"
              name="totalProjects"
              type="number"
              min={0}
              max={100000}
              placeholder="340"
              defaultValue={profile.totalProjects ?? ""}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="skills">Skills</FieldLabel>
          <Textarea
            id="skills"
            name="skills"
            rows={3}
            placeholder="Figma, Design systems, Prototyping, User research"
            defaultValue={profile.skills.join(", ")}
          />
          <FieldDescription>
            Separate each skill with a comma or new line (up to 40).
          </FieldDescription>
        </Field>
      </FieldGroup>

      {/* Workflow — repeatable ordered steps */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Workflow</h4>
            <p className="text-xs text-muted-foreground">
              How you take work from start to finish.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() =>
              setWorkflow((prev) => [...prev, { title: "", description: "" }])
            }
            disabled={workflow.length >= 12}
          >
            <PlusIcon className="size-4" aria-hidden="true" />
            Add step
          </Button>
        </div>

        {workflow.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            No workflow steps yet. Add one to outline your process.
          </p>
        ) : (
          <ol className="flex flex-col gap-4">
            {workflow.map((step, index) => (
              <li
                key={index}
                className="rounded-xl border border-border bg-muted/30 p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Step {index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      setWorkflow((prev) => prev.filter((_, i) => i !== index))
                    }
                    aria-label={`Remove step ${index + 1}`}
                  >
                    <Trash2Icon className="size-4" aria-hidden="true" />
                  </Button>
                </div>
                <div className="flex flex-col gap-2">
                  <Input
                    aria-label={`Step ${index + 1} title`}
                    placeholder="Discovery"
                    value={step.title}
                    maxLength={80}
                    onChange={(e) =>
                      updateWorkflow(index, { title: e.target.value })
                    }
                  />
                  <Textarea
                    aria-label={`Step ${index + 1} description`}
                    placeholder="Describe what happens in this phase."
                    rows={2}
                    value={step.description}
                    maxLength={300}
                    onChange={(e) =>
                      updateWorkflow(index, { description: e.target.value })
                    }
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Work experience — repeatable history */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              Work experience
            </h4>
            <p className="text-xs text-muted-foreground">
              Roles across your career, most recent first.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() =>
              setWorkExperience((prev) => [
                ...prev,
                { role: "", company: "", period: "", description: "" },
              ])
            }
            disabled={workExperience.length >= 20}
          >
            <PlusIcon className="size-4" aria-hidden="true" />
            Add role
          </Button>
        </div>

        {workExperience.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            No work history yet. Add a role to build your timeline.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {workExperience.map((job, index) => (
              <li
                key={index}
                className="rounded-xl border border-border bg-muted/30 p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Role {index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      setWorkExperience((prev) =>
                        prev.filter((_, i) => i !== index),
                      )
                    }
                    aria-label={`Remove role ${index + 1}`}
                  >
                    <Trash2Icon className="size-4" aria-hidden="true" />
                  </Button>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input
                      aria-label={`Role ${index + 1} title`}
                      placeholder="Role / title"
                      value={job.role}
                      maxLength={100}
                      onChange={(e) =>
                        updateWorkExperience(index, { role: e.target.value })
                      }
                    />
                    <Input
                      aria-label={`Role ${index + 1} company`}
                      placeholder="Company"
                      value={job.company}
                      maxLength={100}
                      onChange={(e) =>
                        updateWorkExperience(index, { company: e.target.value })
                      }
                    />
                  </div>
                  <Input
                    aria-label={`Role ${index + 1} period`}
                    placeholder="2021 — Present"
                    value={job.period}
                    maxLength={60}
                    onChange={(e) =>
                      updateWorkExperience(index, { period: e.target.value })
                    }
                  />
                  <Textarea
                    aria-label={`Role ${index + 1} description`}
                    placeholder="What you did and what you achieved."
                    rows={2}
                    value={job.description}
                    maxLength={500}
                    onChange={(e) =>
                      updateWorkExperience(index, {
                        description: e.target.value,
                      })
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? (
        <FieldError className="mt-6">{error}</FieldError>
      ) : null}

      <div className="mt-8 flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Spinner data-icon="inline-start" /> : null}
          Save changes
        </Button>
      </div>
    </form>
  )
}

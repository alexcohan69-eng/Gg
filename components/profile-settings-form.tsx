"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updateProfile } from "@/app/actions/profile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
}

export function ProfileSettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [bioLength, setBioLength] = useState(profile.bio?.length ?? 0)

  function handleSubmit(formData: FormData) {
    setError(null)
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

  return (
    <form
      // Remount with fresh defaultValues after a successful save + router.refresh()
      // instead of mutating an already-mounted uncontrolled input's defaultValue.
      key={`${profile.name}-${profile.username}-${profile.bio}-${profile.location}-${profile.website}`}
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
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>

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

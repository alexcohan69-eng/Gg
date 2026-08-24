import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getSessionWithRetry } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { ProfileImageEditor } from "@/components/profile-image-editor"
import { ProfileSettingsForm } from "@/components/profile-settings-form"
import { SignOutButton } from "@/components/sign-out-button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { WorkflowStep, WorkExperience } from "@/lib/db/schema"

export const metadata: Metadata = {
  title: "Settings",
}

export default async function SettingsPage() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const user = session.user as typeof session.user & {
    username?: string | null
    bio?: string | null
    website?: string | null
    location?: string | null
    bannerImage?: string | null
    profession?: string | null
    totalClients?: number | null
    totalProjects?: number | null
    yearsExperience?: number | null
    skills?: string[] | null
    workflow?: WorkflowStep[] | null
    workExperience?: WorkExperience[] | null
  }

  return (
    <div className="flex flex-col">
      <PageHeader title="Settings" description="Manage your account and profile" />

      <div className="flex flex-col gap-6 p-4">
        <Card>
          <CardHeader>
            <CardTitle>Profile information</CardTitle>
            <CardDescription>
              This appears on your public profile page.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <ProfileImageEditor
              name={user.name}
              avatarUrl={user.image ?? null}
              bannerUrl={user.bannerImage ?? null}
            />
            <ProfileSettingsForm
              profile={{
                name: user.name,
                username: user.username ?? null,
                bio: user.bio ?? null,
                website: user.website ?? null,
                location: user.location ?? null,
                profession: user.profession ?? null,
                totalClients: user.totalClients ?? null,
                totalProjects: user.totalProjects ?? null,
                yearsExperience: user.yearsExperience ?? null,
                skills: user.skills ?? [],
                workflow: user.workflow ?? [],
                workExperience: user.workExperience ?? [],
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <Separator className="mb-4" />
            <SignOutButton />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

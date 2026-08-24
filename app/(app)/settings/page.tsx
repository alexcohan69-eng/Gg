import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getSessionWithRetry } from "@/lib/auth"
import { getCareerProfile, getWorkExperience } from "@/lib/career"
import { PageHeader } from "@/components/page-header"
import { ProfileImageEditor } from "@/components/profile-image-editor"
import { ProfileSettingsForm } from "@/components/profile-settings-form"
import { AboutEditor } from "@/components/about-editor"
import { CareerStatsForm } from "@/components/career-stats-form"
import { SkillsEditor } from "@/components/skills-editor"
import { WorkflowStepsEditor } from "@/components/workflow-steps-editor"
import { WorkExperienceEditor } from "@/components/work-experience-editor"
import { SignOutButton } from "@/components/sign-out-button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export const metadata: Metadata = {
  title: "Settings",
}

export default async function SettingsPage() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const user = session.user as typeof session.user & {
    username?: string | null
    bio?: string | null
    about?: string | null
    website?: string | null
    location?: string | null
    bannerImage?: string | null
  }

  const [careerProfile, workExperience] = await Promise.all([
    getCareerProfile(user.id),
    getWorkExperience(user.id),
  ])

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
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
            <CardDescription>
              A longer, formatted write-up shown on your About page. Separate
              from the short bio on your profile header.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AboutEditor about={user.about ?? null} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Career highlights</CardTitle>
            <CardDescription>
              Shown as a metrics strip at the top of your About page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CareerStatsForm stats={careerProfile} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Skills</CardTitle>
            <CardDescription>
              The expertise you want visitors to see first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SkillsEditor skills={careerProfile.skills} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workflow</CardTitle>
            <CardDescription>
              The steps you take clients through from kickoff to delivery.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WorkflowStepsEditor steps={careerProfile.workflowSteps} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Work experience</CardTitle>
            <CardDescription>
              Your career timeline, most recent role first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WorkExperienceEditor experience={workExperience} />
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

import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getSessionWithRetry } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
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
          <CardContent>
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

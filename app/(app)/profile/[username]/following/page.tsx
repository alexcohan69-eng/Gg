import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getFollowing, getProfileByIdentifier } from "@/lib/follows"
import { profileHref } from "@/lib/utils"
import { PageHeader } from "@/components/page-header"
import { BackButton } from "@/components/back-button"
import { UserList } from "@/components/user-list"
import { UsersIcon } from "lucide-react"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>
}): Promise<Metadata> {
  const { username } = await params
  const profile = await getProfileByIdentifier(username).catch(() => null)
  if (!profile) return { title: "Following" }
  return { title: `Accounts ${profile.name} follows` }
}

export default async function FollowingPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const profile = await getProfileByIdentifier(username)
  if (!profile) notFound()

  if (profile.username && profile.username !== username) {
    redirect(`${profileHref(profile)}/following`)
  }

  const following = await getFollowing(profile.id, session.user.id)
  const isSelf = profile.id === session.user.id

  return (
    <div className="flex flex-col">
      <PageHeader
        title={profile.name}
        description="Following"
        leading={<BackButton />}
      />

      <UserList
        users={following}
        profileIdentifier={username}
        emptyIcon={UsersIcon}
        emptyTitle="Not following anyone yet"
        emptyDescription={
          isSelf
            ? "Accounts you follow will show up here."
            : `${profile.name} isn't following anyone yet.`
        }
      />
    </div>
  )
}

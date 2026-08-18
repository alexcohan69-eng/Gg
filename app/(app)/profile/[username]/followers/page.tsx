import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getFollowers, getProfileByIdentifier, profileHref } from "@/lib/follows"
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
  if (!profile) return { title: "Followers" }
  return { title: `People following ${profile.name}` }
}

export default async function FollowersPage({
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
    redirect(`${profileHref(profile)}/followers`)
  }

  const followers = await getFollowers(profile.id, session.user.id)
  const isSelf = profile.id === session.user.id

  return (
    <div className="flex flex-col">
      <PageHeader
        title={profile.name}
        description="Followers"
        leading={<BackButton />}
      />

      <UserList
        users={followers}
        profileIdentifier={username}
        emptyIcon={UsersIcon}
        emptyTitle="No followers yet"
        emptyDescription={
          isSelf
            ? "When someone follows you, they'll show up here."
            : `${profile.name} doesn't have any followers yet.`
        }
      />
    </div>
  )
}

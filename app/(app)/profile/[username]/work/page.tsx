import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { getSessionWithRetry } from "@/lib/auth"
import { getPortfolioProjects } from "@/lib/portfolio"
import { getProfileByIdentifier, isFollowing } from "@/lib/follows"
import { getBlockState } from "@/lib/blocks"
import { getAverageRating } from "@/lib/testimonials"
import { getCareerProfile } from "@/lib/career"
import { profileHref } from "@/lib/utils"
import { ProfileStickyHeader } from "@/components/profile-sticky-header"
import { BackButton } from "@/components/back-button"
import { ProfileHeader } from "@/components/profile-header"
import { ProfileTabs } from "@/components/profile-tabs"
import { PortfolioGrid } from "@/components/portfolio-grid"
import { WorkAddButton } from "@/components/work-add-button"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>
}): Promise<Metadata> {
  const { username } = await params
  const profile = await getProfileByIdentifier(username).catch(() => null)

  if (!profile) return { title: "Work" }

  return { title: `${profile.name}'s work (@${profile.username ?? "user"})` }
}

export default async function ProfileWorkPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const profile = await getProfileByIdentifier(username)
  if (!profile) notFound()

  // Canonicalize to the username-based URL, same as the Posts/About pages.
  if (profile.username && profile.username !== username) {
    redirect(`${profileHref(profile)}/work`)
  }

  const isSelf = profile.id === session.user.id

  const joined = new Date(profile.createdAt).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  })

  const [projects, rating, careerProfile, viewerIsFollowing, blockState] = await Promise.all([
    getPortfolioProjects(profile.id),
    getAverageRating(profile.id),
    getCareerProfile(profile.id),
    isSelf ? Promise.resolve(false) : isFollowing(session.user.id, profile.id),
    isSelf
      ? Promise.resolve({ viewerBlockedTarget: false, targetBlockedViewer: false })
      : getBlockState(session.user.id, profile.id),
  ])

  return (
    <div className="flex flex-col">
      <ProfileStickyHeader
        name={profile.name}
        username={profile.username ?? "user"}
        leading={<BackButton />}
        trailing={isSelf ? <WorkAddButton projectCount={projects.length} /> : null}
      />

      <ProfileHeader
        name={profile.name}
        username={profile.username}
        bio={profile.bio}
        image={profile.image}
        bannerImage={profile.bannerImage}
        website={profile.website}
        location={profile.location}
        joined={joined}
        rating={rating}
        totalProjects={careerProfile.totalProjects}
        profileIdentifier={username}
        isSelf={isSelf}
        targetUserId={profile.id}
        targetUserName={profile.name}
        isFollowing={viewerIsFollowing}
        viewerBlockedTarget={blockState.viewerBlockedTarget}
        targetBlockedViewer={blockState.targetBlockedViewer}
      />

      <ProfileTabs identifier={username} current="work" />

      <PortfolioGrid
        projects={projects}
        profileIdentifier={username}
        isSelf={isSelf}
        name={profile.name}
      />
    </div>
  )
}

import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { getSessionWithRetry } from "@/lib/auth"
import { getTestimonials } from "@/lib/testimonials"
import { getServiceOptions } from "@/lib/services"
import { getPortfolioProjectOptions } from "@/lib/portfolio"
import { getFollowCounts, getProfileByIdentifier, isFollowing } from "@/lib/follows"
import { getBlockState } from "@/lib/blocks"
import { profileHref } from "@/lib/utils"
import { ProfileStickyHeader } from "@/components/profile-sticky-header"
import { BackButton } from "@/components/back-button"
import { ProfileHeader } from "@/components/profile-header"
import { ProfileTabs } from "@/components/profile-tabs"
import { TestimonialGrid } from "@/components/testimonial-grid"
import { TestimonialAddButton } from "@/components/testimonial-add-button"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>
}): Promise<Metadata> {
  const { username } = await params
  const profile = await getProfileByIdentifier(username).catch(() => null)

  if (!profile) return { title: "Testimonials" }

  return { title: `${profile.name}'s testimonials (@${profile.username ?? "user"})` }
}

export default async function ProfileTestimonialsPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const profile = await getProfileByIdentifier(username)
  if (!profile) notFound()

  // Canonicalize to the username-based URL, same as the Posts/Work/Services/About pages.
  if (profile.username && profile.username !== username) {
    redirect(`${profileHref(profile)}/testimonials`)
  }

  const isSelf = profile.id === session.user.id

  const joined = new Date(profile.createdAt).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  })

  const [testimonials, followCounts, viewerIsFollowing, blockState, serviceOptions, projectOptions] =
    await Promise.all([
      getTestimonials(profile.id),
      getFollowCounts(profile.id),
      isSelf ? Promise.resolve(false) : isFollowing(session.user.id, profile.id),
      isSelf
        ? Promise.resolve({ viewerBlockedTarget: false, targetBlockedViewer: false })
        : getBlockState(session.user.id, profile.id),
      // Only the owner ever opens the editor, but fetching this for
      // every viewer keeps the query list simple — it's a cheap,
      // small (id, title) projection either way.
      getServiceOptions(profile.id),
      getPortfolioProjectOptions(profile.id),
    ])

  return (
    <div className="flex flex-col">
      <ProfileStickyHeader
        name={profile.name}
        username={profile.username ?? "user"}
        leading={<BackButton />}
        trailing={
          isSelf ? (
            <TestimonialAddButton
              testimonialCount={testimonials.length}
              serviceOptions={serviceOptions}
              projectOptions={projectOptions}
            />
          ) : null
        }
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
        followerCount={followCounts.followers}
        followingCount={followCounts.following}
        profileIdentifier={username}
        isSelf={isSelf}
        targetUserId={profile.id}
        targetUserName={profile.name}
        isFollowing={viewerIsFollowing}
        viewerBlockedTarget={blockState.viewerBlockedTarget}
        targetBlockedViewer={blockState.targetBlockedViewer}
      />

      <ProfileTabs identifier={username} current="testimonials" />

      <TestimonialGrid
        testimonials={testimonials}
        isSelf={isSelf}
        name={profile.name}
        serviceOptions={serviceOptions}
        projectOptions={projectOptions}
      />
    </div>
  )
}

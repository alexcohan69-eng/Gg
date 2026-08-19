import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { getSessionWithRetry } from "@/lib/auth"
import { getUserPosts } from "@/lib/posts"
import { getFollowCounts, getProfileByIdentifier, isFollowing } from "@/lib/follows"
import { getBlockState } from "@/lib/blocks"
import { profileHref } from "@/lib/utils"
import { PageHeader } from "@/components/page-header"
import { BackButton } from "@/components/back-button"
import { ProfileHeader } from "@/components/profile-header"
import { PostList } from "@/components/post-list"
import { MessageSquareTextIcon } from "lucide-react"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>
}): Promise<Metadata> {
  const { username } = await params
  const profile = await getProfileByIdentifier(username).catch(() => null)

  if (!profile) return { title: "Profile" }

  return { title: `${profile.name} (@${profile.username ?? "user"})` }
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const profile = await getProfileByIdentifier(username)
  if (!profile) notFound()

  // Canonicalize to the username-based URL so id-based links (used as a
  // fallback for users without a username) don't create a duplicate,
  // out-of-sync route for the same profile.
  if (profile.username && profile.username !== username) {
    redirect(profileHref(profile))
  }

  const isSelf = profile.id === session.user.id

  const joined = new Date(profile.createdAt).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  })

  const [posts, followCounts, viewerIsFollowing, blockState] = await Promise.all([
    getUserPosts(profile.id, session.user.id),
    getFollowCounts(profile.id),
    isSelf ? Promise.resolve(false) : isFollowing(session.user.id, profile.id),
    isSelf
      ? Promise.resolve({ viewerBlockedTarget: false, targetBlockedViewer: false })
      : getBlockState(session.user.id, profile.id),
  ])

  return (
    <div className="flex flex-col">
      <PageHeader
        title={profile.name}
        description={`@${profile.username ?? "user"}`}
        leading={<BackButton />}
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

      <div className="border-t border-border">
        <PostList
          posts={posts}
          currentUserId={session.user.id}
          emptyIcon={MessageSquareTextIcon}
          emptyTitle="No posts yet"
          emptyDescription={`${profile.name} hasn't posted anything yet.`}
        />
      </div>
    </div>
  )
}

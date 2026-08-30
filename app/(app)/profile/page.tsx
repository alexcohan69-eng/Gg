import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getSessionWithRetry } from "@/lib/auth"
import { getUserPosts } from "@/lib/posts"
import { getAverageRating } from "@/lib/testimonials"
import { getCareerProfile } from "@/lib/career"
import { ProfileStickyHeader } from "@/components/profile-sticky-header"
import { ProfileHeader } from "@/components/profile-header"
import { ProfileTabs } from "@/components/profile-tabs"
import { PostList } from "@/components/post-list"
import { FirstPostEmptyState } from "@/components/first-post-empty-state"
import { MessageSquareTextIcon } from "lucide-react"

export const metadata: Metadata = {
  title: "Your profile",
}

export default async function ProfilePage() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const user = session.user as typeof session.user & {
    username?: string | null
    bio?: string | null
    bannerImage?: string | null
    website?: string | null
    location?: string | null
  }

  const joined = new Date(user.createdAt).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  })

  const profileIdentifier = user.username ?? user.id

  const [posts, rating, careerProfile] = await Promise.all([
    getUserPosts(user.id, user.id),
    getAverageRating(user.id),
    getCareerProfile(user.id),
  ])

  return (
    <div className="flex flex-col">
      <ProfileStickyHeader
        name={user.name}
        username={user.username ?? "user"}
      />

      <ProfileHeader
        name={user.name}
        username={user.username ?? null}
        bio={user.bio ?? null}
        image={user.image ?? null}
        bannerImage={user.bannerImage ?? null}
        website={user.website ?? null}
        location={user.location ?? null}
        joined={joined}
        rating={rating}
        totalProjects={careerProfile.totalProjects}
        profileIdentifier={profileIdentifier}
        isSelf
      />

      <ProfileTabs identifier={profileIdentifier} current="posts" />

      <div className="border-t border-border">
        {posts.length === 0 ? (
          <FirstPostEmptyState user={{ name: user.name, image: user.image }} />
        ) : (
          <PostList
            posts={posts}
            currentUserId={user.id}
            emptyIcon={MessageSquareTextIcon}
            emptyTitle="No posts yet"
            emptyDescription="Anything you post will show up here."
          />
        )}
      </div>
    </div>
  )
}

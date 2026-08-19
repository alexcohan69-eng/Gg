import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getFeedPosts, getFollowingFeed } from "@/lib/posts"
import { getFollowCounts } from "@/lib/follows"
import { loadMoreFollowingFeed, loadMoreHomeFeed } from "@/app/actions/feed"
import { PageHeader } from "@/components/page-header"
import { PostComposer } from "@/components/post-composer"
import { PostList } from "@/components/post-list"
import { cn } from "@/lib/utils"
import { SparklesIcon, UsersIcon } from "lucide-react"

export const metadata: Metadata = {
  title: "Home",
}

const HOME_TABS = [
  { key: "for-you", label: "For you", href: "/home" },
  { key: "following", label: "Following", href: "/home?tab=following" },
] as const

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const activeTab = tab === "following" ? "following" : "for-you"

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const [posts, followCounts] = await Promise.all([
    activeTab === "following"
      ? getFollowingFeed(session.user.id)
      : getFeedPosts(session.user.id),
    getFollowCounts(session.user.id),
  ])

  return (
    <div className="flex flex-col">
      <PageHeader title="Home" />

      <PostComposer
        user={{ name: session.user.name, image: session.user.image }}
      />

      <nav aria-label="Home feed" className="flex border-b border-border">
        {HOME_TABS.map((homeTab) => {
          const active = activeTab === homeTab.key
          return (
            <Link
              key={homeTab.key}
              href={homeTab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex-1 border-b-2 border-transparent px-4 py-3 text-center text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/30",
                active && "border-primary font-semibold text-foreground",
              )}
            >
              {homeTab.label}
            </Link>
          )
        })}
      </nav>

      {activeTab === "following" && followCounts.following === 0 ? (
        <PostList
          posts={[]}
          currentUserId={session.user.id}
          emptyIcon={UsersIcon}
          emptyTitle="Follow people to see their posts"
          emptyDescription="Posts from accounts you follow will show up here. Visit a profile and tap Follow to get started."
        />
      ) : (
        <PostList
          posts={posts}
          currentUserId={session.user.id}
          emptyIcon={SparklesIcon}
          emptyTitle={
            activeTab === "following" ? "No posts yet" : "Your feed is quiet"
          }
          emptyDescription={
            activeTab === "following"
              ? "The accounts you follow haven't posted anything yet."
              : "Be the first to post — everything shared here shows up in the home timeline."
          }
          loadMore={
            activeTab === "following" ? loadMoreFollowingFeed : loadMoreHomeFeed
          }
        />
      )}
    </div>
  )
}

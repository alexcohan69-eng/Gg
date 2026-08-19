import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getSessionWithRetry } from "@/lib/auth"
import { getBookmarkedPosts } from "@/lib/posts"
import { getBlockedUserIds } from "@/lib/blocks"
import { PageHeader } from "@/components/page-header"
import { PostList } from "@/components/post-list"
import { BookmarkIcon } from "lucide-react"

export const metadata: Metadata = {
  title: "Bookmarks",
}

export default async function BookmarksPage() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const blockedUserIds = await getBlockedUserIds(session.user.id)
  const posts = await getBookmarkedPosts(session.user.id, blockedUserIds)

  return (
    <div className="flex flex-col">
      <PageHeader title="Bookmarks" />
      <PostList
        posts={posts}
        currentUserId={session.user.id}
        emptyIcon={BookmarkIcon}
        emptyTitle="Nothing saved yet"
        emptyDescription="Posts you bookmark will be collected here."
      />
    </div>
  )
}

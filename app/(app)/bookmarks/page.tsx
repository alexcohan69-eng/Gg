import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getBookmarkedPosts } from "@/lib/posts"
import { loadMoreBookmarks } from "@/app/actions/feed"
import { PageHeader } from "@/components/page-header"
import { PostList } from "@/components/post-list"
import { BookmarkIcon } from "lucide-react"

export const metadata: Metadata = {
  title: "Bookmarks",
}

export default async function BookmarksPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const posts = await getBookmarkedPosts(session.user.id)

  return (
    <div className="flex flex-col">
      <PageHeader title="Bookmarks" />
      <PostList
        posts={posts}
        currentUserId={session.user.id}
        emptyIcon={BookmarkIcon}
        emptyTitle="Nothing saved yet"
        emptyDescription="Posts you bookmark will be collected here."
        loadMore={loadMoreBookmarks}
      />
    </div>
  )
}

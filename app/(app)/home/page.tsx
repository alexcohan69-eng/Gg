import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getFeedPosts } from "@/lib/posts"
import { PageHeader } from "@/components/page-header"
import { PostComposer } from "@/components/post-composer"
import { PostList } from "@/components/post-list"
import { SparklesIcon } from "lucide-react"

export const metadata: Metadata = {
  title: "Home",
}

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const posts = await getFeedPosts()

  return (
    <div className="flex flex-col">
      <PageHeader title="Home" />
      <PostComposer
        user={{ name: session.user.name, image: session.user.image }}
      />
      <PostList
        posts={posts}
        currentUserId={session.user.id}
        emptyIcon={SparklesIcon}
        emptyTitle="Your feed is quiet"
        emptyDescription="Be the first to post — everything shared here shows up in the home timeline."
      />
    </div>
  )
}

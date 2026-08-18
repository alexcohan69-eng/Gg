import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getPostById, getPostReplies } from "@/lib/posts"
import { PageHeader } from "@/components/page-header"
import { BackButton } from "@/components/back-button"
import { PostCard } from "@/components/post-card"
import { PostComposer } from "@/components/post-composer"
import { PostList } from "@/components/post-list"
import { MessageSquareTextIcon } from "lucide-react"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return { title: "Post" }
  }

  const post = await getPostById(id, session.user.id).catch(() => null)

  if (!post) {
    return { title: "Post" }
  }

  const excerpt =
    post.content.length > 60 ? `${post.content.slice(0, 60)}...` : post.content

  return {
    title: `${post.authorName} on Pulse: "${excerpt}"`,
  }
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const post = await getPostById(id, session.user.id)
  if (!post) notFound()

  const replies = await getPostReplies(id, session.user.id)

  return (
    <div className="flex flex-col">
      <PageHeader title="Post" leading={<BackButton />} />

      <PostCard
        post={post}
        currentUserId={session.user.id}
        linkToDetail={false}
      />

      <PostComposer
        user={{ name: session.user.name, image: session.user.image }}
        replyToId={post.id}
        placeholder="Post your reply"
        submitLabel="Reply"
      />

      <PostList
        posts={replies}
        currentUserId={session.user.id}
        emptyIcon={MessageSquareTextIcon}
        emptyTitle="No replies yet"
        emptyDescription="Be the first to reply to this post."
      />
    </div>
  )
}

import { PageHeader } from "@/components/page-header"
import { PostListSkeleton } from "@/components/post-list-skeleton"

export default function BookmarksLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Bookmarks" />
      <PostListSkeleton />
    </div>
  )
}

import { PageHeader } from "@/components/page-header"
import { PostListSkeleton } from "@/components/loading-skeletons"

export default function BookmarksLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Bookmarks" />
      <PostListSkeleton />
    </div>
  )
}

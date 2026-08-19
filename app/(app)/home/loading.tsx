import { PageHeader } from "@/components/page-header"
import { PostListSkeleton } from "@/components/skeletons"

export default function HomeLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Home" />
      <div className="flex h-14 border-b border-border" aria-hidden="true" />
      <PostListSkeleton />
    </div>
  )
}

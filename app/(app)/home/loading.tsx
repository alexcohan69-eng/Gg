import { PageHeader } from "@/components/page-header"
import { PostFeedSkeleton } from "@/components/loading-skeletons"

export default function HomeLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Home" />
      <PostFeedSkeleton />
    </div>
  )
}

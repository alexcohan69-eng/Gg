import { PageHeader } from "@/components/page-header"
import { BackButton } from "@/components/back-button"
import { PostFeedSkeleton } from "@/components/loading-skeletons"

export default function PostDetailLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Post" leading={<BackButton />} />
      <PostFeedSkeleton rows={4} />
    </div>
  )
}

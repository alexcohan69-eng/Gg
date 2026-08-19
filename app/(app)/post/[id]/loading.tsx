import { PageHeader } from "@/components/page-header"
import { BackButton } from "@/components/back-button"
import { PostListSkeleton } from "@/components/skeletons"

export default function PostDetailLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Post" leading={<BackButton />} />
      <PostListSkeleton count={4} />
    </div>
  )
}

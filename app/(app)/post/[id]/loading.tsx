import { PageHeader } from "@/components/page-header"
import { BackButton } from "@/components/back-button"
import { PostListSkeleton } from "@/components/loading-skeletons"

export default function PostDetailLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Post" leading={<BackButton />} />
      <PostListSkeleton count={1} />
      <div className="border-t border-border">
        <PostListSkeleton count={3} />
      </div>
    </div>
  )
}

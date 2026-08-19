import { PageHeader } from "@/components/page-header"
import { ProfileHeaderSkeleton, PostListSkeleton } from "@/components/loading-skeletons"

export default function ProfileLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Profile" />
      <ProfileHeaderSkeleton />
      <div className="border-t border-border">
        <PostListSkeleton />
      </div>
    </div>
  )
}

import { PageHeader } from "@/components/page-header"
import { BackButton } from "@/components/back-button"
import { ProfileHeaderSkeleton, PostListSkeleton } from "@/components/skeletons"

export default function ProfileLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Profile" leading={<BackButton />} />
      <ProfileHeaderSkeleton />
      <div className="border-t border-border">
        <PostListSkeleton />
      </div>
    </div>
  )
}

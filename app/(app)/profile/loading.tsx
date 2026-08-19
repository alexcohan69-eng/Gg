import { PageHeader } from "@/components/page-header"
import { ProfileHeaderSkeleton, PostListSkeleton } from "@/components/skeletons"

export default function SelfProfileLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Your profile" />
      <ProfileHeaderSkeleton />
      <div className="border-t border-border">
        <PostListSkeleton />
      </div>
    </div>
  )
}

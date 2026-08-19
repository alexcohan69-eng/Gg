import { PageHeader } from "@/components/page-header"
import { BackButton } from "@/components/back-button"
import { UserListSkeleton } from "@/components/skeletons"

export default function FollowingLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Profile" description="Following" leading={<BackButton />} />
      <UserListSkeleton />
    </div>
  )
}

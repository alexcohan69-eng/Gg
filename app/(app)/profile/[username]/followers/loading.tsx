import { PageHeader } from "@/components/page-header"
import { BackButton } from "@/components/back-button"
import { UserListSkeleton } from "@/components/loading-skeletons"

export default function FollowersLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Followers" leading={<BackButton />} />
      <UserListSkeleton />
    </div>
  )
}

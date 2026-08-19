import { PageHeader } from "@/components/page-header"
import { BackButton } from "@/components/back-button"
import { UserListSkeleton } from "@/components/skeletons"

export default function FollowersLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Profile" description="Followers" leading={<BackButton />} />
      <UserListSkeleton />
    </div>
  )
}

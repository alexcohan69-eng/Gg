import { PageHeader } from "@/components/page-header"
import { BackButton } from "@/components/back-button"
import { ProfileHeaderSkeleton, PortfolioGridSkeleton } from "@/components/loading-skeletons"

export default function ProfileWorkLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Work" leading={<BackButton />} />
      <ProfileHeaderSkeleton />
      <PortfolioGridSkeleton />
    </div>
  )
}

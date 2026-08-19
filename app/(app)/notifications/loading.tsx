import { PageHeader } from "@/components/page-header"
import { RowListSkeleton } from "@/components/loading-skeletons"

export default function NotificationsLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Notifications" />
      <RowListSkeleton />
    </div>
  )
}

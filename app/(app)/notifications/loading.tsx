import { PageHeader } from "@/components/page-header"
import { NotificationListSkeleton } from "@/components/notification-list-skeleton"

export default function NotificationsLoading() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Notifications" />
      <NotificationListSkeleton />
    </div>
  )
}

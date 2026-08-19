import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getSessionWithRetry } from "@/lib/auth"
import { getNotifications } from "@/lib/notifications"
import { PageHeader } from "@/components/page-header"
import { NotificationListLive } from "@/components/notification-list-live"
import { MarkAllReadButton } from "@/components/mark-all-read-button"

export const metadata: Metadata = {
  title: "Notifications",
}

export default async function NotificationsPage() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const notifications = await getNotifications(session.user.id)
  const hasUnread = notifications.some((notification) => !notification.isRead)

  return (
    <div className="flex flex-col">
      <PageHeader title="Notifications">
        <MarkAllReadButton initialHasUnread={hasUnread} />
      </PageHeader>

      <NotificationListLive initialNotifications={notifications} />
    </div>
  )
}

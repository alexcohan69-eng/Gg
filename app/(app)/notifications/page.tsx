import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { BellIcon } from "lucide-react"
import { getSessionWithRetry } from "@/lib/auth"
import { getNotifications } from "@/lib/notifications"
import { PageHeader } from "@/components/page-header"
import { NotificationItem } from "@/components/notification-item"
import { MarkAllReadButton } from "@/components/mark-all-read-button"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"

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
        {hasUnread ? <MarkAllReadButton /> : null}
      </PageHeader>

      {notifications.length === 0 ? (
        <div className="p-4">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BellIcon />
              </EmptyMedia>
              <EmptyTitle>No notifications yet</EmptyTitle>
              <EmptyDescription>
                Likes, replies, reposts, and new followers will show up here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <div>
          {notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </div>
      )}
    </div>
  )
}

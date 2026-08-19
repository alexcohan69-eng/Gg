import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
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
import { BellIcon } from "lucide-react"

export const metadata: Metadata = {
  title: "Notifications",
}

export default async function NotificationsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const notifications = await getNotifications(session.user.id)
  const hasUnread = notifications.some((n) => !n.isRead)

  return (
    <div className="flex flex-col">
      <PageHeader title="Notifications">
        <MarkAllReadButton disabled={!hasUnread} />
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
        <div className="flex flex-col">
          {notifications.map((notification) => (
            // Keying on isRead too forces a remount when the server
            // value flips (e.g. after "Mark all read" triggers a
            // router.refresh()) so the row's local optimistic state
            // doesn't shadow the refreshed prop.
            <NotificationItem
              key={`${notification.id}-${notification.isRead}`}
              notification={notification}
            />
          ))}
        </div>
      )}
    </div>
  )
}

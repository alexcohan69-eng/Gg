import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getSessionWithRetry } from "@/lib/auth"
import { getNotifications } from "@/lib/notifications"
import { PageHeader } from "@/components/page-header"
import { NotificationList } from "@/components/notification-list"
import { NotificationHeaderActions } from "@/components/notification-header-actions"

export const metadata: Metadata = {
  title: "Notifications",
}

export default async function NotificationsPage() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const notifications = await getNotifications(session.user.id)

  return (
    <div className="flex flex-col">
      <PageHeader title="Notifications">
        <NotificationHeaderActions initialNotifications={notifications} />
      </PageHeader>

      <NotificationList initialNotifications={notifications} />
    </div>
  )
}

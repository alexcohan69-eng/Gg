import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { getSessionSafe } from "@/lib/auth"
import { getUnreadNotificationCount } from "@/lib/notifications"
import { getUnreadMessageCount } from "@/lib/messages"
import { AppShell } from "@/components/app-shell"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSessionSafe({ headers: await headers() })

  if (!session?.user) {
    redirect("/sign-in")
  }

  const [unreadNotificationsCount, unreadMessagesCount] = await Promise.all([
    getUnreadNotificationCount(session.user.id),
    getUnreadMessageCount(session.user.id),
  ])

  return (
    <AppShell
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        username: (session.user as { username?: string | null }).username,
      }}
      unreadNotificationsCount={unreadNotificationsCount}
      unreadMessagesCount={unreadMessagesCount}
    >
      {children}
    </AppShell>
  )
}

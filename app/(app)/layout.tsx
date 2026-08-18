import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { AppShell } from "@/components/app-shell"
import { getUnreadNotificationCount } from "@/lib/notifications"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    redirect("/sign-in")
  }

  const unreadNotifications = await getUnreadNotificationCount(
    session.user.id,
  )

  return (
    <AppShell
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        username: (session.user as { username?: string | null }).username,
      }}
      initialUnreadNotifications={unreadNotifications}
    >
      {children}
    </AppShell>
  )
}

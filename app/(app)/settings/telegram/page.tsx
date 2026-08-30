import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getSessionWithRetry } from "@/lib/auth"
import { getMyTelegramLink } from "@/app/actions/telegram"
import { PageHeader } from "@/components/page-header"
import { BackButton } from "@/components/back-button"
import { TelegramLinkManager } from "@/components/telegram-link-manager"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Telegram settings",
}

export default async function TelegramSettingsPage() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const link = await getMyTelegramLink()

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Telegram"
        description="Manage your account from a Telegram bot"
        leading={<BackButton />}
      />

      <div className="flex flex-col gap-6 p-4">
        <Card>
          <CardHeader>
            <CardTitle>Connect a bot</CardTitle>
            <CardDescription>
              Link the built-in Web Banai bot for instant access, or connect your own bot from @BotFather. Either
              way, once verified it can post, like, follow, manage your services/portfolio/testimonials, and send
              and receive direct messages — all acting only as you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TelegramLinkManager initialLink={link} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Commands</CardTitle>
            <CardDescription>Every command the bot understands, with examples.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" nativeButton={false} render={<Link href="/telegram-commands" />}>
              View command reference
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

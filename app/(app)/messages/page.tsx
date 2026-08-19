import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { SquarePenIcon } from "lucide-react"
import { auth } from "@/lib/auth"
import { getConversations } from "@/lib/messages"
import { PageHeader } from "@/components/page-header"
import { ConversationList } from "@/components/conversation-list"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Messages",
}

export default async function MessagesPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const conversations = await getConversations(session.user.id)

  return (
    <div className="flex flex-col">
      <PageHeader title="Messages">
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          aria-label="New message"
          nativeButton={false}
          render={<Link href="/messages/new" />}
        >
          <SquarePenIcon />
        </Button>
      </PageHeader>

      <ConversationList
        initialConversations={conversations}
        currentUserId={session.user.id}
      />
    </div>
  )
}

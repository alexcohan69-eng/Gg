import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { MailIcon, SquarePenIcon } from "lucide-react"
import { auth } from "@/lib/auth"
import { getConversations } from "@/lib/messages"
import { PageHeader } from "@/components/page-header"
import { ConversationListItem } from "@/components/conversation-list-item"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty"

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

      {conversations.length === 0 ? (
        <div className="p-4">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MailIcon />
              </EmptyMedia>
              <EmptyTitle>No conversations yet</EmptyTitle>
              <EmptyDescription>
                Send a direct message to start a conversation with someone
                you follow or find through search.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                className="rounded-full"
                nativeButton={false}
                render={<Link href="/messages/new" />}
              >
                New message
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      ) : (
        <div className="flex flex-col">
          {conversations.map((conversation) => (
            <ConversationListItem
              key={conversation.id}
              conversation={conversation}
              currentUserId={session.user.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

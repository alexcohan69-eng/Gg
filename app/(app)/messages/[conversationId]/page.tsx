import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import {
  getConversationForViewer,
  getMessages,
  markConversationRead,
} from "@/lib/messages"
import { getInitials, profileHref } from "@/lib/utils"
import { BackButton } from "@/components/back-button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageThread } from "@/components/message-thread"
import { MessageComposer } from "@/components/message-composer"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ conversationId: string }>
}): Promise<Metadata> {
  const { conversationId } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { title: "Messages" }

  const conversation = await getConversationForViewer(
    conversationId,
    session.user.id,
  ).catch(() => null)

  if (!conversation) return { title: "Messages" }

  return { title: `${conversation.otherUser.name} - Messages` }
}

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>
}) {
  const { conversationId } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  // getConversationForViewer is the ownership check: it returns null
  // both when the conversation doesn't exist and when the viewer
  // isn't one of its two participants, so either case 404s the same
  // way instead of leaking which one it was.
  const conversation = await getConversationForViewer(
    conversationId,
    session.user.id,
  )
  if (!conversation) notFound()

  // Mark the other participant's messages read as soon as the viewer
  // opens the thread, then fetch the (now up to date) message list.
  await markConversationRead(conversationId, session.user.id)
  const messages = await getMessages(conversationId)

  const { otherUser } = conversation

  return (
    <div className="flex h-svh flex-col md:h-svh">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <BackButton />
        <Link
          href={profileHref(otherUser)}
          className="flex min-w-0 flex-1 items-center gap-2.5"
        >
          <Avatar className="size-8">
            <AvatarImage src={otherUser.image ?? undefined} alt={otherUser.name} />
            <AvatarFallback className="text-xs">
              {getInitials(otherUser.name)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-base font-semibold text-foreground hover:underline">
            {otherUser.name}
          </span>
        </Link>
      </header>

      <MessageThread
        messages={messages}
        currentUserId={session.user.id}
        otherUser={otherUser}
      />

      <MessageComposer conversationId={conversationId} />
    </div>
  )
}

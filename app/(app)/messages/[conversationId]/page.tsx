import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { getSessionWithRetry } from "@/lib/auth"
import {
  getConversationForViewer,
  getMessages,
  markConversationRead,
} from "@/lib/messages"
import { getInitials, profileHref } from "@/lib/utils"
import { BackButton } from "@/components/back-button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageThreadLive } from "@/components/message-thread-live"
import { MessageComposer } from "@/components/message-composer"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ conversationId: string }>
}): Promise<Metadata> {
  const { conversationId } = await params

  const session = await getSessionWithRetry({ headers: await headers() })
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

  const session = await getSessionWithRetry({ headers: await headers() })
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
    // AppShell's <main> scrolls with the rest of the document (it isn't
    // a fixed-height viewport of its own), and its mobile top bar / fixed
    // bottom tab bar are already sticky/fixed there. This page's header
    // and composer stack with those rather than fighting them for a
    // second independent scroll container: the header sticks just below
    // the shell's mobile bar (top-14, which is a no-op on desktop where
    // that bar doesn't exist), and the composer sticks just above the
    // fixed mobile tab bar (bottom-14, again a no-op on desktop).
    <div className="flex min-h-[calc(100svh-4rem-1px)] flex-col md:min-h-[calc(100svh-1px)]">
      <header className="sticky top-14 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm md:top-0">
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

      <MessageThreadLive
        conversationId={conversationId}
        initialMessages={messages}
        currentUserId={session.user.id}
        otherUser={otherUser}
      />

      <div className="sticky bottom-14 z-20 bg-background md:bottom-0">
        <MessageComposer conversationId={conversationId} />
      </div>
    </div>
  )
}

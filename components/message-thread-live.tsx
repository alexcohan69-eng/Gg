"use client"

import useSWR from "swr"
import { MessageThread } from "@/components/message-thread"
import type { ConversationParticipant, ThreadMessage } from "@/lib/messages"

/** The wire shape of a message once it's round-tripped through JSON. */
type ThreadMessageDTO = Omit<ThreadMessage, "createdAt"> & { createdAt: string }

async function fetcher(url: string): Promise<ThreadMessage[]> {
  const response = await fetch(url)
  if (!response.ok) throw new Error("Failed to load messages")
  const data: { messages: ThreadMessageDTO[] } = await response.json()
  return data.messages.map((message) => ({
    ...message,
    createdAt: new Date(message.createdAt),
  }))
}

const POLL_INTERVAL_MS = 4000

/**
 * Wraps the presentational `MessageThread` with polling so a reply
 * from the other participant appears while the viewer is already
 * looking at the conversation, not just after a manual refresh.
 * `initialMessages` (from the server-rendered page) is used as SWR's
 * `fallbackData`, so there's no loading flicker on first paint and
 * the thread still renders correctly with JavaScript disabled.
 */
export function MessageThreadLive({
  conversationId,
  initialMessages,
  currentUserId,
  otherUser,
}: {
  conversationId: string
  initialMessages: ThreadMessage[]
  currentUserId: string
  otherUser: ConversationParticipant
}) {
  const { data } = useSWR<ThreadMessage[]>(
    `/api/messages/${conversationId}`,
    fetcher,
    {
      fallbackData: initialMessages,
      refreshInterval: POLL_INTERVAL_MS,
      revalidateOnFocus: true,
      dedupingInterval: 1000,
    },
  )

  return (
    <MessageThread
      messages={data ?? initialMessages}
      currentUserId={currentUserId}
      otherUser={otherUser}
    />
  )
}

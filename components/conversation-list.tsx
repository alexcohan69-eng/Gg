"use client"

import Link from "next/link"
import useSWR from "swr"
import { MailIcon } from "lucide-react"
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
import type { ConversationSummary } from "@/lib/messages"

/** The wire shape of a conversation summary once it's round-tripped through JSON. */
type ConversationSummaryDTO = Omit<
  ConversationSummary,
  "lastMessage" | "lastMessageAt"
> & {
  lastMessage:
    | (Omit<NonNullable<ConversationSummary["lastMessage"]>, "createdAt"> & {
        createdAt: string
      })
    | null
  lastMessageAt: string
}

async function fetcher(url: string): Promise<ConversationSummary[]> {
  const response = await fetch(url)
  if (!response.ok) throw new Error("Failed to load conversations")
  const data: { conversations: ConversationSummaryDTO[] } = await response.json()
  return data.conversations.map((conversation) => ({
    ...conversation,
    lastMessageAt: new Date(conversation.lastMessageAt),
    lastMessage: conversation.lastMessage
      ? {
          ...conversation.lastMessage,
          createdAt: new Date(conversation.lastMessage.createdAt),
        }
      : null,
  }))
}

const POLL_INTERVAL_MS = 15000

/**
 * Wraps the inbox rows with polling so a new conversation, an
 * incoming message, or a read/unread change shows up on its own —
 * matters most here because those changes are frequently caused by
 * someone else, not the viewer's own actions. `initialConversations`
 * seeds SWR's `fallbackData` so the first paint is server-rendered
 * with no loading flicker, and the list still renders (just without
 * live updates) with JavaScript disabled.
 */
export function ConversationList({
  initialConversations,
  currentUserId,
}: {
  initialConversations: ConversationSummary[]
  currentUserId: string
}) {
  const { data } = useSWR<ConversationSummary[]>("/api/messages", fetcher, {
    fallbackData: initialConversations,
    refreshInterval: POLL_INTERVAL_MS,
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  })

  const conversations = data ?? initialConversations

  if (conversations.length === 0) {
    return (
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
    )
  }

  return (
    <div className="flex flex-col">
      {conversations.map((conversation) => (
        <ConversationListItem
          key={conversation.id}
          conversation={conversation}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  )
}

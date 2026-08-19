"use client"

import { useEffect, useRef } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn, formatRelativeTime, getInitials } from "@/lib/utils"
import type { ConversationParticipant, ThreadMessage } from "@/lib/messages"

/**
 * Renders a conversation's messages as chat bubbles — the viewer's
 * own on the right, the other participant's on the left with a small
 * avatar — and scrolls to the newest message on mount and whenever
 * the message list grows (e.g. after sending).
 */
export function MessageThread({
  messages,
  currentUserId,
  otherUser,
}: {
  messages: ThreadMessage[]
  currentUserId: string
  otherUser: ConversationParticipant
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [messages.length])

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <Avatar className="size-14">
          <AvatarImage src={otherUser.image ?? undefined} alt={otherUser.name} />
          <AvatarFallback className="text-lg">
            {getInitials(otherUser.name)}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <p className="font-semibold text-foreground">{otherUser.name}</p>
          <p className="text-sm text-muted-foreground">
            This is the start of your conversation. Say hello!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      {messages.map((message) => {
        const isOwn = message.senderId === currentUserId

        return (
          <div
            key={message.id}
            className={cn(
              "flex items-end gap-2",
              isOwn ? "justify-end" : "justify-start",
            )}
          >
            {!isOwn ? (
              <Avatar className="size-7 shrink-0">
                <AvatarImage
                  src={otherUser.image ?? undefined}
                  alt={otherUser.name}
                />
                <AvatarFallback className="text-[10px]">
                  {getInitials(otherUser.name)}
                </AvatarFallback>
              </Avatar>
            ) : null}

            <div
              className={cn(
                "flex max-w-[75%] flex-col gap-1",
                isOwn ? "items-end" : "items-start",
              )}
            >
              <p
                className={cn(
                  "text-pretty break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                  isOwn
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                {message.content}
              </p>
              <time
                dateTime={new Date(message.createdAt).toISOString()}
                className="px-1 text-xs text-muted-foreground"
                suppressHydrationWarning
              >
                {formatRelativeTime(message.createdAt)}
              </time>
            </div>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}

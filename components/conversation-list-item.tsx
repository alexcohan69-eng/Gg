import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn, formatRelativeTime, getInitials } from "@/lib/utils"
import type { ConversationSummary } from "@/lib/messages"

/**
 * A single inbox row: other participant, a one-line preview of the
 * last message, a relative timestamp, and an unread dot + bold text
 * when the viewer has unread messages in this conversation.
 */
export function ConversationListItem({
  conversation,
  currentUserId,
}: {
  conversation: ConversationSummary
  currentUserId: string
}) {
  const { otherUser, lastMessage, unreadCount } = conversation
  const isUnread = unreadCount > 0

  const preview = lastMessage
    ? lastMessage.senderId === currentUserId
      ? `You: ${lastMessage.content}`
      : lastMessage.content
    : "Start the conversation"

  return (
    <Link
      href={`/messages/${conversation.id}`}
      className="flex items-start gap-3 border-b border-border p-4 transition-colors hover:bg-accent/50"
    >
      <Avatar className="size-11 shrink-0">
        <AvatarImage src={otherUser.image ?? undefined} alt={otherUser.name} />
        <AvatarFallback>{getInitials(otherUser.name)}</AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "truncate text-sm text-foreground",
              isUnread && "font-semibold",
            )}
          >
            {otherUser.name}
          </span>
          <time
            dateTime={new Date(conversation.lastMessageAt).toISOString()}
            className="shrink-0 text-xs text-muted-foreground"
            suppressHydrationWarning
          >
            {formatRelativeTime(conversation.lastMessageAt)}
          </time>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "truncate text-sm",
              isUnread ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {preview}
          </p>
          {isUnread ? (
            <span
              className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold leading-none text-primary-foreground"
              aria-label={`${unreadCount} unread message${unreadCount === 1 ? "" : "s"}`}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

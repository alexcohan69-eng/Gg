import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { conversations, user } from "@/lib/db/schema"
import { getLinkForUser, sendToLink, setActiveConversation } from "@/lib/telegram/links"
import { stripHtmlToText } from "@/lib/sanitize-html"

/**
 * Called right after a message is persisted (see
 * app/actions/messages.ts's `sendMessageForUser`). If the *recipient*
 * has a verified Telegram link, pushes a notification with an inline
 * "Reply" button and sets their `activeConversationId` so a
 * plain-text follow-up from them routes back into this thread without
 * needing a `/dm` command every time (see
 * lib/telegram/commands.ts's plain-text handling).
 */
export async function notifyNewMessage(params: {
  conversationId: string
  senderId: string
  content: string
}): Promise<void> {
  const [conversation] = await db
    .select({ user1Id: conversations.user1Id, user2Id: conversations.user2Id })
    .from(conversations)
    .where(eq(conversations.id, params.conversationId))
    .limit(1)
  if (!conversation) return

  const recipientId = conversation.user1Id === params.senderId ? conversation.user2Id : conversation.user1Id
  if (recipientId === params.senderId) return

  const link = await getLinkForUser(recipientId)
  if (!link || !link.verifiedAt || !link.chatId) return

  const [sender] = await db
    .select({ name: user.name, username: user.username })
    .from(user)
    .where(eq(user.id, params.senderId))
    .limit(1)
  const senderName = sender?.username ? `@${sender.username}` : sender?.name ?? "Someone"

  const preview = stripHtmlToText(params.content).slice(0, 300)

  await sendToLink(link, `New message from ${senderName}:\n${preview}`, {
    replyMarkup: {
      inline_keyboard: [[{ text: "Reply", callback_data: `reply:${params.conversationId}` }]],
    },
  })

  await setActiveConversation(recipientId, params.conversationId)
}

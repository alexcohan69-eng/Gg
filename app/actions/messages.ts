"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { getSessionWithRetry } from "@/lib/auth"
import { db } from "@/lib/db"
import { conversations, messages } from "@/lib/db/schema"
import {
  getConversationForViewer,
  getOrCreateConversation,
  markConversationRead,
} from "@/lib/messages"
import { searchUsers } from "@/lib/search"
import { isBlockedEitherWay } from "@/lib/blocks"
import type { FollowListUser } from "@/lib/follows"
import { logActionError } from "@/lib/log-action-error"
import { notifyNewMessage } from "@/lib/telegram/notify"

const MAX_MESSAGE_LENGTH = 2000

async function getUserId() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

export type MessageActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string }

/**
 * Starts (or resumes) a 1:1 conversation with `targetUserId`, acting
 * as `viewerId`. Takes `viewerId` directly so both the web app's
 * session-authenticated `startConversation` below and the Telegram
 * command dispatcher (see lib/telegram/commands.ts) share one
 * implementation — see `createPostForUser` in app/actions/posts.ts
 * for the same pattern.
 */
export async function startConversationForUser(
  viewerId: string,
  targetUserId: string,
): Promise<MessageActionResult<{ conversationId: string }>> {
  try {
    if (await isBlockedEitherWay(viewerId, targetUserId)) {
      return { success: false, error: "You can't message this account." }
    }

    const conversationId = await getOrCreateConversation(viewerId, targetUserId)
    revalidatePath("/messages")
    return { success: true, data: { conversationId } }
  } catch (error) {
    logActionError("startConversation", error, { targetUserId })
    return {
      success: false,
      error: error instanceof Error ? error.message : "Couldn't start conversation.",
    }
  }
}

/**
 * Starts (or resumes) a 1:1 conversation with `targetUserId` and
 * returns its id so the caller can navigate to the thread. Used from
 * a profile's "Message" button and from the new-message search page.
 */
export async function startConversation(
  targetUserId: string,
): Promise<MessageActionResult<{ conversationId: string }>> {
  const viewerId = await getUserId()
  return startConversationForUser(viewerId, targetUserId)
}

/**
 * Sends a message in an existing conversation as `viewerId`.
 * Re-verifies the sender is a participant (ownership lives entirely
 * in application code — there's no RLS on Aurora) before inserting
 * anything. See `startConversationForUser` above for why this takes
 * `viewerId` directly.
 */
export async function sendMessageForUser(
  viewerId: string,
  conversationId: string,
  content: string,
): Promise<MessageActionResult> {
  try {
    const trimmed = content.trim()
    if (!trimmed) return { success: false, error: "Message can't be empty." }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      return { success: false, error: "Message is too long." }
    }

    const conversation = await getConversationForViewer(conversationId, viewerId)
    if (!conversation) return { success: false, error: "Conversation not found." }

    // Re-checked here (not just in startConversation) because a block
    // can happen after a conversation already exists — the thread
    // shouldn't become a way to keep messaging around it.
    if (await isBlockedEitherWay(viewerId, conversation.otherUser.id)) {
      return { success: false, error: "You can't message this account." }
    }

    await db.insert(messages).values({
      id: crypto.randomUUID(),
      conversationId,
      senderId: viewerId,
      content: trimmed,
    })

    await db
      .update(conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(conversations.id, conversationId))

    revalidatePath(`/messages/${conversationId}`)
    revalidatePath("/messages")

    // Push a Telegram notification to the recipient, if they have a
    // verified link — see lib/telegram/notify.ts. Best-effort: a
    // failure here should never fail the send itself.
    notifyNewMessage({ conversationId, senderId: viewerId, content: trimmed }).catch((error) => {
      logActionError("notifyNewMessage", error, { conversationId })
    })

    return { success: true, data: undefined }
  } catch (error) {
    logActionError("sendMessage", error, { conversationId })
    return { success: false, error: "Couldn't send message." }
  }
}

/** Session-authenticated entry point used by the web app's message composer. */
export async function sendMessage(
  conversationId: string,
  content: string,
): Promise<MessageActionResult> {
  const viewerId = await getUserId()
  return sendMessageForUser(viewerId, conversationId, content)
}

/**
 * Marks the other participant's messages in a conversation as read.
 * Called when the viewer opens (or is already viewing) the thread.
 */
export async function markThreadRead(
  conversationId: string,
): Promise<MessageActionResult> {
  try {
    const viewerId = await getUserId()

    const conversation = await getConversationForViewer(conversationId, viewerId)
    if (!conversation) return { success: false, error: "Conversation not found." }

    await markConversationRead(conversationId, viewerId)
    revalidatePath("/messages")
    return { success: true, data: undefined }
  } catch (error) {
    logActionError("markThreadRead", error, { conversationId })
    return { success: false, error: "Couldn't update conversation." }
  }
}

/**
 * User search scoped to starting a new conversation: reuses the same
 * indexed name/username search as Explore, minus the viewer's own
 * account (you can't message yourself).
 */
export async function searchMessageableUsers(
  query: string,
): Promise<FollowListUser[]> {
  const viewerId = await getUserId()

  const trimmed = query.trim()
  if (!trimmed) return []

  const results = await searchUsers(trimmed, viewerId)
  return results.filter((user) => user.id !== viewerId)
}

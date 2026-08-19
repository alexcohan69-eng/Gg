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
import type { FollowListUser } from "@/lib/follows"

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
 * Starts (or resumes) a 1:1 conversation with `targetUserId` and
 * returns its id so the caller can navigate to the thread. Used from
 * a profile's "Message" button and from the new-message search page.
 */
export async function startConversation(
  targetUserId: string,
): Promise<MessageActionResult<{ conversationId: string }>> {
  try {
    const viewerId = await getUserId()
    const conversationId = await getOrCreateConversation(viewerId, targetUserId)
    revalidatePath("/messages")
    return { success: true, data: { conversationId } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Couldn't start conversation.",
    }
  }
}

/**
 * Sends a message in an existing conversation. Re-verifies the sender
 * is a participant (ownership lives entirely in application code —
 * there's no RLS on Aurora) before inserting anything.
 */
export async function sendMessage(
  conversationId: string,
  content: string,
): Promise<MessageActionResult> {
  try {
    const viewerId = await getUserId()

    const trimmed = content.trim()
    if (!trimmed) return { success: false, error: "Message can't be empty." }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      return { success: false, error: "Message is too long." }
    }

    const conversation = await getConversationForViewer(conversationId, viewerId)
    if (!conversation) return { success: false, error: "Conversation not found." }

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
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: "Couldn't send message." }
  }
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
  } catch {
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

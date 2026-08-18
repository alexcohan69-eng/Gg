"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { posts } from "@/lib/db/schema"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

const MAX_POST_LENGTH = 280

export type PostActionResult = {
  success: boolean
  error?: string
}

export async function createPost(
  formData: FormData,
): Promise<PostActionResult> {
  const userId = await getUserId()

  const content = String(formData.get("content") ?? "").trim()

  if (!content) {
    return { success: false, error: "Post can't be empty." }
  }
  if (content.length > MAX_POST_LENGTH) {
    return {
      success: false,
      error: `Post must be ${MAX_POST_LENGTH} characters or fewer.`,
    }
  }

  await db.insert(posts).values({
    id: crypto.randomUUID(),
    userId,
    content,
  })

  revalidatePath("/home")
  revalidatePath("/profile")

  return { success: true }
}

export async function deletePost(postId: string): Promise<PostActionResult> {
  const userId = await getUserId()

  // Scope the delete by userId so a user can only ever delete their own
  // posts — there is no RLS on Neon, so this check is what protects rows.
  const deleted = await db
    .delete(posts)
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
    .returning({ id: posts.id })

  if (deleted.length === 0) {
    return { success: false, error: "Post not found." }
  }

  revalidatePath("/home")
  revalidatePath("/profile")

  return { success: true }
}

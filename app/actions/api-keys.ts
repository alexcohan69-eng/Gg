"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { getSessionWithRetry } from "@/lib/auth"
import { generateApiKey, revokeApiKey, listApiKeys, type ApiKeySummary } from "@/lib/api/keys"
import { logActionError } from "@/lib/log-action-error"

async function requireUserId(): Promise<string> {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) throw new Error("Not signed in")
  return session.user.id
}

export async function getMyApiKeys(): Promise<ApiKeySummary[]> {
  const userId = await requireUserId()
  return listApiKeys(userId)
}

export type CreateApiKeyActionResult =
  | { success: true; rawKey: string; summary: ApiKeySummary }
  | { success: false; error: string }

export async function createApiKey(formData: FormData): Promise<CreateApiKeyActionResult> {
  try {
    const userId = await requireUserId()
    const name = String(formData.get("name") ?? "").trim()
    const result = await generateApiKey(userId, name)
    if (!result.success) return result

    revalidatePath("/settings")
    return result
  } catch (error) {
    logActionError("createApiKey", error)
    return { success: false, error: "Couldn't create key. Try again." }
  }
}

export async function deleteApiKey(
  id: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const userId = await requireUserId()
    await revokeApiKey(userId, id)
    revalidatePath("/settings")
    return { success: true }
  } catch (error) {
    logActionError("deleteApiKey", error, { id })
    return { success: false, error: "Couldn't revoke key. Try again." }
  }
}

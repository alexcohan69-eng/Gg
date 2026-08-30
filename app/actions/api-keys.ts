"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { getSessionWithRetry } from "@/lib/auth"
import { createApiKey, listApiKeys, revokeApiKey, type ApiKeySummary } from "@/lib/api-keys"
import { logActionError } from "@/lib/log-action-error"

async function getUserId() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

const MAX_KEY_NAME_LENGTH = 60
const MAX_KEYS_PER_USER = 20

export type CreateApiKeyResult =
  | { success: true; rawKey: string; key: ApiKeySummary }
  | { success: false; error: string }

/**
 * Generates a new API key for the signed-in user (via their normal
 * session — this action itself is not part of the public API surface).
 * Returns the raw secret exactly once; it is never stored or
 * retrievable again after this call.
 */
export async function generateApiKey(formData: FormData): Promise<CreateApiKeyResult> {
  const userId = await getUserId()

  const name = String(formData.get("name") ?? "").trim()
  if (!name) {
    return { success: false, error: "Give your key a name so you can recognize it later." }
  }
  if (name.length > MAX_KEY_NAME_LENGTH) {
    return { success: false, error: `Name can't be longer than ${MAX_KEY_NAME_LENGTH} characters.` }
  }

  const existing = await listApiKeys(userId)
  if (existing.filter((k) => !k.revokedAt).length >= MAX_KEYS_PER_USER) {
    return { success: false, error: `You can have at most ${MAX_KEYS_PER_USER} active API keys. Revoke one first.` }
  }

  try {
    const { rawKey, id, createdAt } = await createApiKey(userId, name)
    revalidatePath("/settings/developer")
    return {
      success: true,
      rawKey,
      key: {
        id,
        name,
        keyPreview: rawKey.slice(-4),
        lastUsedAt: null,
        revokedAt: null,
        createdAt,
      },
    }
  } catch (error) {
    logActionError("generateApiKey", error, { userId })
    return { success: false, error: "Couldn't create a key. Try again." }
  }
}

/** Lists the signed-in user's own API keys — never another user's. */
export async function getMyApiKeys(): Promise<ApiKeySummary[]> {
  const userId = await getUserId()
  return listApiKeys(userId)
}

export type RevokeApiKeyResult = { success: boolean; error?: string }

/**
 * Revokes a key. `revokeApiKey` itself re-scopes by userId, so even a
 * tampered `keyId` can only ever affect a key the signed-in user owns.
 */
export async function revokeMyApiKey(keyId: string): Promise<RevokeApiKeyResult> {
  const userId = await getUserId()
  const revoked = await revokeApiKey(userId, keyId)
  if (!revoked) {
    return { success: false, error: "Key not found." }
  }
  revalidatePath("/settings/developer")
  return { success: true }
}

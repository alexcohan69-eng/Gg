import crypto from "node:crypto"
import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { apiKeys } from "@/lib/db/schema"

/**
 * Personal access keys for the public REST API. Raw key shape is
 * `pulse_<43 url-safe base64 chars>` (32 random bytes) — only its
 * sha256 hex hash is ever persisted, matching standard GitHub/Stripe
 * style API-key UX (shown once at creation, never retrievable again).
 */
const KEY_PREFIX = "pulse_"
const PREFIX_DISPLAY_LENGTH = 12
const MAX_KEYS_PER_USER = 20

function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex")
}

function generateRawKey(): string {
  const secret = crypto.randomBytes(32).toString("base64url")
  return `${KEY_PREFIX}${secret}`
}

export type ApiKeySummary = {
  id: string
  name: string
  keyPrefix: string
  lastUsedAt: Date | null
  createdAt: Date
  revokedAt: Date | null
}

/** Every key (active and revoked) a user has generated, newest first. */
export async function listApiKeys(userId: string): Promise<ApiKeySummary[]> {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(desc(apiKeys.createdAt))
}

export type CreateApiKeyResult =
  | { success: true; rawKey: string; summary: ApiKeySummary }
  | { success: false; error: string }

/**
 * Creates a new key for `userId` and returns the raw secret exactly
 * once — the caller (the Settings UI) must show it to the user
 * immediately, since it can never be displayed again after this call.
 */
export async function generateApiKey(
  userId: string,
  name: string,
): Promise<CreateApiKeyResult> {
  const trimmedName = name.trim()
  if (!trimmedName || trimmedName.length > 60) {
    return { success: false, error: "Key name must be 1-60 characters." }
  }

  const existing = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId)))

  if (existing.length >= MAX_KEYS_PER_USER) {
    return { success: false, error: `You can have up to ${MAX_KEYS_PER_USER} API keys.` }
  }

  const rawKey = generateRawKey()
  const id = crypto.randomUUID()
  const createdAt = new Date()

  await db.insert(apiKeys).values({
    id,
    userId,
    name: trimmedName,
    keyPrefix: rawKey.slice(0, PREFIX_DISPLAY_LENGTH),
    keyHash: hashKey(rawKey),
    createdAt,
  })

  return {
    success: true,
    rawKey,
    summary: {
      id,
      name: trimmedName,
      keyPrefix: rawKey.slice(0, PREFIX_DISPLAY_LENGTH),
      lastUsedAt: null,
      createdAt,
      revokedAt: null,
    },
  }
}

/** Revokes (soft-deletes) a key the caller owns. No-op if already revoked or not found. */
export async function revokeApiKey(userId: string, id: string): Promise<boolean> {
  const rows = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
    .returning({ id: apiKeys.id })

  return rows.length > 0
}

/**
 * Verifies a raw API key from an incoming request and returns the
 * owning userId, or null if the key is missing/unknown/revoked. Best-
 * effort updates `lastUsedAt` (a failure there shouldn't fail the
 * request the key is authenticating).
 */
export async function verifyApiKey(rawKey: string): Promise<{ userId: string; keyId: string } | null> {
  if (!rawKey.startsWith(KEY_PREFIX)) return null

  const hash = hashKey(rawKey)
  const rows = await db
    .select({ id: apiKeys.id, userId: apiKeys.userId, revokedAt: apiKeys.revokedAt })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hash))
    .limit(1)

  const row = rows[0]
  if (!row || row.revokedAt) return null

  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .catch(() => {
      // Best-effort — a failed lastUsedAt bump shouldn't fail auth.
    })

  return { userId: row.userId, keyId: row.id }
}

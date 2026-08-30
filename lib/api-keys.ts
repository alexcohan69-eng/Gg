import crypto from "node:crypto"
import { and, desc, eq, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { apiKeys } from "@/lib/db/schema"

/**
 * Issuing/verification helpers for the public developer API's
 * `pk_live_...` bearer-token keys (see backendApi.md). Only the
 * SHA-256 hash of the raw secret is ever stored — `createApiKey` is
 * the one place the raw key exists, and only for the duration of that
 * call. Every function here scopes strictly by `userId` so a user can
 * only ever list/revoke/act as their own keys, never another user's.
 */

const KEY_PREFIX = "pk_live_"

function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex")
}

/** Public shape of a key row — never includes the hash or the raw secret. */
export type ApiKeySummary = {
  id: string
  name: string
  keyPreview: string
  lastUsedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
}

/**
 * Generates a new raw key, stores only its hash, and returns the raw
 * value once. Callers (the /settings/developer server action) must
 * show this to the user immediately and never persist it themselves —
 * there is no way to retrieve it again after this call returns.
 */
export async function createApiKey(
  userId: string,
  name: string,
): Promise<{ id: string; rawKey: string; name: string; createdAt: Date }> {
  const secret = crypto.randomBytes(24).toString("base64url")
  const rawKey = `${KEY_PREFIX}${secret}`
  const id = crypto.randomUUID()
  const createdAt = new Date()

  await db.insert(apiKeys).values({
    id,
    userId,
    name,
    keyHash: hashKey(rawKey),
    keyPreview: rawKey.slice(-4),
    createdAt,
  })

  return { id, rawKey, name, createdAt }
}

/** All keys belonging to a user, newest first — never returns the hash. */
export async function listApiKeys(userId: string): Promise<ApiKeySummary[]> {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPreview: apiKeys.keyPreview,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(desc(apiKeys.createdAt))
}

/**
 * Revokes a key. Scoped by both `id` AND `userId` so a user can only
 * ever revoke a key that belongs to them — passing another user's key
 * id here is a silent no-op (returns false), never a cross-account
 * mutation.
 */
export async function revokeApiKey(userId: string, keyId: string): Promise<boolean> {
  const [row] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id })

  return Boolean(row)
}

/**
 * Verifies a raw bearer-token key from an incoming request. Returns
 * the owning `userId` if the key exists and hasn't been revoked, or
 * `null` otherwise (unknown key, revoked key, malformed key). Updates
 * `lastUsedAt` best-effort — a failure there never blocks the request
 * this key is authenticating.
 */
export async function verifyApiKey(rawKey: string): Promise<string | null> {
  if (!rawKey.startsWith(KEY_PREFIX)) return null

  const [row] = await db
    .select({ id: apiKeys.id, userId: apiKeys.userId, revokedAt: apiKeys.revokedAt })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hashKey(rawKey)))
    .limit(1)

  if (!row || row.revokedAt) return null

  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .catch(() => {
      // Best-effort — updating the "last used" timestamp should never
      // fail the actual authenticated request.
    })

  return row.userId
}

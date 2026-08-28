import { createHash, randomBytes } from "node:crypto"
import { and, eq, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { apiKeys } from "@/lib/db/schema"

/**
 * Personal API keys for the public REST API (`/api/v1/*`). Raw keys
 * look like `pk_live_<43 base64url chars>` and are only ever shown to
 * the user once, at creation time — every other read/write goes
 * through the SHA-256 hash stored in `keyHash`. This mirrors a normal
 * bearer-token API key scheme without pulling in a new dependency.
 */

const KEY_PREFIX = "pk_live_"

export type ApiKeySummary = {
  id: string
  name: string
  keyPrefix: string
  lastUsedAt: Date | null
  createdAt: Date
  revokedAt: Date | null
}

function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex")
}

/**
 * Creates a new API key for `userId`. Returns the raw secret exactly
 * once — callers must show it to the user immediately and must not
 * persist it anywhere else; only the hash is stored server-side.
 */
export async function createApiKey(
  userId: string,
  name: string,
): Promise<{ id: string; rawKey: string; keyPrefix: string; createdAt: Date }> {
  const rawKey = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`
  const keyPrefix = rawKey.slice(0, 12)
  const id = crypto.randomUUID()
  const createdAt = new Date()

  await db.insert(apiKeys).values({
    id,
    userId,
    name: name.trim() || "Unnamed key",
    keyHash: hashKey(rawKey),
    keyPrefix,
    createdAt,
  })

  return { id, rawKey, keyPrefix, createdAt }
}

/** Lists all non-revoked and revoked keys for a user, newest first. */
export async function listApiKeys(userId: string): Promise<ApiKeySummary[]> {
  const rows = await db
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

  return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

/** Revokes a key. Scoped to `userId` so a user can only revoke their own keys. */
export async function revokeApiKey(userId: string, keyId: string): Promise<boolean> {
  const result = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id })

  return result.length > 0
}

/**
 * Resolves a raw `Authorization: Bearer <key>` value to a userId.
 * Returns `null` for an unknown, malformed, or revoked key. Updates
 * `lastUsedAt` best-effort (fire-and-forget) — a failure to record
 * last-used time should never block the request it's authenticating.
 */
export async function verifyApiKey(rawKey: string): Promise<{ userId: string; keyId: string } | null> {
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
    .catch((error) => console.error("[v0] Failed to update apiKeys.lastUsedAt:", error))

  return { userId: row.userId, keyId: row.id }
}

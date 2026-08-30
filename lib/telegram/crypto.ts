import crypto from "node:crypto"

/**
 * Encrypts/decrypts a user's own ("BYO") Telegram bot token at rest.
 * A bot token is as sensitive as a password for that bot — whoever
 * holds it can send messages as it — so it's never stored or logged
 * in plaintext (see usertgbot.md). Keyed by `TELEGRAM_TOKEN_ENCRYPTION_KEY`,
 * a 32-byte value set via project env vars.
 *
 * AES-256-GCM: a random 12-byte IV per encryption, with the GCM auth
 * tag appended so tampering is detected on decrypt rather than
 * silently producing garbage. Output is a single base64url string:
 * `<iv><ciphertext><tag>`.
 */

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
  const raw = process.env.TELEGRAM_TOKEN_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      "[v0] Missing TELEGRAM_TOKEN_ENCRYPTION_KEY. Set a 32-byte random value in the project's environment configuration before linking a custom Telegram bot.",
    )
  }
  // Accept either a raw 32-byte utf8 string or a base64/hex-encoded
  // value — normalize to exactly 32 bytes via SHA-256 so any
  // reasonably random input the user pastes in works as a key.
  return crypto.createHash("sha256").update(raw).digest()
}

export function encryptBotToken(rawToken: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(rawToken, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, ciphertext, authTag]).toString("base64url")
}

export function decryptBotToken(encoded: string): string {
  const buffer = Buffer.from(encoded, "base64url")
  const iv = buffer.subarray(0, IV_LENGTH)
  const authTag = buffer.subarray(buffer.length - AUTH_TAG_LENGTH)
  const ciphertext = buffer.subarray(IV_LENGTH, buffer.length - AUTH_TAG_LENGTH)

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}

/** A random 6-digit numeric code for the ownership-verification step. */
export function generateVerificationCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0")
}

/** A random, URL-safe secret used as a per-link webhook path segment + Telegram `secret_token`. */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(24).toString("base64url")
}

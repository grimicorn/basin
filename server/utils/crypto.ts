// Encrypts/decrypts third-party integration tokens (YouTube OAuth tokens,
// Bluesky JWTs, Bluesky app passwords) before they touch the database. See
// docs/api-auth-storage.md for the design this implements.
//
// AES-256-GCM is authenticated encryption: decrypt() also verifies the auth
// tag, so a tampered or corrupted stored value throws instead of silently
// returning garbage.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const KEY_LENGTH_BYTES = 32;
const STORED_VALUE_SEPARATOR = ":";

// Self-describing ciphertext shape: iv:authTag:ciphertext, with iv/authTag
// pinned to their fixed AES-256-GCM lengths. A real OAuth access/refresh
// token, JWT, or app password essentially never happens to match this exact
// hex/length pattern, so it doubles as a reliable detector for legacy rows
// that were written before encryption existed.
const ENCRYPTED_VALUE_PATTERN = new RegExp(
  `^[0-9a-f]{${IV_LENGTH_BYTES * 2}}:[0-9a-f]{${AUTH_TAG_LENGTH_BYTES * 2}}:[0-9a-f]*$`,
  "i",
);

export class TokenEncryptionKeyError extends Error {}

function getEncryptionKey(): Buffer {
  const hexKey = process.env.TOKEN_ENCRYPTION_KEY;

  if (!hexKey) {
    throw new TokenEncryptionKeyError(
      "TOKEN_ENCRYPTION_KEY is not set. Generate one with `openssl rand -hex 32` " +
        "and add it to your environment.",
    );
  }

  const key = Buffer.from(hexKey, "hex");

  if (key.length !== KEY_LENGTH_BYTES) {
    throw new TokenEncryptionKeyError(
      `TOKEN_ENCRYPTION_KEY must decode to ${KEY_LENGTH_BYTES} bytes of hex ` +
        `(${KEY_LENGTH_BYTES * 2} hex characters); got ${key.length} bytes.`,
    );
  }

  return key;
}

// A fresh random IV every call means ciphertext for identical plaintext
// differs across calls, even with the same key.
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, ciphertext]
    .map((buffer) => buffer.toString("hex"))
    .join(STORED_VALUE_SEPARATOR);
}

export function isEncryptedToken(storedValue: string): boolean {
  return ENCRYPTED_VALUE_PATTERN.test(storedValue);
}

// Throws (TokenEncryptionKeyError for a bad key, or the native decipher
// error for a tampered/corrupt value) rather than swallowing the failure —
// callers should let this propagate.
export function decryptToken(storedValue: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, ciphertextHex] = storedValue.split(
    STORED_VALUE_SEPARATOR,
  );
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

// Tolerant read path for rows written before encryption was added: legacy
// plaintext is detected (see ENCRYPTED_VALUE_PATTERN) and passed through
// unchanged instead of throwing, so existing connections keep working.
// Run scripts/backfill-encrypt-tokens.ts to migrate legacy rows to
// ciphertext — this function does not rewrite the row itself.
export function decryptTokenTolerant(storedValue: string): string {
  if (!isEncryptedToken(storedValue)) {
    return storedValue;
  }

  return decryptToken(storedValue);
}

// Same tolerant behavior as decryptTokenTolerant, for the nullable token
// columns (integrations.refreshToken, integrations.tokenSecret).
export function decryptNullableTokenTolerant(
  storedValue: string | null,
): string | null {
  if (storedValue === null) {
    return null;
  }

  return decryptTokenTolerant(storedValue);
}

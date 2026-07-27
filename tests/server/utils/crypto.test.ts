import { randomBytes } from "node:crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  encryptToken,
  decryptToken,
  isEncryptedToken,
  decryptTokenTolerant,
  decryptNullableTokenTolerant,
  TokenEncryptionKeyError,
  InvalidEncryptedValueError,
} from "../../../server/utils/crypto";

// 32 bytes of hex — a valid AES-256-GCM key.
const VALID_KEY = randomBytes(32).toString("hex");

describe("server/utils/crypto", () => {
  beforeEach(() => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", VALID_KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("encryptToken / decryptToken round trip", () => {
    it("decrypts back to the original plaintext", () => {
      const plaintext = "ya29.a0AfH6SMBxyz-access-token";
      const stored = encryptToken(plaintext);
      expect(decryptToken(stored)).toBe(plaintext);
    });

    it("round-trips an empty string", () => {
      const stored = encryptToken("");
      expect(decryptToken(stored)).toBe("");
    });

    it("round-trips a value that itself contains colons", () => {
      const plaintext = "header.payload.signature:extra:parts";
      const stored = encryptToken(plaintext);
      expect(decryptToken(stored)).toBe(plaintext);
    });

    it("produces different ciphertext across calls for the same plaintext (unique IV)", () => {
      const plaintext = "app-password-xxxx-xxxx-xxxx-xxxx";
      const first = encryptToken(plaintext);
      const second = encryptToken(plaintext);

      expect(first).not.toBe(second);
      // Both still decrypt to the same plaintext.
      expect(decryptToken(first)).toBe(plaintext);
      expect(decryptToken(second)).toBe(plaintext);
    });

    it("stores the value as iv:authTag:ciphertext hex segments", () => {
      const stored = encryptToken("some-token");
      const segments = stored.split(":");
      expect(segments).toHaveLength(3);
      expect(segments[0]).toMatch(/^[0-9a-f]{24}$/); // 12-byte IV
      expect(segments[1]).toMatch(/^[0-9a-f]{32}$/); // 16-byte auth tag
    });
  });

  describe("tamper detection", () => {
    it("throws when the ciphertext is modified", () => {
      const stored = encryptToken("refresh-token-value");
      const [iv, authTag, ciphertext] = stored.split(":");
      const tamperedLastChar =
        ciphertext.slice(0, -1) + (ciphertext.at(-1) === "0" ? "1" : "0");
      const tampered = [iv, authTag, tamperedLastChar].join(":");

      expect(() => decryptToken(tampered)).toThrow();
    });

    it("throws when the auth tag is modified", () => {
      const stored = encryptToken("refresh-token-value");
      const [iv, authTag, ciphertext] = stored.split(":");
      const tamperedLastChar =
        authTag.slice(0, -1) + (authTag.at(-1) === "0" ? "1" : "0");
      const tampered = [iv, tamperedLastChar, ciphertext].join(":");

      expect(() => decryptToken(tampered)).toThrow();
    });

    it("throws InvalidEncryptedValueError (not a bare TypeError) for a malformed stored value", () => {
      expect(() => decryptToken("not-encrypted-at-all")).toThrow(
        InvalidEncryptedValueError,
      );
      expect(() => decryptToken("also:not:right:shape")).toThrow(
        InvalidEncryptedValueError,
      );
    });
  });

  describe("missing or malformed key", () => {
    it("throws TokenEncryptionKeyError on encrypt when the key is missing", () => {
      vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
      expect(() => encryptToken("value")).toThrow(TokenEncryptionKeyError);
    });

    it("throws TokenEncryptionKeyError on decrypt when the key is missing", () => {
      const stored = encryptToken("value");
      vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
      expect(() => decryptToken(stored)).toThrow(TokenEncryptionKeyError);
    });

    it("throws TokenEncryptionKeyError when the key is not valid hex length", () => {
      vi.stubEnv("TOKEN_ENCRYPTION_KEY", "too-short");
      expect(() => encryptToken("value")).toThrow(TokenEncryptionKeyError);
    });

    it("throws TokenEncryptionKeyError when the key decodes to the wrong byte length", () => {
      vi.stubEnv("TOKEN_ENCRYPTION_KEY", "aabbcc"); // valid hex, wrong length
      expect(() => encryptToken("value")).toThrow(TokenEncryptionKeyError);
    });
  });

  describe("isEncryptedToken", () => {
    it("returns true for a real encrypted value", () => {
      expect(isEncryptedToken(encryptToken("value"))).toBe(true);
    });

    it("returns false for a plain OAuth-style access token", () => {
      expect(isEncryptedToken("ya29.a0AfH6SMBxyz-plaintext-token")).toBe(false);
    });

    it("returns false for a plain JWT-shaped string", () => {
      expect(
        isEncryptedToken(
          "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dGVzdA",
        ),
      ).toBe(false);
    });

    it("returns false for a plain app password", () => {
      expect(isEncryptedToken("xxxx-xxxx-xxxx-xxxx")).toBe(false);
    });
  });

  describe("legacy-plaintext tolerant read path", () => {
    it("returns a legacy plaintext value unchanged", () => {
      const legacyPlaintext = "legacy-access-token-stored-before-encryption";
      expect(decryptTokenTolerant(legacyPlaintext)).toBe(legacyPlaintext);
    });

    it("decrypts a properly encrypted value", () => {
      const plaintext = "current-access-token";
      const stored = encryptToken(plaintext);
      expect(decryptTokenTolerant(stored)).toBe(plaintext);
    });

    it("decryptNullableTokenTolerant passes null through unchanged", () => {
      expect(decryptNullableTokenTolerant(null)).toBeNull();
    });

    it("decryptNullableTokenTolerant decrypts a non-null encrypted value", () => {
      const plaintext = "refresh-token";
      const stored = encryptToken(plaintext);
      expect(decryptNullableTokenTolerant(stored)).toBe(plaintext);
    });

    it("decryptNullableTokenTolerant passes a non-null legacy plaintext value through unchanged", () => {
      expect(decryptNullableTokenTolerant("legacy-refresh-token")).toBe(
        "legacy-refresh-token",
      );
    });
  });
});

import { randomBytes } from "node:crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildTokenUpdate } from "../../scripts/backfill-encrypt-tokens";
import { encryptToken, isEncryptedToken } from "../../server/utils/crypto";

const VALID_KEY = randomBytes(32).toString("hex");

describe("buildTokenUpdate", () => {
  beforeEach(() => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", VALID_KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("encrypts a legacy plaintext accessToken", () => {
    const update = buildTokenUpdate({
      id: 1,
      accessToken: "legacy-plaintext-access-token",
      refreshToken: null,
      tokenSecret: null,
    });

    expect(update.accessToken).toBeDefined();
    expect(isEncryptedToken(update.accessToken!)).toBe(true);
    expect(update.refreshToken).toBeUndefined();
    expect(update.tokenSecret).toBeUndefined();
  });

  it("leaves an already-encrypted accessToken untouched", () => {
    const alreadyEncrypted = encryptToken("some-token");
    const update = buildTokenUpdate({
      id: 2,
      accessToken: alreadyEncrypted,
      refreshToken: null,
      tokenSecret: null,
    });

    expect(update.accessToken).toBeUndefined();
  });

  it("encrypts a legacy plaintext refreshToken and tokenSecret", () => {
    const update = buildTokenUpdate({
      id: 3,
      accessToken: encryptToken("already-encrypted-access-token"),
      refreshToken: "legacy-refresh-token",
      tokenSecret: "legacy-app-password",
    });

    expect(update.accessToken).toBeUndefined();
    expect(isEncryptedToken(update.refreshToken!)).toBe(true);
    expect(isEncryptedToken(update.tokenSecret!)).toBe(true);
  });

  it("does not touch a null refreshToken or tokenSecret", () => {
    const update = buildTokenUpdate({
      id: 4,
      accessToken: encryptToken("already-encrypted-access-token"),
      refreshToken: null,
      tokenSecret: null,
    });

    expect(update).toEqual({});
  });

  it("returns an empty update when every field is already encrypted or null", () => {
    const update = buildTokenUpdate({
      id: 5,
      accessToken: encryptToken("access"),
      refreshToken: encryptToken("refresh"),
      tokenSecret: null,
    });

    expect(update).toEqual({});
  });

  it("leaves an already-encrypted refreshToken untouched while still encrypting a legacy tokenSecret", () => {
    const update = buildTokenUpdate({
      id: 6,
      accessToken: encryptToken("access"),
      refreshToken: encryptToken("refresh"),
      tokenSecret: "legacy-app-password",
    });

    expect(update.refreshToken).toBeUndefined();
    expect(isEncryptedToken(update.tokenSecret!)).toBe(true);
  });
});

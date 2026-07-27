import { randomBytes } from "node:crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildTokenUpdate,
  backfillRow,
  backfillRowReportingFailure,
} from "../../scripts/backfill-encrypt-tokens";
import { encryptToken, isEncryptedToken } from "../../server/utils/crypto";

// A minimal stand-in for neon's tagged-template SQL client: records the
// interpolated values from each call and returns a canned result, so
// backfillRow's UPDATE logic can be tested without a real DB connection.
function createFakeSql(results: unknown[][]) {
  const calls: unknown[][] = [];
  let callIndex = 0;

  const fakeSql = vi.fn(
    async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push(values);
      const result = results[callIndex] ?? [];
      callIndex += 1;
      return result;
    },
  );

  return { fakeSql, calls };
}

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

describe("backfillRow", () => {
  beforeEach(() => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", VALID_KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns already-encrypted and never touches the DB when nothing is legacy plaintext", async () => {
    const { fakeSql } = createFakeSql([]);
    const row = {
      id: 9,
      accessToken: encryptToken("already-encrypted"),
      refreshToken: null,
      tokenSecret: null,
    };

    const outcome = await backfillRow(fakeSql, row);

    expect(outcome).toBe("already-encrypted");
    expect(fakeSql).not.toHaveBeenCalled();
  });

  it("returns updated and guards the WHERE clause with the row's original values, including nulls", async () => {
    const { fakeSql, calls } = createFakeSql([[{ id: 7 }]]); // RETURNING id — one row matched

    const row = {
      id: 7,
      accessToken: "legacy-plaintext-access",
      refreshToken: null,
      tokenSecret: null,
    };

    const outcome = await backfillRow(fakeSql, row);

    expect(outcome).toBe("updated");
    expect(fakeSql).toHaveBeenCalledTimes(1);

    const [
      nextAccessToken,
      nextRefreshToken,
      nextTokenSecret,
      whereId,
      whereAccessToken,
      whereRefreshToken,
      whereTokenSecret,
    ] = calls[0];
    expect(isEncryptedToken(nextAccessToken as string)).toBe(true);
    expect(nextRefreshToken).toBeNull();
    expect(nextTokenSecret).toBeNull();
    expect(whereId).toBe(7);
    expect(whereAccessToken).toBe("legacy-plaintext-access");
    expect(whereRefreshToken).toBeNull();
    expect(whereTokenSecret).toBeNull();
  });

  it("returns skipped-concurrent-change when the WHERE guard matches no rows (RETURNING comes back empty)", async () => {
    // Simulates a user reconnecting between the SELECT and this UPDATE: the
    // row's live values no longer match what backfillRow read, so the guard
    // doesn't match and the stale write becomes a no-op.
    const { fakeSql } = createFakeSql([[]]);

    const row = {
      id: 8,
      accessToken: "legacy-plaintext-access",
      refreshToken: "legacy-plaintext-refresh",
      tokenSecret: null,
    };

    const outcome = await backfillRow(fakeSql, row);

    expect(outcome).toBe("skipped-concurrent-change");
  });
});

describe("backfillRowReportingFailure", () => {
  beforeEach(() => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", VALID_KEY);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the underlying outcome when the row backfills successfully", async () => {
    const { fakeSql } = createFakeSql([[{ id: 1 }]]);
    const row = {
      id: 1,
      accessToken: "legacy-plaintext-access",
      refreshToken: null,
      tokenSecret: null,
    };

    const outcome = await backfillRowReportingFailure(fakeSql, row);

    expect(outcome).toBe("updated");
  });

  it('catches a row-level failure, logs it, and returns "failed" instead of throwing', async () => {
    const failingSql = vi.fn(async () => {
      throw new Error("connection reset");
    });
    const row = {
      id: 2,
      accessToken: "legacy-plaintext-access",
      refreshToken: null,
      tokenSecret: null,
    };

    const outcome = await backfillRowReportingFailure(failingSql, row);

    expect(outcome).toBe("failed");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("integration 2 failed to backfill"),
      expect.any(Error),
    );
  });
});

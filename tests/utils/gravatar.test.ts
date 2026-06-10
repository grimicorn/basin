import { describe, it, expect } from "vitest";
import { gravatarUrl, normalizeEmail } from "~/utils/gravatar";

describe("normalizeEmail", () => {
  it("lowercases the email", () => {
    expect(normalizeEmail("User@Example.COM")).toBe("user@example.com");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeEmail("  user@example.com  ")).toBe("user@example.com");
  });

  it("lowercases and trims together", () => {
    expect(normalizeEmail("  USER@EXAMPLE.COM  ")).toBe("user@example.com");
  });
});

describe("gravatarUrl", () => {
  it("returns a URL with the correct MD5 hash for a known email", () => {
    // MD5("test@example.com") = 55502f40dc8b7c769880b10874abc9d0
    const url = gravatarUrl("test@example.com");
    expect(url).toContain("55502f40dc8b7c769880b10874abc9d0");
  });

  it("includes d=404 so missing avatars return 404", () => {
    const url = gravatarUrl("test@example.com");
    expect(url).toContain("d=404");
  });

  it("uses the default size of 80 when no size is given", () => {
    const url = gravatarUrl("test@example.com");
    expect(url).toContain("s=80");
  });

  it("uses the provided size parameter", () => {
    const url = gravatarUrl("test@example.com", 200);
    expect(url).toContain("s=200");
  });

  it("normalizes the email before hashing (uppercase input matches lowercase)", () => {
    const urlLower = gravatarUrl("test@example.com");
    const urlUpper = gravatarUrl("TEST@EXAMPLE.COM");
    expect(urlLower).toBe(urlUpper);
  });

  it("returns a gravatar.com URL", () => {
    const url = gravatarUrl("test@example.com");
    expect(url).toMatch(/^https:\/\/www\.gravatar\.com\/avatar\//);
  });
});

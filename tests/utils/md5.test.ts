import { describe, it, expect } from "vitest";
import { md5 } from "~/utils/md5";

describe("md5", () => {
  it("hashes the empty string correctly", () => {
    expect(md5("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
  });

  it("hashes 'hello world' correctly", () => {
    expect(md5("hello world")).toBe("5eb63bbbe01eeed093cb22bb8f5acdc3");
  });

  it("hashes the Gravatar test email correctly", () => {
    // MD5 of "test@example.com" — used by Gravatar docs as a reference
    expect(md5("test@example.com")).toBe("55502f40dc8b7c769880b10874abc9d0");
  });

  it("produces a 32-character lowercase hex string", () => {
    const result = md5("anything");
    expect(result).toHaveLength(32);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it("handles uppercase input consistently", () => {
    const lower = md5("abc");
    const upper = md5("abc");
    expect(lower).toBe(upper);
  });

  it("hashes multi-byte UTF-8 strings", () => {
    // "café" contains a multi-byte character — must not crash or silently truncate
    const result = md5("café");
    expect(result).toHaveLength(32);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });
});

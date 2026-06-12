import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dnsModule from "dns";

// Mock createError as it's a Nuxt/H3 global
vi.stubGlobal(
  "createError",
  (options: { statusCode: number; statusMessage: string }) => {
    const error = new Error(options.statusMessage) as Error & {
      statusCode: number;
    };
    error.statusCode = options.statusCode;
    return error;
  },
);

import { validateFeedUrl } from "../../../server/utils/urlValidator";

const mockResolve = vi.spyOn(dnsModule.promises, "resolve");

describe("validateFeedUrl", () => {
  beforeEach(() => {
    mockResolve.mockReset();
  });

  describe("scheme validation", () => {
    it("rejects URLs with non-http/https schemes", async () => {
      await expect(validateFeedUrl("ftp://example.com/feed")).rejects.toThrow(
        "URL must use http or https",
      );
    });

    it("rejects file:// URLs", async () => {
      await expect(validateFeedUrl("file:///etc/passwd")).rejects.toThrow(
        "URL must use http or https",
      );
    });

    it("accepts http URLs", async () => {
      mockResolve.mockResolvedValueOnce(["93.184.216.34"]);
      const result = await validateFeedUrl("http://example.com/feed");
      expect(result).toBe("http://example.com/feed");
    });

    it("accepts https URLs", async () => {
      mockResolve.mockResolvedValueOnce(["93.184.216.34"]);
      const result = await validateFeedUrl("https://example.com/feed");
      expect(result).toBe("https://example.com/feed");
    });
  });

  describe("invalid URL format", () => {
    it("rejects non-URL strings", async () => {
      await expect(validateFeedUrl("not a url")).rejects.toThrow("Invalid URL");
    });

    it("rejects empty strings", async () => {
      await expect(validateFeedUrl("")).rejects.toThrow("Invalid URL");
    });
  });

  describe("blocked IPv4 ranges (direct IP in URL)", () => {
    it("rejects loopback address 127.0.0.1", async () => {
      await expect(validateFeedUrl("http://127.0.0.1/feed")).rejects.toThrow(
        "URL resolves to a disallowed address",
      );
    });

    it("rejects loopback address 127.0.0.2", async () => {
      await expect(validateFeedUrl("http://127.0.0.2/feed")).rejects.toThrow(
        "URL resolves to a disallowed address",
      );
    });

    it("rejects RFC1918 10.x.x.x", async () => {
      await expect(validateFeedUrl("http://10.0.0.1/feed")).rejects.toThrow(
        "URL resolves to a disallowed address",
      );
    });

    it("rejects RFC1918 172.16.x.x", async () => {
      await expect(validateFeedUrl("http://172.16.0.1/feed")).rejects.toThrow(
        "URL resolves to a disallowed address",
      );
    });

    it("rejects RFC1918 192.168.x.x", async () => {
      await expect(validateFeedUrl("http://192.168.1.1/feed")).rejects.toThrow(
        "URL resolves to a disallowed address",
      );
    });

    it("rejects link-local 169.254.x.x", async () => {
      await expect(
        validateFeedUrl("http://169.254.169.254/latest/meta-data/"),
      ).rejects.toThrow("URL resolves to a disallowed address");
    });
  });

  describe("blocked IPv6 addresses (direct IP in URL)", () => {
    it("rejects IPv6 loopback ::1", async () => {
      await expect(validateFeedUrl("http://[::1]/feed")).rejects.toThrow(
        "URL resolves to a disallowed address",
      );
    });

    it("rejects IPv6 link-local fe80::", async () => {
      await expect(validateFeedUrl("http://[fe80::1]/feed")).rejects.toThrow(
        "URL resolves to a disallowed address",
      );
    });
  });

  describe("DNS resolution blocking", () => {
    it("rejects when the host resolves to a loopback address", async () => {
      mockResolve.mockResolvedValueOnce(["127.0.0.1"]);
      await expect(
        validateFeedUrl("http://internal.example.com/feed"),
      ).rejects.toThrow("URL resolves to a disallowed address");
    });

    it("rejects when the host resolves to a private RFC1918 address", async () => {
      mockResolve.mockResolvedValueOnce(["192.168.5.10"]);
      await expect(
        validateFeedUrl("http://corp-internal.example.com/feed"),
      ).rejects.toThrow("URL resolves to a disallowed address");
    });

    it("rejects when DNS resolution fails", async () => {
      mockResolve.mockRejectedValueOnce(new Error("ENOTFOUND"));
      await expect(
        validateFeedUrl("http://does-not-exist.invalid/feed"),
      ).rejects.toThrow("Could not resolve host");
    });

    it("allows a public IP address", async () => {
      mockResolve.mockResolvedValueOnce(["93.184.216.34"]);
      const result = await validateFeedUrl("https://example.com");
      expect(result).toBe("https://example.com/");
    });
  });
});

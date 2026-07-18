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

import {
  validateFeedUrl,
  resolvePublicFeedUrl,
  FeedUrlValidationError,
} from "../../../server/utils/urlValidator";

const mockResolve4 = vi.spyOn(dnsModule.promises, "resolve4");
const mockResolve6 = vi.spyOn(dnsModule.promises, "resolve6");

describe("validateFeedUrl", () => {
  beforeEach(() => {
    mockResolve4.mockReset();
    mockResolve6.mockReset();
    // Default: IPv6 fails (no AAAA records), IPv4 succeeds with a public address
    mockResolve4.mockResolvedValue(["93.184.216.34"]);
    mockResolve6.mockRejectedValue(new Error("ENODATA"));
    // Clear any test allowlist from the environment
    delete process.env.NUXT_FEED_DISCOVERY_ALLOWED_HOSTS;
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
      const result = await validateFeedUrl("http://example.com/feed");
      expect(result).toBe("http://example.com/feed");
    });

    it("accepts https URLs", async () => {
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

  describe("blocked loopback hostname", () => {
    it("rejects the literal hostname localhost without a DNS lookup", async () => {
      await expect(validateFeedUrl("http://localhost/feed")).rejects.toThrow(
        "URL resolves to a disallowed address",
      );
      expect(mockResolve4).not.toHaveBeenCalled();
      expect(mockResolve6).not.toHaveBeenCalled();
    });

    it("rejects localhost case-insensitively", async () => {
      await expect(validateFeedUrl("http://LOCALHOST/feed")).rejects.toThrow(
        "URL resolves to a disallowed address",
      );
    });

    it("rejects localhost with a port", async () => {
      await expect(
        validateFeedUrl("http://localhost:8080/feed"),
      ).rejects.toThrow("URL resolves to a disallowed address");
    });

    it("rejects the FQDN root-label form localhost.", async () => {
      await expect(validateFeedUrl("http://localhost./feed")).rejects.toThrow(
        "URL resolves to a disallowed address",
      );
      expect(mockResolve4).not.toHaveBeenCalled();
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

    it("rejects IPv6 link-local fe90:: (fe80::/10 range)", async () => {
      await expect(validateFeedUrl("http://[fe90::1]/feed")).rejects.toThrow(
        "URL resolves to a disallowed address",
      );
    });

    it("rejects IPv6 link-local febf:: (fe80::/10 range)", async () => {
      await expect(validateFeedUrl("http://[febf::1]/feed")).rejects.toThrow(
        "URL resolves to a disallowed address",
      );
    });

    it("rejects IPv6 ULA fc00::", async () => {
      await expect(validateFeedUrl("http://[fc00::1]/feed")).rejects.toThrow(
        "URL resolves to a disallowed address",
      );
    });

    it("rejects IPv6 ULA fd00::", async () => {
      await expect(validateFeedUrl("http://[fd00::1]/feed")).rejects.toThrow(
        "URL resolves to a disallowed address",
      );
    });

    it("rejects IPv6 unspecified ::", async () => {
      await expect(validateFeedUrl("http://[::]/feed")).rejects.toThrow(
        "URL resolves to a disallowed address",
      );
    });

    it("rejects IPv6 multicast ff02::", async () => {
      await expect(validateFeedUrl("http://[ff02::1]/feed")).rejects.toThrow(
        "URL resolves to a disallowed address",
      );
    });

    it("rejects IPv4-mapped IPv6 ::ffff:127.0.0.1 (dotted-decimal form)", async () => {
      await expect(
        validateFeedUrl("http://[::ffff:127.0.0.1]/feed"),
      ).rejects.toThrow("URL resolves to a disallowed address");
    });

    it("rejects IPv4-mapped IPv6 ::ffff:192.168.1.1 (dotted-decimal form)", async () => {
      await expect(
        validateFeedUrl("http://[::ffff:192.168.1.1]/feed"),
      ).rejects.toThrow("URL resolves to a disallowed address");
    });
  });

  describe("DNS resolution blocking", () => {
    it("rejects when the host resolves to a loopback IPv4 address", async () => {
      mockResolve4.mockResolvedValueOnce(["127.0.0.1"]);
      mockResolve6.mockRejectedValueOnce(new Error("ENODATA"));
      await expect(
        validateFeedUrl("http://internal.example.com/feed"),
      ).rejects.toThrow("URL resolves to a disallowed address");
    });

    it("rejects when the host resolves to a private RFC1918 IPv4 address", async () => {
      mockResolve4.mockResolvedValueOnce(["192.168.5.10"]);
      mockResolve6.mockRejectedValueOnce(new Error("ENODATA"));
      await expect(
        validateFeedUrl("http://corp-internal.example.com/feed"),
      ).rejects.toThrow("URL resolves to a disallowed address");
    });

    it("rejects when the host resolves to a blocked IPv6 address", async () => {
      mockResolve4.mockRejectedValueOnce(new Error("ENODATA"));
      mockResolve6.mockResolvedValueOnce(["::1"]);
      await expect(
        validateFeedUrl("http://ipv6-internal.example.com/feed"),
      ).rejects.toThrow("URL resolves to a disallowed address");
    });

    it("rejects when both A and AAAA DNS lookups fail", async () => {
      mockResolve4.mockRejectedValueOnce(new Error("ENOTFOUND"));
      mockResolve6.mockRejectedValueOnce(new Error("ENOTFOUND"));
      await expect(
        validateFeedUrl("http://does-not-exist.invalid/feed"),
      ).rejects.toThrow("Could not resolve host");
    });

    it("allows a public IPv4 address", async () => {
      mockResolve4.mockResolvedValueOnce(["93.184.216.34"]);
      mockResolve6.mockRejectedValueOnce(new Error("ENODATA"));
      const result = await validateFeedUrl("https://example.com");
      expect(result).toBe("https://example.com/");
    });

    it("does not block legitimate domains that start with fc or fd", async () => {
      // Regression test: isBlockedIpv6's ULA (fc00::/7) check must only match
      // actual IPv6 notation, not the first two characters of an arbitrary
      // hostname — otherwise domains like fdroid.org get falsely blocked.
      mockResolve4.mockResolvedValueOnce(["93.184.216.34"]);
      mockResolve6.mockRejectedValueOnce(new Error("ENODATA"));
      const result = await validateFeedUrl("https://fdroid.org/feed.xml");
      expect(result).toBe("https://fdroid.org/feed.xml");
    });

    it("allows a host that resolves to public IPv4 even when AAAA lookup fails", async () => {
      mockResolve4.mockResolvedValueOnce(["93.184.216.34"]);
      mockResolve6.mockRejectedValueOnce(new Error("ENODATA"));
      const result = await validateFeedUrl("https://example.com/feed");
      expect(result).toBe("https://example.com/feed");
    });
  });

  describe("allowlist bypass for testing", () => {
    it("allows a loopback host:port that is explicitly allowlisted", async () => {
      process.env.NUXT_FEED_DISCOVERY_ALLOWED_HOSTS = "127.0.0.1:3099";
      const result = await validateFeedUrl("http://127.0.0.1:3099/feed.xml");
      expect(result).toBe("http://127.0.0.1:3099/feed.xml");
    });

    it("still blocks a loopback address that is NOT in the allowlist", async () => {
      process.env.NUXT_FEED_DISCOVERY_ALLOWED_HOSTS = "127.0.0.1:3099";
      await expect(validateFeedUrl("http://127.0.0.1/feed")).rejects.toThrow(
        "URL resolves to a disallowed address",
      );
    });

    it("blocks a loopback address when the allowlist is empty", async () => {
      process.env.NUXT_FEED_DISCOVERY_ALLOWED_HOSTS = "";
      await expect(validateFeedUrl("http://127.0.0.1/feed")).rejects.toThrow(
        "URL resolves to a disallowed address",
      );
    });
  });
});

// resolvePublicFeedUrl is the framework-agnostic core validateFeedUrl wraps.
// It has no dependency on H3's createError, so callers outside an H3 request
// context (e.g. Netlify Functions) can use it directly — see rssAdapter.ts
// and podcastAdapter.ts, which call it from netlify/functions/sync-feed.ts.
describe("resolvePublicFeedUrl", () => {
  beforeEach(() => {
    mockResolve4.mockReset();
    mockResolve6.mockReset();
    mockResolve4.mockResolvedValue(["93.184.216.34"]);
    mockResolve6.mockRejectedValue(new Error("ENODATA"));
    delete process.env.NUXT_FEED_DISCOVERY_ALLOWED_HOSTS;
  });

  it("resolves to the normalized URL for a public host", async () => {
    const result = await resolvePublicFeedUrl("https://example.com/feed.xml");
    expect(result).toBe("https://example.com/feed.xml");
  });

  it("throws a FeedUrlValidationError (not an H3 error) for a blocked address", async () => {
    await expect(
      resolvePublicFeedUrl("http://127.0.0.1/feed"),
    ).rejects.toBeInstanceOf(FeedUrlValidationError);
  });

  it("carries a 400 statusCode on the thrown error for later H3 translation", async () => {
    try {
      await resolvePublicFeedUrl("http://192.168.1.1/feed");
      expect.unreachable("expected resolvePublicFeedUrl to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(FeedUrlValidationError);
      expect((err as FeedUrlValidationError).statusCode).toBe(400);
      expect((err as FeedUrlValidationError).message).toBe(
        "URL resolves to a disallowed address",
      );
    }
  });

  it("rejects a hostname that resolves to a private IP, e.g. via DNS rebinding", async () => {
    mockResolve4.mockResolvedValueOnce(["10.0.0.5"]);
    mockResolve6.mockRejectedValueOnce(new Error("ENODATA"));
    await expect(
      resolvePublicFeedUrl("http://rebound.example.com/feed"),
    ).rejects.toThrow("URL resolves to a disallowed address");
  });
});

import { promises as dns } from "dns";

const ALLOWED_SCHEMES = ["http:", "https:"];

// IPv4 CIDR ranges that must never be reached from the server side.
// Covers loopback (127.0.0.0/8), RFC1918 private ranges (10/8, 172.16/12,
// 192.168/16), link-local (169.254.0.0/16), and localhost (0.0.0.0).
const BLOCKED_IPV4_RANGES: Array<{ prefix: number[]; bits: number }> = [
  { prefix: [127], bits: 8 },
  { prefix: [10], bits: 8 },
  { prefix: [172, 16], bits: 12 },
  { prefix: [192, 168], bits: 16 },
  { prefix: [169, 254], bits: 16 },
  { prefix: [0], bits: 8 },
];

// Hosts explicitly allowed for local development and e2e testing only.
// Set NUXT_FEED_DISCOVERY_ALLOWED_HOSTS to a comma-separated list of
// host:port strings (e.g. "127.0.0.1:3099") to bypass SSRF checks.
function allowedTestHosts(): Set<string> {
  const raw = process.env.NUXT_FEED_DISCOVERY_ALLOWED_HOSTS ?? "";
  const hosts = raw
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
  return new Set(hosts);
}

function parseIpv4Octets(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map(Number);
  if (octets.some((octet) => isNaN(octet) || octet < 0 || octet > 255))
    return null;
  return octets;
}

function isBlockedIpv4(address: string): boolean {
  const octets = parseIpv4Octets(address);
  if (!octets) return false;

  return BLOCKED_IPV4_RANGES.some(({ prefix, bits }) => {
    const fullOctets = Math.floor(bits / 8);
    const remainderBits = bits % 8;

    const prefixBytesMatch = prefix.every(
      (byte, index) => index >= fullOctets || octets[index] === byte,
    );
    if (!prefixBytesMatch) return false;

    if (remainderBits === 0) return true;

    const mask = 0xff & (0xff << (8 - remainderBits));
    return (octets[fullOctets] & mask) === (prefix[fullOctets] & mask);
  });
}

function stripIpv6Brackets(address: string): string {
  if (address.startsWith("[") && address.endsWith("]")) {
    return address.slice(1, -1);
  }
  return address;
}

// Check whether an IPv4-mapped IPv6 address (::ffff:x.x.x.x) maps to a
// blocked IPv4 range. Handles both colon notation (::ffff:192.168.1.1) and
// hex notation (::ffff:c0a8:0101).
function isBlockedIpv4MappedAddress(normalized: string): boolean {
  const mappedPrefix = "::ffff:";
  if (!normalized.startsWith(mappedPrefix)) return false;

  const suffix = normalized.slice(mappedPrefix.length);

  // Dotted-decimal form: ::ffff:192.168.1.1
  if (suffix.includes(".")) return isBlockedIpv4(suffix);

  // Hex form: ::ffff:c0a8:0101 — convert two 16-bit hex groups to four octets
  const hexParts = suffix.split(":");
  if (hexParts.length !== 2) return false;

  const high = parseInt(hexParts[0], 16);
  const low = parseInt(hexParts[1], 16);
  if (isNaN(high) || isNaN(low)) return false;

  const octets = [
    (high >> 8) & 0xff,
    high & 0xff,
    (low >> 8) & 0xff,
    low & 0xff,
  ];
  return isBlockedIpv4(octets.join("."));
}

function isBlockedIpv6(address: string): boolean {
  const normalized = stripIpv6Brackets(address).toLowerCase();

  // Loopback
  if (normalized === "::1") return true;

  // Unspecified address
  if (normalized === "::") return true;

  // Link-local (fe80::/10 — second byte 0x80–0xbf, i.e. fe80–febf)
  if (/^fe[89ab][0-9a-f]:/.test(normalized)) return true;

  // ULA (fc00::/7 — covers fc00:: and fd00::)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;

  // Multicast (ff00::/8)
  if (normalized.startsWith("ff")) return true;

  // IPv4-mapped / IPv4-embedded (::ffff:x.x.x.x)
  if (isBlockedIpv4MappedAddress(normalized)) return true;

  return false;
}

function isBlockedAddress(address: string): boolean {
  return isBlockedIpv4(address) || isBlockedIpv6(address);
}

async function resolveAllAddresses(hostname: string): Promise<string[]> {
  const [ipv4Results, ipv6Results] = await Promise.allSettled([
    dns.resolve4(hostname),
    dns.resolve6(hostname),
  ]);

  const addresses: string[] = [];

  if (ipv4Results.status === "fulfilled") {
    addresses.push(...ipv4Results.value);
  }
  if (ipv6Results.status === "fulfilled") {
    addresses.push(...ipv6Results.value);
  }

  return addresses;
}

export async function validateFeedUrl(rawUrl: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Invalid URL" });
  }

  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
    throw createError({
      statusCode: 400,
      statusMessage: "URL must use http or https",
    });
  }

  const { hostname, port } = parsed;
  const hostWithPort = port ? `${hostname}:${port}` : hostname;

  // Allow explicitly allowlisted hosts (for local dev and e2e testing only).
  if (allowedTestHosts().has(hostWithPort)) {
    return parsed.href;
  }

  if (isBlockedAddress(hostname)) {
    throw createError({
      statusCode: 400,
      statusMessage: "URL resolves to a disallowed address",
    });
  }

  let addresses: string[];
  try {
    addresses = await resolveAllAddresses(hostname);
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: "Could not resolve host",
    });
  }

  if (addresses.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Could not resolve host",
    });
  }

  const blockedAddress = addresses.find(isBlockedAddress);
  if (blockedAddress) {
    throw createError({
      statusCode: 400,
      statusMessage: "URL resolves to a disallowed address",
    });
  }

  return parsed.href;
}

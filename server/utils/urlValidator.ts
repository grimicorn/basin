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

function isBlockedIpv6(address: string): boolean {
  const normalized = stripIpv6Brackets(address).toLowerCase();
  return normalized === "::1" || normalized.startsWith("fe80:");
}

function isBlockedAddress(address: string): boolean {
  return isBlockedIpv4(address) || isBlockedIpv6(address);
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

  const { hostname } = parsed;

  if (isBlockedAddress(hostname)) {
    throw createError({
      statusCode: 400,
      statusMessage: "URL resolves to a disallowed address",
    });
  }

  let addresses: string[];
  try {
    addresses = await dns.resolve(hostname);
  } catch {
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

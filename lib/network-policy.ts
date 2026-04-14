import { isIP } from "node:net";

export type IpScope =
  | "public"
  | "private"
  | "loopback"
  | "link-local"
  | "multicast"
  | "reserved"
  | "documentation"
  | "carrier-grade-nat"
  | "unique-local"
  | "unspecified";

const BLOCKED_HOSTNAMES = new Set(["localhost", "ip6-localhost", "ip6-loopback"]);
const BLOCKED_SUFFIXES = [
  ".localhost",
  ".local",
  ".localdomain",
  ".internal",
  ".home.arpa",
];

function normalizeHostname(hostname: string) {
  return hostname.trim().toLowerCase().replace(/\.$/, "");
}

function parseIpv4(ip: string) {
  const parts = ip.split(".").map((part) => Number.parseInt(part, 10));
  return parts.length === 4 && parts.every((part) => Number.isInteger(part))
    ? parts
    : null;
}

function classifyIpv4(ip: string): IpScope {
  const parts = parseIpv4(ip);

  if (!parts) {
    return "reserved";
  }

  const [a, b, c] = parts;

  if (a === 0) {
    return "unspecified";
  }

  if (a === 10) {
    return "private";
  }

  if (a === 100 && b >= 64 && b <= 127) {
    return "carrier-grade-nat";
  }

  if (a === 127) {
    return "loopback";
  }

  if (a === 169 && b === 254) {
    return "link-local";
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return "private";
  }

  if (a === 192 && b === 168) {
    return "private";
  }

  if (a === 192 && b === 0 && c === 2) {
    return "documentation";
  }

  if (a === 198 && b === 51 && c === 100) {
    return "documentation";
  }

  if (a === 203 && b === 0 && c === 113) {
    return "documentation";
  }

  if (a === 198 && (b === 18 || b === 19)) {
    return "reserved";
  }

  if (a >= 224 && a <= 239) {
    return "multicast";
  }

  if (a >= 240) {
    return "reserved";
  }

  return "public";
}

function classifyIpv6(ip: string): IpScope {
  const normalized = ip.toLowerCase().split("%")[0];

  if (normalized === "::") {
    return "unspecified";
  }

  if (normalized === "::1") {
    return "loopback";
  }

  if (normalized.startsWith("::ffff:")) {
    const embedded = normalized.slice("::ffff:".length);
    return isIP(embedded) === 4 ? classifyIpv4(embedded) : "reserved";
  }

  if (normalized.startsWith("2001:db8:") || normalized === "2001:db8::") {
    return "documentation";
  }

  const firstHextet = Number.parseInt(normalized.split(":")[0] || "0", 16);

  if ((firstHextet & 0xfe00) === 0xfc00) {
    return "unique-local";
  }

  if ((firstHextet & 0xffc0) === 0xfe80) {
    return "link-local";
  }

  if ((firstHextet & 0xff00) === 0xff00) {
    return "multicast";
  }

  return "public";
}

export function classifyIpScope(ip: string): IpScope {
  const version = isIP(ip);

  if (version === 4) {
    return classifyIpv4(ip);
  }

  if (version === 6) {
    return classifyIpv6(ip);
  }

  return "reserved";
}

export function isPublicIp(ip: string) {
  return classifyIpScope(ip) === "public";
}

export function isBlockedHostname(hostname: string) {
  const normalized = normalizeHostname(hostname);

  return (
    BLOCKED_HOSTNAMES.has(normalized) ||
    BLOCKED_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  );
}


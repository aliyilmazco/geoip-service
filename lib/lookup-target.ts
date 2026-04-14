import { isIP } from "node:net";

export function isValidIp(input: string): boolean {
  return isIP(input.trim()) !== 0;
}

export function looksLikeWebsiteTarget(input: string): boolean {
  const trimmed = input.trim();

  if (!trimmed || isValidIp(trimmed) || /\s/.test(trimmed)) {
    return false;
  }

  try {
    const candidate = trimmed.includes("://")
      ? new URL(trimmed)
      : new URL(`https://${trimmed}`);

    if (!["http:", "https:"].includes(candidate.protocol)) {
      return false;
    }

    return hasSupportedWebsiteHostname(candidate.hostname);
  } catch {
    return false;
  }
}

const MAX_TARGET_LENGTH = 2048;

export function classifyLookupTarget(input: string): "ip" | "website" | "unknown" {
  if (input.length > MAX_TARGET_LENGTH) {
    return "unknown";
  }

  const trimmed = input.trim();

  if (!trimmed) {
    return "unknown";
  }

  if (isValidIp(trimmed)) {
    return "ip";
  }

  if (looksLikeWebsiteTarget(trimmed)) {
    return "website";
  }

  return "unknown";
}

export function normalizeWebsiteTarget(input: string): {
  query: string;
  candidates: string[];
  hostname: string;
} {
  const query = input.trim();

  if (!query) {
    throw new Error("An empty website target cannot be analyzed.");
  }

  const hasProtocol = query.includes("://");
  const candidates = hasProtocol ? [query] : [`https://${query}`, `http://${query}`];

  let parsed: URL | null = null;

  for (const candidate of candidates) {
    try {
      parsed = new URL(candidate);

      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Unsupported protocol");
      }

      if (parsed.username || parsed.password) {
        throw new Error("Embedded credentials are not allowed");
      }

      break;
    } catch {
      parsed = null;
    }
  }

  if (!parsed || !hasSupportedWebsiteHostname(parsed.hostname)) {
    throw new Error("Enter a valid website address or domain.");
  }

  return {
    query,
    candidates: candidates.map((candidate) => {
      try {
        return new URL(candidate).toString();
      } catch {
        return candidate;
      }
    }),
    hostname: parsed.hostname,
  };
}

function hasSupportedWebsiteHostname(hostname: string): boolean {
  if (!hostname) {
    return false;
  }

  return /\./.test(hostname) || isValidIp(stripIpv6Brackets(hostname));
}

function stripIpv6Brackets(value: string): string {
  return value.replace(/^\[/, "").replace(/\]$/, "");
}

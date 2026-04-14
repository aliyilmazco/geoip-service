import crypto from "node:crypto";
import { promises as dns } from "node:dns";
import type { LookupAddress, LookupAllOptions, LookupOneOptions } from "node:dns";
import { isIP } from "node:net";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { buildLookupError } from "@/lib/lookup-response";
import { classifyLookupTarget } from "@/lib/lookup-target";
import { isPublicIp } from "@/lib/network-policy";
import type { LookupResult, LookupType, RateLimitInfo } from "@/lib/lookup-types";
import { createLookupExecutionContext } from "@/lib/request-utils";

const TRUST_PROXY_HEADERS = process.env.TRUST_PROXY_HEADERS === "true";
const WEBSITE_TARGET_ALLOWLIST = parseCsv(process.env.WEBSITE_TARGET_ALLOWLIST);

const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_CURRENT_LOOKUP_RATE_LIMIT = 20;
const DEFAULT_TARGET_IP_RATE_LIMIT = 12;
const DEFAULT_TARGET_IP_REPEAT_RATE_LIMIT = 6;
const DEFAULT_TARGET_WEBSITE_RATE_LIMIT = 6;
const DEFAULT_TARGET_WEBSITE_REPEAT_RATE_LIMIT = 3;
const DEFAULT_TARGET_UNKNOWN_RATE_LIMIT = 8;
const DEFAULT_TARGET_UNKNOWN_REPEAT_RATE_LIMIT = 4;
const DEFAULT_SWAGGER_RATE_LIMIT = 30;
const RATE_LIMIT_CLIENT_COOKIE = "geoip_rlid";
const RATE_LIMIT_CLIENT_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 365;

const RATE_LIMIT_WINDOW_MS = readPositiveInt(
  process.env.RATE_LIMIT_WINDOW_MS,
  DEFAULT_RATE_LIMIT_WINDOW_MS
);

const RATE_LIMITS = {
  current: readPositiveInt(
    process.env.CURRENT_LOOKUP_RATE_LIMIT_MAX,
    DEFAULT_CURRENT_LOOKUP_RATE_LIMIT
  ),
  targetIp: readPositiveInt(
    process.env.TARGET_IP_RATE_LIMIT_MAX,
    DEFAULT_TARGET_IP_RATE_LIMIT
  ),
  targetIpRepeat: readPositiveInt(
    process.env.TARGET_IP_REPEAT_RATE_LIMIT_MAX,
    DEFAULT_TARGET_IP_REPEAT_RATE_LIMIT
  ),
  targetWebsite: readPositiveInt(
    process.env.TARGET_WEBSITE_RATE_LIMIT_MAX,
    DEFAULT_TARGET_WEBSITE_RATE_LIMIT
  ),
  targetWebsiteRepeat: readPositiveInt(
    process.env.TARGET_WEBSITE_REPEAT_RATE_LIMIT_MAX,
    DEFAULT_TARGET_WEBSITE_REPEAT_RATE_LIMIT
  ),
  targetUnknown: readPositiveInt(
    process.env.TARGET_UNKNOWN_RATE_LIMIT_MAX,
    DEFAULT_TARGET_UNKNOWN_RATE_LIMIT
  ),
  targetUnknownRepeat: readPositiveInt(
    process.env.TARGET_UNKNOWN_REPEAT_RATE_LIMIT_MAX,
    DEFAULT_TARGET_UNKNOWN_REPEAT_RATE_LIMIT
  ),
  swagger: readPositiveInt(
    process.env.SWAGGER_RATE_LIMIT_MAX,
    DEFAULT_SWAGGER_RATE_LIMIT
  ),
} as const;

type RateLimitScope =
  | "lookup.current"
  | "lookup.target.ip"
  | "lookup.target.website"
  | "lookup.target.unknown"
  | "swagger";
type RateLimitSubject = "lookup" | "swagger";
type RateLimitBlockReason = "scope" | "target";
type RateLimitPolicy = {
  scope: RateLimitScope;
  lookupType?: LookupType;
  limit: number;
  repeatLimit?: number;
};
type RateLimitBucketPlan = {
  key: string;
  kind: RateLimitBlockReason;
  limit: number;
};
type RateLimitStoreEntry = {
  count: number;
  resetAt: number;
};
type RateLimitBucketState = {
  entry: RateLimitStoreEntry;
  plan: RateLimitBucketPlan;
};
type RateLimitSuccess = {
  allowed: true;
  headers: Record<string, string>;
  rateLimit: RateLimitInfo;
};
type RateLimitFailure = {
  allowed: false;
  response: NextResponse;
  headers: Record<string, string>;
  rateLimit: RateLimitInfo;
};
type RateLimitClientIdentity = {
  key: string;
  setCookie?: string;
};

const MAX_RATE_LIMIT_ENTRIES = 50_000;
const rateLimitStore = new Map<string, RateLimitStoreEntry>();
const rateLimitCleanupHandle = setInterval(() => {
  const now = Date.now();

  rateLimitStore.forEach((entry, key) => {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  });

  if (rateLimitStore.size > MAX_RATE_LIMIT_ENTRIES) {
    const overflow = rateLimitStore.size - MAX_RATE_LIMIT_ENTRIES;
    const iterator = rateLimitStore.keys();
    for (let i = 0; i < overflow; i++) {
      const key = iterator.next().value;
      if (key) rateLimitStore.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

rateLimitCleanupHandle.unref?.();

type SafeLookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number
) => void;

export type PublicProbeIssue = {
  code: string;
  message: string;
  status: number;
};

export type ValidatedWebsiteTarget = {
  url: URL;
  hostname: string;
  resolvedAddresses: LookupAddress[];
};

export class LookupPolicyError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "TARGET_NOT_ALLOWED", status = 400) {
    super(message);
    this.name = "LookupPolicyError";
    this.code = code;
    this.status = status;
  }
}

export function createSafeLookup() {
  return (
    hostname: string,
    options: number | LookupOneOptions | LookupAllOptions | undefined,
    callback: SafeLookupCallback
  ) => {
    void resolveLookupForSocket(hostname, options)
      .then((result) => {
        if (Array.isArray(result)) {
          callback(null, result);
          return;
        }

        callback(null, result.address, result.family);
      })
      .catch((error) => {
        callback(toErrnoException(error), "", 0);
      });
  };
}

export function createApiResponse(
  body: LookupResult | object,
  init: { status?: number; headers?: Record<string, string> } = {}
) {
  const response = NextResponse.json(body, {
    status: init.status ?? 200,
  });

  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
  );

  if (
    typeof body === "object" &&
    body !== null &&
    "requestId" in body &&
    typeof body.requestId === "string" &&
    body.requestId
  ) {
    response.headers.set("X-Request-Id", body.requestId);
  }

  if (init.headers) {
    for (const [key, value] of Object.entries(init.headers)) {
      response.headers.set(key, value);
    }
  }

  return response;
}

export function enforceRateLimit(
  request: NextRequest,
  input: { subject: RateLimitSubject; target?: string }
): RateLimitSuccess | RateLimitFailure {
  const now = Date.now();
  const clientIdentity = buildRateLimitKey(request);
  const baseKey = clientIdentity.key;
  const normalizedTarget = normalizeRateLimitTarget(input.target);
  const targetType = normalizedTarget
    ? classifyLookupTarget(normalizedTarget)
    : "ip";
  const policy = resolveRateLimitPolicy(input.subject, targetType, Boolean(normalizedTarget));
  const limitMultiplier = getRateLimitMultiplier(request);
  const scopeLimit = applyRateLimitMultiplier(policy.limit, limitMultiplier, 2);
  const repeatLimit = policy.repeatLimit
    ? applyRateLimitMultiplier(policy.repeatLimit, limitMultiplier, 2)
    : undefined;
  const plans: RateLimitBucketPlan[] = [
    {
      key: `${policy.scope}:${baseKey}`,
      kind: "scope",
      limit: scopeLimit,
    },
  ];

  if (normalizedTarget && repeatLimit) {
    plans.push({
      key: `${policy.scope}:${baseKey}:target:${hashTarget(normalizedTarget)}`,
      kind: "target",
      limit: repeatLimit,
    });
  }

  const states = plans.map((plan) => ({
    entry: getRateLimitEntry(plan.key, now),
    plan,
  }));
  const blocked = states.find(({ entry, plan }) => entry.count >= plan.limit);

  if (blocked) {
    const retryAfterSeconds = getRetryAfterSeconds(blocked.entry.resetAt, now);
    const rateLimit = buildRateLimitInfo(policy.scope, blocked.plan.limit, 0, blocked.entry.resetAt, {
      retryAfterSeconds,
    });
    const headers = buildRateLimitHeaders(rateLimit, clientIdentity);

    if (input.subject === "swagger") {
      return {
        allowed: false,
        headers,
        rateLimit,
        response: createApiResponse(
          {
            error: "Too many documentation requests",
            details: {
              reason: "Rate limit exceeded",
              explanation:
                "The documentation endpoint is temporarily throttled to protect the service from abuse.",
              retryAfterSeconds,
              recommendations: [
                `Wait ${retryAfterSeconds} seconds before requesting the spec again.`,
                "Avoid rapid refresh loops or automated polling of the OpenAPI document.",
              ],
            },
            rateLimit,
          },
          {
            status: 429,
            headers,
          }
        ),
      };
    }

    const context = createLookupExecutionContext(request);
    const lookupType =
      policy.lookupType || (targetType === "website" ? "website" : "ip");
    const query =
      normalizedTarget || (lookupType === "ip" ? context.clientIp : request.nextUrl.pathname);

    return {
      allowed: false,
      headers,
      rateLimit,
      response: createApiResponse(
        attachRateLimitToBody(
          buildLookupError({
            context,
            lookupType,
            query,
            normalizedTarget,
            ip: input.subject === "lookup" && !normalizedTarget ? context.clientIp : "",
            error: "Too many requests",
            details: {
              code: "RATE_LIMITED",
              reason: "Rate limit exceeded",
              explanation:
                blocked.plan.kind === "target"
                  ? "Repeated lookups for the same target are temporarily throttled."
                  : "This endpoint is temporarily throttled to protect the service from abuse.",
              retryable: true,
              retryAfterSeconds,
              rateLimit: {
                ...rateLimit,
                windowMs: RATE_LIMIT_WINDOW_MS,
              },
              recommendations: [
                `Wait ${retryAfterSeconds} seconds before sending another request.`,
                normalizedTarget
                  ? "Slow down repeated lookups for the same IP or website target."
                  : "Reduce rapid refreshes or repeated manual submissions.",
              ],
            },
          }),
          rateLimit
        ),
        {
          status: 429,
          headers,
        }
      ),
    };
  }

  for (const { entry, plan } of states) {
    entry.count += 1;
    rateLimitStore.set(plan.key, entry);
  }

  const tightest = pickTightestRateLimit(states);
  const remaining = Math.max(0, tightest.plan.limit - tightest.entry.count);
  const rateLimit = buildRateLimitInfo(
    policy.scope,
    tightest.plan.limit,
    remaining,
    tightest.entry.resetAt
  );

  return {
    allowed: true,
    headers: buildRateLimitHeaders(rateLimit, clientIdentity),
    rateLimit,
  };
}

export function attachRateLimitToBody<T extends object>(body: T, rateLimit: RateLimitInfo) {
  return {
    ...body,
    rateLimit,
  };
}

export function getTrustedClientIp(request: NextRequest): string | null {
  const platformIp = readCandidateIp((request as NextRequest & { ip?: string }).ip);

  if (platformIp) {
    return platformIp;
  }

  if (!TRUST_PROXY_HEADERS) {
    return null;
  }

  const cloudflareIp = readCandidateIp(request.headers.get("cf-connecting-ip"));
  if (cloudflareIp) {
    return cloudflareIp;
  }

  const forwardedChain = request.headers.get("x-forwarded-for");
  if (forwardedChain) {
    const forwardedIp = forwardedChain
      .split(",")
      .map((part) => readCandidateIp(part))
      .find((candidate): candidate is string => Boolean(candidate));

    if (forwardedIp) {
      return forwardedIp;
    }
  }

  return readCandidateIp(request.headers.get("x-real-ip"));
}

export async function assertPublicWebsiteUrl(
  rawUrl: string
): Promise<ValidatedWebsiteTarget> {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new LookupPolicyError("Enter a valid HTTP or HTTPS target.", "INVALID_TARGET");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new LookupPolicyError(
      "Only HTTP and HTTPS targets are supported.",
      "INVALID_TARGET"
    );
  }

  if (parsed.username || parsed.password) {
    throw new LookupPolicyError(
      "Targets with embedded credentials are not allowed.",
      "INVALID_TARGET"
    );
  }

  if (!parsed.hostname) {
    throw new LookupPolicyError("Enter a valid HTTP or HTTPS target.", "INVALID_TARGET");
  }

  const hostname = stripIpv6Brackets(parsed.hostname);

  if (!isHostnameAllowed(hostname)) {
    throw new LookupPolicyError(
      "This target is not allowed for website probing.",
      "TARGET_NOT_ALLOWED"
    );
  }

  if (isIP(hostname)) {
    return {
      url: parsed,
      hostname,
      resolvedAddresses: [
        {
          address: hostname,
          family: isIP(hostname) === 6 ? 6 : 4,
        },
      ],
    };
  }

  return {
    url: parsed,
    hostname,
    resolvedAddresses: await resolvePublicHostname(hostname),
  };
}

export async function resolvePublicHostname(hostname: string): Promise<LookupAddress[]> {
  if (isAllowlistedHostname(hostname)) {
    return dedupeLookupAddresses(await dns.lookup(hostname, { all: true, verbatim: true }));
  }

  const resolved = dedupeLookupAddresses(
    await dns.lookup(hostname, {
      all: true,
      verbatim: true,
    })
  );

  if (resolved.length === 0) {
    throw new LookupPolicyError(
      "The target hostname could not be resolved.",
      "TARGET_UNRESOLVED",
      502
    );
  }

  const blocked = resolved.filter((entry) => !isPublicIp(entry.address));
  if (blocked.length > 0) {
    throw new LookupPolicyError(
      "This target is not allowed for website probing.",
      "TARGET_NOT_ALLOWED"
    );
  }

  return resolved;
}

export function filterPublicIpValues(values: string[]) {
  return dedupeStrings(values.filter((value) => isPublicIp(value)));
}

export function toPublicProbeIssue(error: unknown): PublicProbeIssue {
  if (error instanceof LookupPolicyError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
    };
  }

  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : undefined;

  switch (code) {
    case "ECONNABORTED":
    case "ETIMEDOUT":
      return {
        code: "TARGET_TIMEOUT",
        message: "The target did not respond in time.",
        status: 502,
      };
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return {
        code: "TARGET_UNRESOLVED",
        message: "The target hostname could not be resolved.",
        status: 502,
      };
    case "ECONNREFUSED":
      return {
        code: "TARGET_REFUSED",
        message: "The target refused the connection.",
        status: 502,
      };
    case "ERR_TLS_CERT_ALTNAME_INVALID":
    case "CERT_HAS_EXPIRED":
      return {
        code: "TLS_PROBE_FAILED",
        message: "The TLS certificate could not be validated.",
        status: 502,
      };
    default:
      return {
        code: "TARGET_UNREACHABLE",
        message: "The target could not be reached.",
        status: 502,
      };
  }
}

function resolveRateLimitPolicy(
  subject: RateLimitSubject,
  targetType: LookupType | "unknown",
  hasTarget: boolean
): RateLimitPolicy {
  if (subject === "swagger") {
    return {
      scope: "swagger",
      limit: RATE_LIMITS.swagger,
    };
  }

  if (targetType === "website") {
    return {
      scope: "lookup.target.website",
      lookupType: "website",
      limit: RATE_LIMITS.targetWebsite,
      repeatLimit: RATE_LIMITS.targetWebsiteRepeat,
    };
  }

  if (targetType === "ip") {
    return {
      scope: hasTarget ? "lookup.target.ip" : "lookup.current",
      lookupType: "ip",
      limit: hasTarget ? RATE_LIMITS.targetIp : RATE_LIMITS.current,
      repeatLimit: hasTarget ? RATE_LIMITS.targetIpRepeat : undefined,
    };
  }

  return {
    scope: "lookup.target.unknown",
    lookupType: "ip",
    limit: RATE_LIMITS.targetUnknown,
    repeatLimit: RATE_LIMITS.targetUnknownRepeat,
  };
}

function normalizeRateLimitTarget(target?: string) {
  const normalized = target?.trim().toLowerCase();
  return normalized || undefined;
}

function hashTarget(target: string) {
  return crypto.createHash("sha1").update(target).digest("hex").slice(0, 16);
}

function getRateLimitMultiplier(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") || "";
  const suspiciousHeaderCount = [
    !request.headers.get("accept"),
    !request.headers.get("accept-language"),
    !request.headers.get("accept-encoding"),
    userAgent.length < 10,
  ].filter(Boolean).length;
  const looksAutomated =
    /bot|crawler|spider|scraper|wget|curl|python|requests|axios|httpx|urllib/i.test(
      userAgent
    );

  if (looksAutomated) {
    return 0.4;
  }

  if (suspiciousHeaderCount >= 3) {
    return 0.6;
  }

  if (suspiciousHeaderCount > 0) {
    return 0.8;
  }

  return 1;
}

function applyRateLimitMultiplier(limit: number, multiplier: number, minimum: number) {
  return Math.max(minimum, Math.floor(limit * multiplier));
}

function getRateLimitEntry(key: string, now: number) {
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    const freshEntry = {
      count: 0,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };

    rateLimitStore.set(key, freshEntry);
    return freshEntry;
  }

  return entry;
}

function getRetryAfterSeconds(resetAt: number, now: number) {
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}

function buildRateLimitInfo(
  scope: RateLimitScope,
  limit: number,
  remaining: number,
  resetAt: number,
  extras?: { retryAfterSeconds?: number }
): RateLimitInfo {
  return {
    scope,
    limit,
    remaining,
    resetAt: new Date(resetAt).toISOString(),
    retryAfterSeconds: extras?.retryAfterSeconds,
  };
}

function buildRateLimitHeaders(
  rateLimit: RateLimitInfo,
  clientIdentity?: RateLimitClientIdentity
) {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": rateLimit.resetAt,
  };

  if (typeof rateLimit.retryAfterSeconds === "number") {
    headers["Retry-After"] = String(rateLimit.retryAfterSeconds);
  }

  if (clientIdentity?.setCookie) {
    headers["Set-Cookie"] = clientIdentity.setCookie;
  }

  return headers;
}

function pickTightestRateLimit(states: RateLimitBucketState[]) {
  return states.reduce((current, candidate) => {
    const currentRemaining = current.plan.limit - current.entry.count;
    const candidateRemaining = candidate.plan.limit - candidate.entry.count;

    if (candidateRemaining < currentRemaining) {
      return candidate;
    }

    if (
      candidateRemaining === currentRemaining &&
      candidate.entry.resetAt > current.entry.resetAt
    ) {
      return candidate;
    }

    return current;
  });
}

function buildRateLimitKey(request: NextRequest): RateLimitClientIdentity {
  const trustedIp = getTrustedClientIp(request);

  if (trustedIp) {
    return {
      key: `ip:${trustedIp}`,
    };
  }

  const storedClientId = readRateLimitClientId(
    request.cookies.get(RATE_LIMIT_CLIENT_COOKIE)?.value
  );

  if (storedClientId) {
    return {
      key: `anon:${storedClientId}`,
    };
  }

  const generatedClientId = buildAnonymousRateLimitClientId(request);

  return {
    key: `anon:${generatedClientId}`,
    setCookie: serializeRateLimitClientCookie(generatedClientId),
  };
}

function buildAnonymousRateLimitClientId(request: NextRequest) {
  const fingerprint = [
    request.method.toUpperCase(),
    request.headers.get("host") || "",
    request.headers.get("user-agent") || "",
    request.headers.get("accept") || "",
    request.headers.get("accept-language") || "",
    request.headers.get("accept-encoding") || "",
    request.headers.get("sec-ch-ua") || "",
    request.headers.get("sec-ch-ua-platform") || "",
    request.headers.get("sec-fetch-site") || "",
  ].join("\n");

  return crypto.createHash("sha256").update(fingerprint).digest("hex").slice(0, 32);
}

function readRateLimitClientId(value: string | undefined) {
  if (!value || !/^[a-f0-9]{32}$/i.test(value)) {
    return null;
  }

  return value.toLowerCase();
}

function serializeRateLimitClientCookie(clientId: string) {
  const attributes = [
    `${RATE_LIMIT_CLIENT_COOKIE}=${clientId}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${RATE_LIMIT_CLIENT_COOKIE_TTL_SECONDS}`,
  ];

  if (process.env.NODE_ENV === "production") {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

async function resolveLookupForSocket(
  hostname: string,
  options: number | LookupOneOptions | LookupAllOptions | undefined
) {
  const normalizedHostname = stripIpv6Brackets(hostname);

  if (isIP(normalizedHostname)) {
    if (!isHostnameAllowed(normalizedHostname)) {
      throw new LookupPolicyError(
        "This target is not allowed for website probing.",
        "TARGET_NOT_ALLOWED"
      );
    }

    const family = isIP(normalizedHostname) === 6 ? 6 : 4;
    return {
      address: normalizedHostname,
      family,
    };
  }

  const addresses = await resolvePublicHostname(normalizedHostname);
  const wantsAll = typeof options === "object" && options !== null && options.all === true;

  if (wantsAll) {
    return addresses;
  }

  const preferredFamily =
    typeof options === "number"
      ? options
      : typeof options?.family === "number"
      ? options.family
      : undefined;

  const selected =
    addresses.find((entry) =>
      preferredFamily ? entry.family === preferredFamily : true
    ) || addresses[0];

  return selected;
}

function isHostnameAllowed(hostname: string) {
  const normalized = stripIpv6Brackets(hostname);

  if (isAllowlistedHostname(normalized)) {
    return true;
  }

  if (!isIP(normalized)) {
    return true;
  }

  return isPublicIp(normalized);
}

function isAllowlistedHostname(hostname: string) {
  const normalized = hostname.toLowerCase();

  return WEBSITE_TARGET_ALLOWLIST.some(
    (allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`)
  );
}

function readCandidateIp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const candidate = stripIpv6Brackets(value.trim());
  return isIP(candidate) ? candidate : null;
}

function stripIpv6Brackets(value: string) {
  return value.replace(/^\[/, "").replace(/\]$/, "");
}

function toErrnoException(error: unknown) {
  const issue = toPublicProbeIssue(error);
  const result = new Error(issue.message) as NodeJS.ErrnoException;
  result.code = issue.code;
  return result;
}

function parseCsv(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function readPositiveInt(raw: string | undefined, fallback: number) {
  const parsed = Number.parseInt(raw || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function dedupeLookupAddresses(values: LookupAddress[]) {
  return Array.from(new Map(values.map((entry) => [entry.address, entry])).values());
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values));
}

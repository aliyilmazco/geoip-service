import { promises as dns } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import tls from "node:tls";

import axios from "axios";
import { NextRequest } from "next/server";

import {
  assertPublicWebsiteUrl,
  createSafeLookup,
  filterPublicIpValues,
  LookupPolicyError,
  resolvePublicHostname,
  toPublicProbeIssue,
  type PublicProbeIssue,
} from "@/lib/security";
import {
  buildResolvedIpSummary,
  buildRuntimeNetworkMetrics,
  getRiskLevel,
} from "@/lib/ip-analysis";
import { logEvent } from "@/lib/logger";
import { buildLookupBase, buildLookupError } from "@/lib/lookup-response";
import { normalizeWebsiteTarget } from "@/lib/lookup-target";
import type {
  LookupResult,
  ResolvedIpSummary,
  ToneSeverity,
  ToneStatus,
  WebsiteAssetsInfo,
  WebsiteCheck,
  WebsiteDnsInfo,
  WebsiteMetaInfo,
  WebsiteRedirect,
  WebsiteTlsInfo,
} from "@/lib/lookup-types";
import {
  buildRequestInfo,
  createLookupExecutionContext,
  type LookupExecutionContext,
} from "@/lib/request-utils";
import { runtimeConfig } from "@/lib/runtime-config";

const MAX_REDIRECTS = runtimeConfig.websiteProbe.maxRedirects;
const MAX_HTML_BYTES = runtimeConfig.websiteProbe.maxHtmlBytes;
const REQUEST_TIMEOUT_MS = runtimeConfig.websiteProbe.timeoutMs;
const PROBE_USER_AGENT = "GeoIP Service Website Analyzer/1.0";
const safeLookup = createSafeLookup();
const SAFE_HTTP_AGENT = new http.Agent({ lookup: safeLookup as never });
const SAFE_HTTPS_AGENT = new https.Agent({ lookup: safeLookup as never });

type WebsiteDnsResolver = Pick<
  typeof dns,
  "resolve4" | "resolve6" | "resolveCname" | "resolveNs" | "resolveMx" | "lookup"
>;

type TimeoutScheduler = Pick<typeof globalThis, "setTimeout" | "clearTimeout">;

type TlsProbeDependencies = {
  connect?: typeof tls.connect;
  resolveHostname?: typeof resolvePublicHostname;
};

type FetchWebsiteResult = {
  finalUrl: string;
  protocol: string;
  redirects: WebsiteRedirect[];
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  elapsedMs: number;
  contentLength: number | null;
};

type AnalysisResponse = {
  status: number;
  body: LookupResult;
};

export async function analyzeWebsiteTarget(
  request: NextRequest,
  target: string,
  context: LookupExecutionContext = createLookupExecutionContext(request)
): Promise<AnalysisResponse> {
  let normalized;

  try {
    normalized = normalizeWebsiteTarget(target);
  } catch (error) {
    return {
      status: 400,
      body: buildLookupError({
        context,
        lookupType: "website",
        query: target,
        normalizedTarget: target.trim(),
        error: (error as Error).message,
        details: {
          code: "INVALID_TARGET",
          reason: "Invalid website target",
          explanation:
            "The input must be an IP address, domain, or HTTP/HTTPS URL.",
          recommendations: [
            "Enter a valid domain such as example.com",
            "Use a full URL with https:// when needed",
          ],
        },
      }),
    };
  }

  const candidateErrors: PublicProbeIssue[] = [];
  let websiteResponse: FetchWebsiteResult | null = null;

  for (const candidate of normalized.candidates) {
    try {
      websiteResponse = await fetchWebsite(candidate);
      break;
    } catch (error) {
      candidateErrors.push(toPublicProbeIssue(error));
    }
  }

  if (!websiteResponse) {
    const primaryError = candidateErrors[0] || {
      code: "TARGET_UNREACHABLE",
      message: "Could not retrieve a website response",
      status: 502,
    };

    return {
      status: primaryError.status,
      body: buildLookupError({
        context,
        lookupType: "website",
        query: normalized.query,
        normalizedTarget: normalized.candidates[0],
        error: primaryError.message,
        details: {
          code: primaryError.code,
          reason: "The target site could not be reached",
          explanation:
            "The domain could not be resolved, the service did not respond, or HTTPS/HTTP access failed.",
          recommendations:
            primaryError.code === "TARGET_NOT_ALLOWED"
              ? [
                  "Use a public website target instead of a private, loopback, or reserved address",
                  "Remove embedded credentials from the URL if present",
                ]
              : dedupe([
                  "Check the domain name and extension",
                  "If the site is temporarily unavailable, try again later",
                ]),
          retryable: primaryError.code !== "TARGET_NOT_ALLOWED",
        },
      }),
    };
  }

  const finalUrl = new URL(websiteResponse.finalUrl);
  const originalHostname = normalizeWebsiteProbeHostname(normalized.hostname);
  const finalHostname = normalizeWebsiteProbeHostname(finalUrl.hostname);
  const dnsInfo = await resolveDnsRecords(originalHostname, finalHostname);
  const resolvedIpAddresses = dedupe([
    ...dnsInfo.a,
    ...dnsInfo.aaaa,
    ...dnsInfo.resolvedAddresses,
  ]);

  const [tlsInfo, resolvedIps, assets] = await Promise.all([
    finalUrl.protocol === "https:"
      ? getTlsInfo(finalHostname)
      : Promise.resolve<WebsiteTlsInfo>({
          available: false,
          error: "HTTPS is not in use",
        }),
    Promise.all(resolvedIpAddresses.map((ip) => buildResolvedIpSummary(ip))),
    getWebsiteAssets(finalUrl),
  ]);

  const meta = extractMeta(websiteResponse.body, websiteResponse.finalUrl);
  const checks = buildWebsiteChecks({
    finalUrl,
    response: websiteResponse,
    tlsInfo,
    meta,
    assets,
    resolvedIpAddresses,
    candidateErrors: candidateErrors.map((entry) => entry.message),
  });
  const { riskScore, riskLevel, suspiciousHeaders, recommendations } =
    summarizeChecks(checks);
  const primaryResolvedIp = pickPrimaryResolvedIp(resolvedIps);
  const websiteTitle = meta.title || meta.openGraph?.title || finalHostname;
  const locationDiagnosis = primaryResolvedIp?.location?.diagnosis;

  return {
    status: 200,
    body: {
      ...buildLookupBase({
        context,
        lookupType: "website",
        query: normalized.query,
        normalizedTarget: websiteResponse.finalUrl,
        ip: primaryResolvedIp?.ip || "",
        warnings: candidateErrors.map((entry) => entry.message),
      }),
      ipType: primaryResolvedIp?.ipType,
      country: primaryResolvedIp?.country,
      countryName: primaryResolvedIp?.countryName,
      city: primaryResolvedIp?.city,
      region: primaryResolvedIp?.region,
      timezone: primaryResolvedIp?.timezone,
      coordinates: primaryResolvedIp?.coordinates || null,
      isp: primaryResolvedIp?.isp,
      location: primaryResolvedIp?.location,
      security: {
        isBot: false,
        riskScore,
        riskLevel,
        suspiciousHeaders,
        botProbability: "Low",
      },
      network: buildRuntimeNetworkMetrics(
        websiteResponse.elapsedMs,
        websiteResponse.contentLength || websiteResponse.body.length
      ),
      requestInfo: buildRequestInfo(request, context),
      analytics: {
        pageLoadTime: `${websiteResponse.elapsedMs}ms`,
        browserSupport: {
          es6: true,
          webGL: "Not applicable",
          touchSupport: "Not applicable",
          orientation: "Not applicable",
        },
        geoAccuracy:
          primaryResolvedIp?.location?.accuracy || "Hostname and IP-level",
        dataFreshness: "Live website probe",
        totalRequestTime: `${websiteResponse.elapsedMs}ms`,
      },
      details: {
        provider: "geoip-lite + optional ISP enrichment + live website fetch",
        note: [
          websiteResponse.status >= 400
            ? "The site was technically reachable, but the primary response returned a failing status code."
            : "Website data was assembled from the main document, DNS, and TLS layers.",
          locationDiagnosis,
        ]
          .filter(Boolean)
          .join(" "),
        privacyLevel: riskLevel,
        dataRetention:
          "Target website lookups can be retained in Turso-backed lookup storage when logging is enabled.",
        recommendations,
      },
      website: {
        url: websiteResponse.finalUrl,
        hostname: finalHostname,
        protocol: finalUrl.protocol.replace(":", ""),
        redirects: websiteResponse.redirects,
        http: {
          status: websiteResponse.status,
          statusText: websiteResponse.statusText,
          contentType: websiteResponse.headers["content-type"],
          contentLength: websiteResponse.contentLength,
          server: websiteResponse.headers.server,
          cacheControl: websiteResponse.headers["cache-control"],
          headers: pickInterestingHeaders(websiteResponse.headers),
        },
        meta,
        tls: tlsInfo,
        dns: {
          a: dnsInfo.a,
          aaaa: dnsInfo.aaaa,
          cname: dnsInfo.cname,
          ns: dnsInfo.ns,
          mx: dnsInfo.mx,
        },
        assets,
        resolvedIps,
        checks,
        summary: {
          primarySignal: websiteTitle,
          transport:
            finalUrl.protocol === "https:"
              ? tlsInfo.available
                ? "HTTPS with an active certificate"
                : "HTTPS is configured but the certificate could not be read"
              : "Using HTTP",
          indexability: [
            assets.robotsTxt === "present" ? "robots.txt present" : "robots.txt missing",
            assets.sitemapXml === "present" ? "sitemap.xml present" : "sitemap.xml missing",
          ].join(" / "),
          hosting:
            primaryResolvedIp?.isp?.organization ||
            primaryResolvedIp?.isp?.isp ||
            "Hosting data could not be read",
        },
      },
    },
  };
}

async function fetchWebsite(initialUrl: string): Promise<FetchWebsiteResult> {
  let currentUrl = initialUrl;
  const redirects: WebsiteRedirect[] = [];
  const startedAt = Date.now();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const validatedTarget = await assertPublicWebsiteUrl(currentUrl);
    const response = await axios.get(validatedTarget.url.toString(), {
      timeout: REQUEST_TIMEOUT_MS,
      maxRedirects: 0,
      responseType: "text",
      transformResponse: [(data) => data],
      validateStatus: () => true,
      maxContentLength: MAX_HTML_BYTES,
      maxBodyLength: MAX_HTML_BYTES,
      httpAgent: SAFE_HTTP_AGENT,
      httpsAgent: SAFE_HTTPS_AGENT,
      headers: {
        "User-Agent": PROBE_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const headers = normalizeHeaders(response.headers);
    const status = response.status;
    const location = headers.location;

    if (status >= 300 && status < 400 && location) {
      const nextUrl = new URL(location, validatedTarget.url).toString();
      await assertPublicWebsiteUrl(nextUrl);
      redirects.push({
        from: validatedTarget.url.toString(),
        to: nextUrl,
        status,
      });
      currentUrl = nextUrl;
      continue;
    }

    const body =
      typeof response.data === "string" &&
      isHtmlResponse(headers["content-type"] || "")
        ? response.data.slice(0, MAX_HTML_BYTES)
        : "";

    return {
      finalUrl: validatedTarget.url.toString(),
      protocol: validatedTarget.url.protocol.replace(":", ""),
      redirects,
      status,
      statusText: response.statusText,
      headers,
      body,
      elapsedMs: Date.now() - startedAt,
      contentLength: parseContentLength(headers["content-length"], body),
    };
  }

  throw new LookupPolicyError(
    "The target redirected too many times.",
    "TOO_MANY_REDIRECTS",
    502
  );
}

export async function resolveDnsRecords(
  originalHostname: string,
  finalHostname: string,
  resolver: WebsiteDnsResolver = dns
) {
  const hostnames = dedupe(
    [originalHostname, finalHostname]
      .map((hostname) => normalizeWebsiteProbeHostname(hostname))
      .filter(Boolean)
  );

  const [a, aaaa, cname, ns, mx, lookups] = await Promise.all([
    resolveMany(hostnames, (hostname) => resolver.resolve4(hostname)),
    resolveMany(hostnames, (hostname) => resolver.resolve6(hostname)),
    resolveMany(hostnames, (hostname) => resolver.resolveCname(hostname)),
    resolveMany(hostnames, (hostname) => resolver.resolveNs(hostname)),
    resolveMany(hostnames, async (hostname) => {
      const records = await resolver.resolveMx(hostname);
      return records.map((record) => `${record.priority} ${record.exchange}`);
    }),
    resolveLookupAddresses(hostnames, resolver),
  ]);

  return {
    a: filterPublicIpValues(a),
    aaaa: filterPublicIpValues(aaaa),
    cname,
    ns,
    mx,
    resolvedAddresses: filterPublicIpValues(lookups),
  };
}

async function resolveLookupAddresses(
  hostnames: string[],
  resolver: Pick<WebsiteDnsResolver, "lookup"> = dns
): Promise<string[]> {
  const settled = await Promise.allSettled(
    hostnames.map((hostname) => resolver.lookup(hostname, { all: true }))
  );

  return dedupe(
    settled.flatMap((result) =>
      result.status === "fulfilled" ? result.value.map((entry) => entry.address) : []
    )
  );
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  scheduler: TimeoutScheduler = globalThis
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const clearTimeoutHandle = () => {
    if (timeoutHandle !== undefined) {
      scheduler.clearTimeout(timeoutHandle);
      timeoutHandle = undefined;
    }
  };

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = scheduler.setTimeout(() => {
      timeoutHandle = undefined;
      reject(new Error("DNS lookup timed out"));
    }, ms);
    (timeoutHandle as { unref?: () => void } | undefined)?.unref?.();
  });

  return Promise.race([promise, timeoutPromise]).finally(clearTimeoutHandle);
}

async function resolveMany(
  hostnames: string[],
  resolver: (hostname: string) => Promise<string[]>
): Promise<string[]> {
  const timeoutMs = runtimeConfig.websiteProbe.dnsCacheTtlMs > 0
    ? Math.min(runtimeConfig.websiteProbe.timeoutMs, 10_000)
    : 10_000;

  const settled = await Promise.allSettled(
    hostnames.map((hostname) => withTimeout(resolver(hostname), timeoutMs))
  );

  return dedupe(
    settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []))
  );
}

async function getWebsiteAssets(targetUrl: URL): Promise<WebsiteAssetsInfo> {
  const robotsUrl = new URL("/robots.txt", targetUrl.origin).toString();
  const sitemapUrl = new URL("/sitemap.xml", targetUrl.origin).toString();

  return {
    robotsTxt: await probeStaticAsset(robotsUrl),
    sitemapXml: await probeStaticAsset(sitemapUrl),
    favicon: new URL("/favicon.ico", targetUrl.origin).toString(),
  };
}

async function probeStaticAsset(
  url: string
): Promise<WebsiteAssetsInfo["robotsTxt"]> {
  try {
    let currentUrl = url;

    for (let hop = 0; hop <= 2; hop += 1) {
      const validatedTarget = await assertPublicWebsiteUrl(currentUrl);
      const response = await axios.get(validatedTarget.url.toString(), {
        timeout: runtimeConfig.websiteProbe.assetProbeTimeoutMs,
        maxRedirects: 0,
        responseType: "text",
        transformResponse: [(data) => data],
        validateStatus: () => true,
        maxContentLength: runtimeConfig.websiteProbe.assetProbeMaxBytes,
        maxBodyLength: runtimeConfig.websiteProbe.assetProbeMaxBytes,
        httpAgent: SAFE_HTTP_AGENT,
        httpsAgent: SAFE_HTTPS_AGENT,
        headers: {
          "User-Agent": PROBE_USER_AGENT,
        },
      });

      const headers = normalizeHeaders(response.headers);
      const location = headers.location;

      if (response.status >= 300 && response.status < 400 && location) {
        currentUrl = new URL(location, validatedTarget.url).toString();
        continue;
      }

      if (response.status === 404) {
        return "missing";
      }

      if (
        (response.status >= 200 && response.status < 400) ||
        response.status === 403
      ) {
        return "present";
      }

      return "unknown";
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

export async function getTlsInfo(
  hostname: string,
  deps: TlsProbeDependencies = {}
): Promise<WebsiteTlsInfo> {
  const normalizedHostname = normalizeWebsiteProbeHostname(hostname);
  const connect = deps.connect || tls.connect;
  const resolveHostname = deps.resolveHostname || resolvePublicHostname;

  try {
    const resolvedAddresses = await resolveHostname(normalizedHostname);
    const primaryAddress = resolvedAddresses[0];

    return await new Promise((resolve) => {
      let settled = false;

      const finish = (value: WebsiteTlsInfo) => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      };

      const socket = connect(
        {
          host: primaryAddress.address,
          port: 443,
          servername: isIP(normalizedHostname) ? undefined : normalizedHostname,
          rejectUnauthorized: false,
          timeout: runtimeConfig.websiteProbe.tlsTimeoutMs,
        },
        () => {
          const certificate = socket.getPeerCertificate();

          if (!certificate || Object.keys(certificate).length === 0) {
            finish({
              available: false,
              error: "Could not read certificate information",
            });
            socket.end();
            return;
          }

          const validTo = new Date(certificate.valid_to);
          const validFrom = new Date(certificate.valid_from);
          const daysRemaining = Number.isNaN(validTo.getTime())
            ? undefined
            : Math.ceil((validTo.getTime() - Date.now()) / 86_400_000);

          finish({
            available: true,
            issuer: formatDistinguishedName(certificate.issuer),
            subject: formatDistinguishedName(certificate.subject),
            validFrom: Number.isNaN(validFrom.getTime())
              ? certificate.valid_from
              : validFrom.toISOString(),
            validTo: Number.isNaN(validTo.getTime())
              ? certificate.valid_to
              : validTo.toISOString(),
            daysRemaining,
            san: parseSubjectAltNames(certificate.subjectaltname),
          });
          socket.end();
        }
      );

      socket.setTimeout(runtimeConfig.websiteProbe.tlsTimeoutMs);
      socket.on("error", (error) => {
        const issue = toPublicProbeIssue(error);
        finish({
          available: false,
          error: issue.message,
        });
      });
      socket.on("timeout", () => {
        finish({
          available: false,
          error: "TLS probe timed out",
        });
        socket.destroy();
      });
    });
  } catch (error) {
    logEvent("warn", "website.tls_probe_failed", {
      hostname: normalizedHostname,
      message: error instanceof Error ? error.message : String(error),
    });

    const issue = toPublicProbeIssue(error);

    return {
      available: false,
      error: issue.message,
    };
  }
}

export function normalizeWebsiteProbeHostname(hostname: string) {
  return hostname.trim().replace(/^\[/, "").replace(/\]$/, "");
}

function buildWebsiteChecks(input: {
  finalUrl: URL;
  response: FetchWebsiteResult;
  tlsInfo: WebsiteTlsInfo;
  meta: WebsiteMetaInfo;
  assets: WebsiteAssetsInfo;
  resolvedIpAddresses: string[];
  candidateErrors: string[];
}): WebsiteCheck[] {
  const checks: WebsiteCheck[] = [];
  const headers = input.response.headers;
  const protocol = input.finalUrl.protocol;
  const status = input.response.status;
  const redirectCount = input.response.redirects.length;
  const csp = headers["content-security-policy"];
  const hsts = headers["strict-transport-security"];
  const xcto = headers["x-content-type-options"];
  const xfo = headers["x-frame-options"];
  const referrerPolicy = headers["referrer-policy"];

  checks.push(
    buildCheck({
      id: "dns-resolution",
      label: "DNS resolution",
      status: input.resolvedIpAddresses.length > 0 ? "pass" : "fail",
      severity: "high",
      message:
        input.resolvedIpAddresses.length > 0
          ? `${input.resolvedIpAddresses.length} IP addresses resolved`
          : "Could not resolve an IP address for the domain",
      recommendation:
        input.resolvedIpAddresses.length > 0
          ? undefined
          : "Check the DNS records and domain routing",
    }),
    buildCheck({
      id: "https",
      label: "HTTPS usage",
      status: protocol === "https:" ? "pass" : "fail",
      severity: "high",
      message:
        protocol === "https:"
          ? "The primary document is served over HTTPS"
          : "The primary document is served over HTTP instead of HTTPS",
      recommendation:
        protocol === "https:"
          ? undefined
          : "Serve the site over HTTPS and redirect HTTP requests",
    })
  );

  if (protocol === "https:") {
    const certDays = input.tlsInfo.daysRemaining;
    const certExpired = typeof certDays === "number" && certDays < 0;
    const certExpiringSoon = typeof certDays === "number" && certDays >= 0 && certDays < 14;

    checks.push(
      buildCheck({
        id: "tls-certificate",
        label: "TLS certificate",
        status: !input.tlsInfo.available
          ? "fail"
          : certExpired
          ? "fail"
          : certExpiringSoon
          ? "warn"
          : "pass",
        severity: certExpiringSoon ? "high" : "high",
        message: !input.tlsInfo.available
          ? input.tlsInfo.error || "The TLS certificate could not be read"
          : certExpired
          ? "The TLS certificate has expired"
          : certExpiringSoon
          ? `TLS certificate expires in ${certDays} days`
          : "The TLS certificate appears valid",
        recommendation:
          !input.tlsInfo.available || certExpired || certExpiringSoon
            ? "Review the certificate chain and renewal policy"
            : undefined,
      })
    );
  } else if (input.candidateErrors.length > 0) {
    checks.push(
      buildCheck({
        id: "https-probe",
        label: "HTTPS probe result",
        status: "warn",
        severity: "medium",
        message: input.candidateErrors[0],
        recommendation: "Verify HTTPS access separately",
      })
    );
  }

  checks.push(
    buildCheck({
      id: "http-status",
      label: "HTTP status code",
      status: status >= 200 && status < 400 ? "pass" : "fail",
      severity: "high",
      message:
        status >= 200 && status < 400
          ? `Primary response returned ${status} status`
          : `Primary response returned ${status} status`,
      recommendation:
        status >= 200 && status < 400
          ? undefined
          : "Fix the main document status code at the application or infrastructure level",
    }),
    buildCheck({
      id: "redirect-chain",
      label: "Redirect chain",
      status: redirectCount > 2 ? "warn" : "pass",
      severity: "medium",
      message:
        redirectCount > 0
          ? `${redirectCount} redirects to reach the final URL`
          : "No additional redirects",
      recommendation:
        redirectCount > 2
          ? "Shorten the redirect chain to reduce latency and fragility"
          : undefined,
    }),
    buildHeaderPresenceCheck(
      "csp",
      "Content-Security-Policy",
      csp,
      "medium",
      "CSP is defined for the page"
    ),
    buildHeaderPresenceCheck(
      "hsts",
      "Strict-Transport-Security",
      protocol === "https:" ? hsts : undefined,
      "medium",
      "HSTS is defined"
    ),
    buildHeaderPresenceCheck(
      "xcto",
      "X-Content-Type-Options",
      xcto,
      "low",
      "MIME sniffing protection is defined"
    ),
    buildHeaderPresenceCheck(
      "xfo",
      "X-Frame-Options",
      xfo,
      "low",
      "Frame protection is defined"
    ),
    buildHeaderPresenceCheck(
      "referrer-policy",
      "Referrer-Policy",
      referrerPolicy,
      "low",
      "A referrer policy is defined"
    ),
    buildCheck({
      id: "title",
      label: "HTML title",
      status: input.meta.title ? "pass" : "warn",
      severity: "low",
      message: input.meta.title
        ? `Title found: ${input.meta.title}`
        : "The main document has no title tag",
      recommendation: input.meta.title
        ? undefined
        : "Add a meaningful title to the primary HTML document",
    }),
    buildCheck({
      id: "meta-description",
      label: "Meta description",
      status: input.meta.description ? "pass" : "warn",
      severity: "low",
      message: input.meta.description
        ? "Meta description found"
        : "Meta description was not found",
      recommendation: input.meta.description
        ? undefined
        : "Add a descriptive meta description for the main page",
    }),
    buildCheck({
      id: "robots-txt",
      label: "robots.txt",
      status: input.assets.robotsTxt === "present" ? "pass" : "info",
      severity: "low",
      message:
        input.assets.robotsTxt === "present"
          ? "robots.txt is accessible"
          : input.assets.robotsTxt === "missing"
          ? "robots.txt was not found"
          : "Could not verify robots.txt status",
    }),
    buildCheck({
      id: "sitemap",
      label: "sitemap.xml",
      status: input.assets.sitemapXml === "present" ? "pass" : "info",
      severity: "low",
      message:
        input.assets.sitemapXml === "present"
          ? "sitemap.xml is accessible"
          : input.assets.sitemapXml === "missing"
          ? "sitemap.xml was not found"
          : "Could not verify sitemap.xml status",
    })
  );

  return checks;
}

function buildHeaderPresenceCheck(
  id: string,
  label: string,
  value: string | undefined,
  severity: ToneSeverity,
  successMessage: string
): WebsiteCheck {
  return buildCheck({
    id,
    label,
    status: value ? "pass" : "warn",
    severity,
    message: value ? successMessage : `${label} header is missing`,
    recommendation: value ? undefined : `Add the ${label} header`,
  });
}

function summarizeChecks(checks: WebsiteCheck[]) {
  let riskScore = 0;
  const suspiciousHeaders: string[] = [];
  const recommendations = new Set<string>();

  for (const check of checks) {
    if (check.status === "pass" || check.status === "info") {
      continue;
    }

    suspiciousHeaders.push(`${check.label}: ${check.message}`);

    if (check.recommendation) {
      recommendations.add(check.recommendation);
    }

    if (check.status === "fail") {
      riskScore += scoreBySeverity(check.severity, "fail");
    } else if (check.status === "warn") {
      riskScore += scoreBySeverity(check.severity, "warn");
    }
  }

  return {
    riskScore: Math.min(riskScore, 100),
    riskLevel: getRiskLevel(riskScore),
    suspiciousHeaders,
    recommendations: Array.from(recommendations),
  };
}

function scoreBySeverity(severity: ToneSeverity, status: Exclude<ToneStatus, "pass" | "info">) {
  if (status === "fail") {
    if (severity === "high") {
      return 30;
    }

    if (severity === "medium") {
      return 20;
    }

    return 10;
  }

  if (severity === "high") {
    return 20;
  }

  if (severity === "medium") {
    return 12;
  }

  return 5;
}

function buildCheck(check: WebsiteCheck): WebsiteCheck {
  return check;
}

function pickPrimaryResolvedIp(resolvedIps: ResolvedIpSummary[]) {
  return resolvedIps.find((entry) => entry.coordinates) || resolvedIps[0];
}

function extractMeta(html: string, baseUrl: string): WebsiteMetaInfo {
  if (!html) {
    return {};
  }

  const metaTags = Array.from(html.matchAll(/<meta\b[^>]*>/gi)).map((match) =>
    parseTagAttributes(match[0])
  );
  const linkTags = Array.from(html.matchAll(/<link\b[^>]*>/gi)).map((match) =>
    parseTagAttributes(match[0])
  );
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const htmlTagMatch = html.match(/<html\b[^>]*>/i);
  const htmlAttributes = htmlTagMatch ? parseTagAttributes(htmlTagMatch[0]) : {};

  const meta = {
    title: decodeHtml(titleMatch?.[1]?.trim()),
    description: getMetaValue(metaTags, "name", "description"),
    canonical: absoluteUrl(
      linkTags.find((tag) => hasToken(tag.rel, "canonical"))?.href,
      baseUrl
    ),
    robots: getMetaValue(metaTags, "name", "robots"),
    lang: htmlAttributes.lang,
    generator: getMetaValue(metaTags, "name", "generator"),
    openGraph: {
      title: getMetaValue(metaTags, "property", "og:title"),
      description: getMetaValue(metaTags, "property", "og:description"),
      image: absoluteUrl(
        getMetaValue(metaTags, "property", "og:image"),
        baseUrl
      ),
      siteName: getMetaValue(metaTags, "property", "og:site_name"),
      type: getMetaValue(metaTags, "property", "og:type"),
      url: absoluteUrl(getMetaValue(metaTags, "property", "og:url"), baseUrl),
    },
  } satisfies WebsiteMetaInfo;

  return meta;
}

function getMetaValue(
  tags: Array<Record<string, string>>,
  key: string,
  expected: string
): string | undefined {
  const lowerExpected = expected.toLowerCase();
  const tag = tags.find((entry) => entry[key]?.toLowerCase() === lowerExpected);
  return decodeHtml(tag?.content);
}

function parseTagAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const regex = /([a-zA-Z_:.-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;

  for (const match of Array.from(tag.matchAll(regex))) {
    const [, rawKey, , doubleQuoted, singleQuoted, bare] = match;
    if (!rawKey) {
      continue;
    }

    attributes[rawKey.toLowerCase()] =
      decodeHtml(doubleQuoted || singleQuoted || bare || "") || "";
  }

  return attributes;
}

function hasToken(value: string | undefined, token: string): boolean {
  if (!value) {
    return false;
  }

  return value
    .toLowerCase()
    .split(/\s+/)
    .includes(token.toLowerCase());
}

function decodeHtml(value?: string): string | undefined {
  if (!value) {
    return value;
  }

  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function absoluteUrl(value: string | undefined, baseUrl: string): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function pickInterestingHeaders(headers: Record<string, string>) {
  const keys = [
    "server",
    "content-type",
    "content-length",
    "cache-control",
    "content-security-policy",
    "strict-transport-security",
    "x-frame-options",
    "x-content-type-options",
    "referrer-policy",
  ];

  return Object.fromEntries(
    keys
      .filter((key) => Boolean(headers[key]))
      .map((key) => [key, headers[key]])
  );
}

function normalizeHeaders(headers: unknown): Record<string, string> {
  if (!headers || typeof headers !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(headers).flatMap(([key, value]) => {
      if (typeof value === "string") {
        return [[key.toLowerCase(), value]];
      }

      if (Array.isArray(value)) {
        return [[key.toLowerCase(), value.join(", ")]];
      }

      if (typeof value === "number") {
        return [[key.toLowerCase(), String(value)]];
      }

      return [];
    })
  );
}

function isHtmlResponse(contentType: string): boolean {
  return /text\/html|application\/xhtml\+xml/i.test(contentType);
}

function parseContentLength(headerValue: string | undefined, body: string): number | null {
  const parsed = Number.parseInt(headerValue || "", 10);

  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return body ? Buffer.byteLength(body, "utf8") : null;
}

function parseSubjectAltNames(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((part) => part.replace(/^DNS:/, "").trim())
    .filter(Boolean);
}

function formatDistinguishedName(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const parts = Object.entries(
    value as Record<string, string | string[] | undefined>
  )
    .map(([key, item]) =>
      Array.isArray(item) ? `${key}=${item.join(",")}` : item ? `${key}=${item}` : ""
    )
    .filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : undefined;
}

function dedupe(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

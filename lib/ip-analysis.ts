import axios from "axios";
import { NextRequest } from "next/server";
import { UAParser } from "ua-parser-js";

import {
  getGeoIPRuntimeStatus,
  lookupIP,
  type GeoIPRuntimeStatus,
} from "@/lib/geoip-safe";
import { logEvent } from "@/lib/logger";
import { classifyIpScope } from "@/lib/network-policy";
import { runtimeConfig } from "@/lib/runtime-config";
import { formatTimeInZone, getTimeZoneDetails } from "@/lib/timezone";
import { TtlCache } from "@/lib/ttl-cache";
import type {
  AnalyticsInfo,
  ConnectionInfo,
  DeviceInfo,
  IspInfo,
  LocationAnalysis,
  NetworkMetrics,
  ResolvedIpSummary,
  SecurityInfo,
} from "@/lib/lookup-types";

const ALLOW_INSECURE_IP_API = process.env.ALLOW_INSECURE_IP_API === "true";
const ispCache = new TtlCache<string, IspInfo>();

export function isPrivateIp(ip: string): boolean {
  return classifyIpScope(ip) !== "public";
}


export async function getIspInfo(ip: string): Promise<IspInfo> {
  const cached = ispCache.get(ip);

  if (cached) {
    return cached;
  }

  if (!ALLOW_INSECURE_IP_API || isPrivateIp(ip)) {
    return buildUnknownIspInfo();
  }

  try {
    const response = await axios.get(
      `${runtimeConfig.isp.endpointBaseUrl}/json/${encodeURIComponent(
        ip
      )}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting,query`,
      {
        timeout: runtimeConfig.isp.timeoutMs,
      }
    );

    if (response.data.status === "success") {
      const hasCoordinates =
        typeof response.data.lat === "number" && typeof response.data.lon === "number";

      const nextValue = {
        isp: response.data.isp || "Unknown",
        organization: response.data.org || "Unknown",
        asn: response.data.as || "Unknown",
        asnName: response.data.asname || "Unknown",
        mobile: response.data.mobile || false,
        proxy: response.data.proxy || false,
        hosting: response.data.hosting || false,
        zipCode: response.data.zip || "Unknown",
        locationData: hasCoordinates
          ? {
              country: response.data.country || null,
              countryCode: response.data.countryCode || null,
              region: response.data.region || null,
              regionName: response.data.regionName || null,
              city: response.data.city || null,
              timezone: response.data.timezone || null,
              latitude: response.data.lat,
              longitude: response.data.lon,
            }
          : null,
      };

      ispCache.set(ip, nextValue, runtimeConfig.isp.cacheTtlMs);
      return nextValue;
    }
  } catch (error) {
    logEvent("warn", "isp.lookup_failed", {
      ip,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return buildUnknownIspInfo();
}

export function getSecurityAnalysis(request: NextRequest, ip: string): SecurityInfo {
  const userAgent = request.headers.get("user-agent") || "";

  const botIndicators = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /wget/i,
    /curl/i,
    /python/i,
    /requests/i,
    /axios/i,
    /httpx/i,
    /urllib/i,
  ];

  const isBot = botIndicators.some((pattern) => pattern.test(userAgent));
  const suspiciousHeaders: string[] = [];

  if (!request.headers.get("accept")) {
    suspiciousHeaders.push("Missing Accept header");
  }

  if (!request.headers.get("accept-language")) {
    suspiciousHeaders.push("Missing Accept-Language header");
  }

  if (!request.headers.get("accept-encoding")) {
    suspiciousHeaders.push("Missing Accept-Encoding header");
  }

  if (userAgent.length < 10) {
    suspiciousHeaders.push("User-Agent is too short");
  }

  let riskScore = 0;

  if (isBot) {
    riskScore += 30;
  }

  if (suspiciousHeaders.length > 0) {
    riskScore += suspiciousHeaders.length * 10;
  }

  if (isPrivateIp(ip)) {
    riskScore += 5;
  }

  if (!request.headers.get("referer")) {
    riskScore += 10;
  }

  return {
    isBot,
    riskScore: Math.min(riskScore, 100),
    riskLevel: getRiskLevel(riskScore),
    suspiciousHeaders,
    botProbability: isBot
      ? "High"
      : suspiciousHeaders.length > 2
      ? "Medium"
      : "Low",
  };
}

export function getNetworkMetrics(request: NextRequest): NetworkMetrics {
  const timestamp = new Date();
  const serverTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const serverTime = getTimeZoneDetails(serverTimeZone, timestamp);

  return {
    responseTime: "0ms",
    requestSize: JSON.stringify(Object.fromEntries(request.headers)).length,
    timestamp: {
      iso: timestamp.toISOString(),
      unix: Math.floor(timestamp.getTime() / 1000),
      formatted: timestamp.toLocaleString("en-US"),
    },
    serverTime: {
      timezone: serverTimeZone,
      offset: serverTime?.offset ?? timestamp.getTimezoneOffset() / -60,
    },
  };
}

export function buildRuntimeNetworkMetrics(
  elapsedMs: number,
  payloadSize: number
): NetworkMetrics {
  const timestamp = new Date();
  const serverTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const serverTime = getTimeZoneDetails(serverTimeZone, timestamp);

  return {
    responseTime: `${elapsedMs}ms`,
    requestSize: payloadSize,
    timestamp: {
      iso: timestamp.toISOString(),
      unix: Math.floor(timestamp.getTime() / 1000),
      formatted: timestamp.toLocaleString("en-US"),
    },
    serverTime: {
      timezone: serverTimeZone,
      offset: serverTime?.offset ?? timestamp.getTimezoneOffset() / -60,
    },
  };
}

export function getDeviceInfo(userAgent: string): DeviceInfo {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  let cpuArchitecture = result.cpu.architecture || "Unknown";

  if (cpuArchitecture === "Unknown" || !cpuArchitecture) {
    const normalizedUserAgent = userAgent.toLowerCase();

    if (normalizedUserAgent.includes("arm64") || normalizedUserAgent.includes("aarch64")) {
      cpuArchitecture = "ARM64";
    } else if (normalizedUserAgent.includes("arm")) {
      cpuArchitecture = "ARM";
    } else if (
      normalizedUserAgent.includes("x86_64") ||
      normalizedUserAgent.includes("win64") ||
      normalizedUserAgent.includes("wow64")
    ) {
      cpuArchitecture = "x86_64";
    } else if (
      normalizedUserAgent.includes("x86") ||
      normalizedUserAgent.includes("i386") ||
      normalizedUserAgent.includes("i686")
    ) {
      cpuArchitecture = "x86";
    } else if (
      normalizedUserAgent.includes("android") ||
      normalizedUserAgent.includes("mobile")
    ) {
      cpuArchitecture = "ARM (mobile)";
    } else {
      cpuArchitecture = "x86_64 (default)";
    }
  }

  let osName = result.os.name || "Unknown";
  let osVersion = result.os.version || "Unknown";
  let osFullName = `${osName} ${osVersion}`.trim();

  if (osName === "Unknown" || !osName) {
    const normalizedUserAgent = userAgent.toLowerCase();

    if (normalizedUserAgent.includes("windows nt 10.0")) {
      osName = "Windows";
      osVersion = "10/11";
      osFullName = "Windows 10/11";
    } else if (normalizedUserAgent.includes("windows nt 6.3")) {
      osName = "Windows";
      osVersion = "8.1";
      osFullName = "Windows 8.1";
    } else if (normalizedUserAgent.includes("windows nt 6.1")) {
      osName = "Windows";
      osVersion = "7";
      osFullName = "Windows 7";
    } else if (
      normalizedUserAgent.includes("mac os x") ||
      normalizedUserAgent.includes("macos")
    ) {
      osName = "macOS";
      const macMatch = normalizedUserAgent.match(/mac os x ([\d_]+)/);

      if (macMatch) {
        osVersion = macMatch[1].replace(/_/g, ".");
        osFullName = `macOS ${osVersion}`;
      }
    } else if (normalizedUserAgent.includes("android")) {
      osName = "Android";
      const androidMatch = normalizedUserAgent.match(/android ([\d.]+)/);

      if (androidMatch) {
        osVersion = androidMatch[1];
        osFullName = `Android ${osVersion}`;
      }
    } else if (
      normalizedUserAgent.includes("iphone") ||
      normalizedUserAgent.includes("ipad")
    ) {
      osName = "iOS";
      const iosMatch = normalizedUserAgent.match(/os ([\d_]+)/);

      if (iosMatch) {
        osVersion = iosMatch[1].replace(/_/g, ".");
        osFullName = `iOS ${osVersion}`;
      }
    }
  }

  let engineName = result.engine.name || "Unknown";
  let engineVersion = result.engine.version || "Unknown";
  let engineFullName = `${engineName} ${engineVersion}`.trim();

  if (engineName === "Unknown" || !engineName) {
    const normalizedUserAgent = userAgent.toLowerCase();

    if (normalizedUserAgent.includes("webkit") && normalizedUserAgent.includes("chrome")) {
      engineName = "Blink";
      engineFullName = "Blink (Chromium)";
    } else if (
      normalizedUserAgent.includes("webkit") &&
      normalizedUserAgent.includes("safari")
    ) {
      engineName = "WebKit";
      engineFullName = "WebKit (Safari)";
    } else if (
      normalizedUserAgent.includes("gecko") &&
      normalizedUserAgent.includes("firefox")
    ) {
      engineName = "Gecko";
      engineFullName = "Gecko (Firefox)";
    } else if (normalizedUserAgent.includes("trident")) {
      engineName = "Trident";
      engineFullName = "Trident (Internet Explorer)";
    }
  }

  let deviceType = result.device.type || "desktop";
  let deviceVendor = result.device.vendor || "Unknown";
  let deviceModel = result.device.model || "Unknown";

  if (deviceVendor === "Unknown" || !deviceVendor) {
    const normalizedUserAgent = userAgent.toLowerCase();

    if (normalizedUserAgent.includes("iphone")) {
      deviceVendor = "Apple";
      deviceModel = "iPhone";
      deviceType = "mobile";
    } else if (normalizedUserAgent.includes("ipad")) {
      deviceVendor = "Apple";
      deviceModel = "iPad";
      deviceType = "tablet";
    } else if (
      normalizedUserAgent.includes("macintosh") ||
      normalizedUserAgent.includes("mac os")
    ) {
      deviceVendor = "Apple";
      deviceModel = "Mac";
      deviceType = "desktop";
    } else if (normalizedUserAgent.includes("samsung")) {
      deviceVendor = "Samsung";
      deviceType = normalizedUserAgent.includes("mobile") ? "mobile" : "tablet";
    } else if (normalizedUserAgent.includes("android")) {
      deviceType = normalizedUserAgent.includes("mobile") ? "mobile" : "tablet";

      if (normalizedUserAgent.includes("sm-")) {
        deviceVendor = "Samsung";
      } else if (normalizedUserAgent.includes("pixel")) {
        deviceVendor = "Google";
        deviceModel = "Pixel";
      }
    } else if (normalizedUserAgent.includes("windows")) {
      deviceType = "desktop";
      deviceVendor = "PC";
      deviceModel = "Windows PC";
    }
  }

  let deviceFullName = "Unknown";

  if (deviceVendor !== "Unknown" && deviceModel !== "Unknown") {
    deviceFullName = `${deviceVendor} ${deviceModel}`;
  } else if (deviceVendor !== "Unknown") {
    deviceFullName = deviceVendor;
  } else if (deviceModel !== "Unknown") {
    deviceFullName = deviceModel;
  } else if (deviceType === "mobile") {
    deviceFullName = "Mobile Device";
  } else if (deviceType === "tablet") {
    deviceFullName = "Tablet";
  } else {
    deviceFullName = "Desktop Computer";
  }

  return {
    browser: {
      name: result.browser.name || "Unknown",
      version: result.browser.version || "Unknown",
      major: result.browser.major || "Unknown",
      fullName: `${result.browser.name || "Unknown"} ${
        result.browser.version || ""
      }`.trim(),
    },
    device: {
      model: deviceModel,
      type: deviceType,
      vendor: deviceVendor,
      fullName: deviceFullName,
    },
    engine: {
      name: engineName,
      version: engineVersion,
      fullName: engineFullName,
    },
    os: {
      name: osName,
      version: osVersion,
      fullName: osFullName,
    },
    cpu: {
      architecture: cpuArchitecture,
    },
    screen: {
      colorDepth: "Unknown (requires client-side)",
      screenResolution: "Unknown (requires client-side)",
      availableResolution: "Unknown (requires client-side)",
      devicePixelRatio: "Unknown (requires client-side)",
    },
    capabilities: {
      javascript: true,
      cookies: "Unknown (requires client-side)",
      localStorage: "Unknown (requires client-side)",
      sessionStorage: "Unknown (requires client-side)",
      webGL: "Unknown (requires client-side)",
      canvas: "Unknown (requires client-side)",
    },
  };
}

export function getConnectionInfo(request: NextRequest): ConnectionInfo {
  const protocolHeader = request.nextUrl.protocol.replace(":", "");
  const forwardedProto =
    process.env.TRUST_PROXY_HEADERS === "true"
      ? request.headers.get("x-forwarded-proto")
      : null;
  const protocol = forwardedProto || protocolHeader || "http";

  return {
    language: request.headers.get("accept-language") || "Unknown",
    encoding: request.headers.get("accept-encoding") || "Unknown",
    connection: request.headers.get("connection") || "Unknown",
    cacheControl: request.headers.get("cache-control") || "Unknown",
    doNotTrack: request.headers.get("dnt") === "1" ? "Enabled" : "Disabled",
    httpsUpgrade:
      request.headers.get("upgrade-insecure-requests") === "1"
        ? "Enabled"
        : "Disabled",
    referrer: "Not retained",
    protocol,
    httpVersion: "2.0",
    securityHeaders: {
      strictTransportSecurity:
        request.headers.get("strict-transport-security") || "None",
      contentSecurityPolicy:
        request.headers.get("content-security-policy") || "None",
      xFrameOptions: request.headers.get("x-frame-options") || "None",
      xContentTypeOptions: request.headers.get("x-content-type-options") || "None",
      referrerPolicy: request.headers.get("referrer-policy") || "None",
    },
    performanceHints: {
      saveData: request.headers.get("save-data") === "on" ? "Enabled" : "Disabled",
      downlink: request.headers.get("downlink") || "Unknown",
      effectiveType: request.headers.get("ect") || "Unknown",
      rtt: request.headers.get("rtt") || "Unknown",
    },
    clientHints: {
      viewportWidth: request.headers.get("viewport-width") || "Unknown",
      deviceMemory: request.headers.get("device-memory") || "Unknown",
      dpr: request.headers.get("dpr") || "Unknown",
    },
  };
}

export function getIpType(ip: string): string {
  const scope = classifyIpScope(ip);

  if (scope === "loopback") {
    return "Loopback (Local)";
  }

  if (scope === "private") {
    return ip.includes(":") ? "Private IPv6" : "Private IPv4";
  }

  if (scope === "unique-local") {
    return "Unique Local IPv6";
  }

  if (scope === "link-local") {
    return "Link-Local";
  }

  if (scope === "carrier-grade-nat") {
    return "Carrier-Grade NAT";
  }

  if (scope === "documentation") {
    return "Documentation Range";
  }

  if (scope === "multicast") {
    return "Multicast";
  }

  if (scope === "unspecified") {
    return "Unspecified";
  }

  if (scope === "reserved") {
    return ip.includes(":") ? "Reserved IPv6" : "Reserved IPv4";
  }

  return ip.includes(":") ? "Public IPv6" : "Public IPv4";
}

export function getCountryName(countryCode: string): string {
  const countries: Record<string, string> = {
    US: "United States",
    TR: "Turkey",
    DE: "Germany",
    FR: "France",
    GB: "United Kingdom",
    IT: "Italy",
    ES: "Spain",
    NL: "Netherlands",
    CA: "Canada",
    AU: "Australia",
    JP: "Japan",
    CN: "China",
    RU: "Russia",
    BR: "Brazil",
    IN: "India",
    MX: "Mexico",
    KR: "South Korea",
    SE: "Sweden",
    NO: "Norway",
    DK: "Denmark",
    FI: "Finland",
    CH: "Switzerland",
    AT: "Austria",
    BE: "Belgium",
    PL: "Poland",
    CZ: "Czech Republic",
    HU: "Hungary",
    PT: "Portugal",
    GR: "Greece",
    IE: "Ireland",
    IL: "Israel",
    SG: "Singapore",
    TH: "Thailand",
    MY: "Malaysia",
    ID: "Indonesia",
    PH: "Philippines",
    VN: "Vietnam",
    ZA: "South Africa",
    EG: "Egypt",
    NG: "Nigeria",
    KE: "Kenya",
    AR: "Argentina",
    CL: "Chile",
    CO: "Colombia",
    PE: "Peru",
    VE: "Venezuela",
    UA: "Ukraine",
    RO: "Romania",
    BG: "Bulgaria",
    HR: "Croatia",
    SI: "Slovenia",
    SK: "Slovakia",
    LT: "Lithuania",
    LV: "Latvia",
    EE: "Estonia",
  };

  return countries[countryCode] || countryCode;
}

export function calculateIpRange(range: number[]): {
  start: string;
  end: string;
  total: number;
} {
  const [start, end] = range;

  const longToIp = (value: number) =>
    [
      (value >>> 24) & 255,
      (value >>> 16) & 255,
      (value >>> 8) & 255,
      value & 255,
    ].join(".");

  return {
    start: longToIp(start),
    end: longToIp(end),
    total: end - start + 1,
  };
}

export function buildLocationDataFromSources(
  geo: ReturnType<typeof lookupIP>,
  ispInfo: IspInfo
): {
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
  ll?: [number, number];
} | null {
  if (geo) {
    return geo;
  }

  if (!ispInfo.locationData) {
    return null;
  }

  return {
    country: ispInfo.locationData.countryCode || undefined,
    region: ispInfo.locationData.region || undefined,
    city: ispInfo.locationData.city || undefined,
    timezone: ispInfo.locationData.timezone || undefined,
    ll: [ispInfo.locationData.latitude, ispInfo.locationData.longitude],
  };
}

function summarizeGeoIPRuntimeIssue(geoipStatus: GeoIPRuntimeStatus = getGeoIPRuntimeStatus()) {

  if (geoipStatus.status === "ready" && !geoipStatus.lastLookupError) {
    return null;
  }

  if (geoipStatus.reason === "lookup_failed" || geoipStatus.lastLookupError) {
    return {
      kind: "lookup_failed" as const,
      summary: "GeoIP lookup failed at runtime.",
    };
  }

  if (geoipStatus.reason === "module_load_failed") {
    return {
      kind: "module_load_failed" as const,
      summary: "GeoIP database could not be initialized at runtime.",
    };
  }

  return {
    kind: "data_files_missing" as const,
    summary: "GeoIP database files were not available at runtime.",
  };
}

export function getLocationDataSourceLabel(
  geo: ReturnType<typeof lookupIP>,
  ispInfo: IspInfo,
  geoipStatus: GeoIPRuntimeStatus = getGeoIPRuntimeStatus()
) {
  const geoipIssue = summarizeGeoIPRuntimeIssue(geoipStatus);

  if (geo) {
    return "geoip-lite";
  }

  if (ispInfo.locationData) {
    return "Optional ISP enrichment";
  }

  if (geoipIssue) {
    return ALLOW_INSECURE_IP_API
      ? "GeoIP unavailable + optional ISP enrichment"
      : "GeoIP unavailable";
  }

  return ALLOW_INSECURE_IP_API
    ? "geoip-lite miss + optional ISP enrichment"
    : "geoip-lite miss";
}

export function buildLocationDiagnosis(
  geo: ReturnType<typeof lookupIP>,
  ispInfo: IspInfo,
  geoipStatus: GeoIPRuntimeStatus = getGeoIPRuntimeStatus()
) {
  const geoipIssue = summarizeGeoIPRuntimeIssue(geoipStatus);

  if (geo && !geoipIssue) {
    return undefined;
  }

  if (geoipIssue) {
    if (ispInfo.locationData) {
      return `${geoipIssue.summary} Location was recovered from optional ISP enrichment.`;
    }

    return ALLOW_INSECURE_IP_API
      ? `${geoipIssue.summary} Optional ISP enrichment did not return usable location data.`
      : `${geoipIssue.summary} Optional ISP enrichment is disabled.`;
  }

  if (ispInfo.locationData) {
    return "GeoIP did not return location data for this IP; location was recovered from optional ISP enrichment.";
  }

  return ALLOW_INSECURE_IP_API
    ? "GeoIP did not return location data for this IP, and optional ISP enrichment did not return usable coordinates."
    : "GeoIP did not return location data for this IP, and optional ISP enrichment is disabled.";
}

export function buildLocationAnalysis(
  locationData: {
    ll?: [number, number];
    timezone?: string;
  } | null,
  dataSource: string,
  currentDate: Date = new Date(),
  diagnosis?: string
): LocationAnalysis {
  const timezone = locationData?.timezone;
  const timezoneDetails = timezone
    ? getTimeZoneDetails(timezone, currentDate)
    : null;
  const hasLocationData = Boolean(locationData?.ll || timezone);

  return {
    accuracy: hasLocationData ? "City-level (±5-50 km)" : "Unavailable",
    confidence: hasLocationData ? "Medium-High" : "No geographic match",
    dataSource,
    lastUpdated: "Within the last 30 days",
    diagnosis,
    coordinates: locationData?.ll
      ? {
          latitude: locationData.ll[0],
          longitude: locationData.ll[1],
          precision: "~10km radius",
          format: "Decimal Degrees (DD)",
        }
      : null,
    timezone: timezone
      ? {
          name: timezone,
          offset:
            timezoneDetails?.offset ?? currentDate.getTimezoneOffset() / -60,
          isDST: timezoneDetails?.isDST ?? false,
          currentTime:
            timezoneDetails?.currentTime || formatTimeInZone(currentDate, timezone),
        }
      : null,
  };
}

export function buildBrowserSupport(deviceInfo: DeviceInfo): AnalyticsInfo["browserSupport"] {
  return {
    es6: !deviceInfo.browser.name.includes("Internet Explorer"),
    webGL: "Likely supported",
    touchSupport:
      deviceInfo.device.type === "mobile" || deviceInfo.device.type === "tablet"
        ? "Yes"
        : "No",
    orientation:
      deviceInfo.device.type === "mobile" ? "Portrait/Landscape" : "Landscape",
    cookieSupport: "Not tested",
    localStorageSupport: "Not tested",
  };
}

export function stripLocationDataFromIsp(ispInfo: IspInfo): Omit<IspInfo, "locationData"> {
  const { locationData: _locationData, ...rest } = ispInfo;
  return rest;
}

export async function buildResolvedIpSummary(ip: string): Promise<ResolvedIpSummary> {
  const [ispInfo] = await Promise.all([getIspInfo(ip)]);
  const geo = lookupIP(ip);
  const locationData = buildLocationDataFromSources(geo, ispInfo);
  const locationDiagnosis = buildLocationDiagnosis(geo, ispInfo);
  const location = buildLocationAnalysis(
    locationData,
    getLocationDataSourceLabel(geo, ispInfo),
    new Date(),
    locationDiagnosis
  );

  return {
    ip,
    ipType: getIpType(ip),
    country: locationData?.country || ispInfo.locationData?.countryCode || null,
    countryName: getCountryName(
      locationData?.country || ispInfo.locationData?.countryCode || ""
    ),
    city: locationData?.city || ispInfo.locationData?.city || null,
    region: locationData?.region || ispInfo.locationData?.regionName || null,
    timezone: locationData?.timezone || ispInfo.locationData?.timezone || null,
    coordinates: locationData?.ll
      ? {
          latitude: locationData.ll[0],
          longitude: locationData.ll[1],
        }
      : ispInfo.locationData
      ? {
          latitude: ispInfo.locationData.latitude,
          longitude: ispInfo.locationData.longitude,
        }
      : null,
    isp: stripLocationDataFromIsp(ispInfo),
    location,
  };
}

export function getRiskLevel(score: number): string {
  if (score < 20) {
    return "Low";
  }

  if (score < 50) {
    return "Medium";
  }

  if (score < 80) {
    return "High";
  }

  return "Critical";
}

function buildUnknownIspInfo(): IspInfo {
  return {
    isp: "Unknown",
    organization: "Unknown",
    asn: "Unknown",
    asnName: "Unknown",
    mobile: false,
    proxy: false,
    hosting: false,
    zipCode: "Unknown",
    locationData: null,
  };
}

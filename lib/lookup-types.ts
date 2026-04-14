export type LookupType = "ip" | "website";
export type LookupStatus = "ok" | "error";

export type ToneStatus = "pass" | "warn" | "fail" | "info";
export type ToneSeverity = "low" | "medium" | "high";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface DeviceInfo {
  browser: {
    name: string;
    version: string;
    major: string;
    fullName: string;
  };
  device: {
    model: string;
    type: string;
    vendor: string;
    fullName: string;
  };
  engine: {
    name: string;
    version: string;
    fullName: string;
  };
  os: {
    name: string;
    version: string;
    fullName: string;
  };
  cpu: {
    architecture: string;
  };
  screen: {
    colorDepth: string;
    screenResolution: string;
    availableResolution: string;
    devicePixelRatio: string;
  };
  capabilities: {
    javascript: boolean;
    cookies: string;
    localStorage: string;
    sessionStorage: string;
    webGL: string;
    canvas: string;
  };
}

export interface ConnectionInfo {
  language: string;
  encoding: string;
  connection: string;
  cacheControl: string;
  doNotTrack: string;
  httpsUpgrade: string;
  referrer: string;
  protocol: string;
  httpVersion: string;
  securityHeaders: {
    strictTransportSecurity: string;
    contentSecurityPolicy: string;
    xFrameOptions: string;
    xContentTypeOptions: string;
    referrerPolicy: string;
  };
  performanceHints: {
    saveData: string;
    downlink: string;
    effectiveType: string;
    rtt: string;
  };
  clientHints: {
    viewportWidth: string;
    deviceMemory: string;
    dpr: string;
  };
}

export interface SecurityInfo {
  isBot: boolean;
  riskScore: number;
  riskLevel: string;
  suspiciousHeaders: string[];
  botProbability: string;
}

export interface NetworkMetrics {
  responseTime: string;
  requestSize: number;
  timestamp: {
    iso: string;
    unix: number;
    formatted: string;
  };
  serverTime: {
    timezone: string;
    offset: number;
  };
}

export interface IspLocationData {
  country: string | null;
  countryCode: string | null;
  region: string | null;
  regionName: string | null;
  city: string | null;
  timezone: string | null;
  latitude: number;
  longitude: number;
}

export interface IspInfo {
  isp: string;
  organization: string;
  asn: string;
  asnName: string;
  mobile: boolean;
  proxy: boolean;
  hosting: boolean;
  zipCode: string;
  locationData: IspLocationData | null;
}

export interface LocationAnalysis {
  accuracy: string;
  confidence: string;
  dataSource: string;
  lastUpdated: string;
  diagnosis?: string;
  coordinates: {
    latitude: number;
    longitude: number;
    precision: string;
    format: string;
  } | null;
  timezone: {
    name: string;
    offset: number;
    isDST: boolean;
    currentTime: string;
  } | null;
}

export interface RequestInfo {
  timestamp: string;
  userAgent?: string;
  method?: string;
  url?: string;
  headers?: {
    host?: string;
    accept?: string;
    contentType?: string;
    requestId?: string;
  };
}

export interface AnalyticsInfo {
  pageLoadTime?: string;
  browserSupport: {
    es6: boolean;
    webGL: string;
    touchSupport: string;
    orientation: string;
    cookieSupport?: string;
    localStorageSupport?: string;
  };
  geoAccuracy: string;
  dataFreshness: string;
  totalRequestTime?: string;
}

export interface LookupDetails {
  accuracy?: string;
  provider?: string;
  lastUpdate?: string;
  note?: string;
  totalIpsInRange?: string;
  privacyLevel?: string;
  dataRetention?: string;
  recommendations?: string[];
  explanation?: string;
  reason?: string;
  retryAfterSeconds?: number;
}

export interface RateLimitInfo {
  scope: string;
  limit: number;
  remaining: number;
  resetAt: string;
  retryAfterSeconds?: number;
}

export interface LookupErrorDetails extends LookupDetails {
  code: string;
  retryable?: boolean;
  upstream?: string;
  rateLimit?: RateLimitInfo & {
    windowMs?: number;
  };
}

export interface WebsiteCheck {
  id: string;
  label: string;
  status: ToneStatus;
  severity: ToneSeverity;
  message: string;
  recommendation?: string;
}

export interface WebsiteDnsInfo {
  a: string[];
  aaaa: string[];
  cname: string[];
  ns: string[];
  mx: string[];
}

export interface WebsiteRedirect {
  from: string;
  to: string;
  status: number;
}

export interface WebsiteHttpInfo {
  status?: number;
  statusText?: string;
  contentType?: string;
  contentLength?: number | null;
  server?: string;
  cacheControl?: string;
  headers?: Record<string, string>;
}

export interface WebsiteMetaInfo {
  title?: string;
  description?: string;
  canonical?: string;
  robots?: string;
  lang?: string;
  generator?: string;
  openGraph?: {
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
    type?: string;
    url?: string;
  };
}

export interface WebsiteTlsInfo {
  available: boolean;
  issuer?: string;
  subject?: string;
  validFrom?: string;
  validTo?: string;
  daysRemaining?: number;
  san?: string[];
  error?: string;
}

export interface WebsiteAssetsInfo {
  robotsTxt: "present" | "missing" | "unknown";
  sitemapXml: "present" | "missing" | "unknown";
  favicon?: string;
}

export interface ResolvedIpSummary {
  ip: string;
  ipType?: string;
  country?: string | null;
  countryName?: string | null;
  city?: string | null;
  region?: string | null;
  timezone?: string | null;
  coordinates?: Coordinates | null;
  isp?: Omit<IspInfo, "locationData">;
  location?: LocationAnalysis;
}

export interface WebsiteSummary {
  primarySignal?: string;
  transport?: string;
  indexability?: string;
  hosting?: string;
}

export interface WebsiteAnalysis {
  url?: string;
  hostname?: string;
  protocol?: string;
  redirects?: WebsiteRedirect[];
  http?: WebsiteHttpInfo;
  meta?: WebsiteMetaInfo;
  tls?: WebsiteTlsInfo;
  dns?: WebsiteDnsInfo;
  assets?: WebsiteAssetsInfo;
  resolvedIps?: ResolvedIpSummary[];
  checks?: WebsiteCheck[];
  summary?: WebsiteSummary;
}

export interface PartialLookupData {
  device?: DeviceInfo;
  connection?: ConnectionInfo;
  security?: SecurityInfo;
  timestamp?: string;
}

export interface LookupResponseBase {
  status?: LookupStatus;
  lookupType: LookupType;
  query: string;
  normalizedTarget?: string;
  requestId?: string;
  timestamp?: string;
  warnings?: string[];
  ip: string;
  error?: string;
  errorCode?: string;
  rateLimit?: RateLimitInfo;
}

export interface IpLookupResponse extends LookupResponseBase {
  status: "ok";
  lookupType: "ip";
  requestedIp?: string;
  ipType?: string;
  country?: string | null;
  countryName?: string | null;
  city?: string | null;
  region?: string | null;
  timezone?: string | null;
  coordinates?: Coordinates | null;
  range?: number[] | null;
  ipRange?: {
    start: string;
    end: string;
    total: number;
  } | null;
  device?: DeviceInfo;
  connection?: ConnectionInfo;
  security?: SecurityInfo;
  network?: NetworkMetrics;
  isp?: Omit<IspInfo, "locationData">;
  location?: LocationAnalysis;
  requestInfo?: RequestInfo;
  analytics?: AnalyticsInfo;
  details?: LookupDetails;
  isLocal?: boolean;
}

export interface WebsiteLookupResponse extends LookupResponseBase {
  status: "ok";
  lookupType: "website";
  requestedIp?: string;
  ipType?: string;
  country?: string | null;
  countryName?: string | null;
  city?: string | null;
  region?: string | null;
  timezone?: string | null;
  coordinates?: Coordinates | null;
  security?: SecurityInfo;
  network?: NetworkMetrics;
  isp?: Omit<IspInfo, "locationData">;
  location?: LocationAnalysis;
  requestInfo?: RequestInfo;
  analytics?: AnalyticsInfo;
  details?: LookupDetails;
  website?: WebsiteAnalysis;
}

export interface LookupErrorResponse extends LookupResponseBase {
  status?: "error";
  error: string;
  details: LookupErrorDetails | LookupDetails;
  partialData?: PartialLookupData;
  errorCode?: string;
  device?: DeviceInfo;
  connection?: ConnectionInfo;
  security?: SecurityInfo;
  network?: NetworkMetrics;
  isp?: Omit<IspInfo, "locationData">;
  location?: LocationAnalysis;
  requestInfo?: RequestInfo;
  analytics?: AnalyticsInfo;
  website?: WebsiteAnalysis;
  isLocal?: boolean;
  [key: string]: unknown;
}

export type LookupResult = Record<string, any>;

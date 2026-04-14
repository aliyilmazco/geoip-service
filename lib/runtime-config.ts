const DEFAULT_APP_URL = "http://localhost:3001";
const DEFAULT_SUPPORT_EMAIL = "support@example.com";

function readBooleanEnv(name: string, fallback: boolean) {
  const raw = process.env[name]?.trim().toLowerCase();

  if (!raw) {
    return fallback;
  }

  if (["1", "true", "yes", "on"].includes(raw)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(raw)) {
    return false;
  }

  return fallback;
}

function readNumberEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readStringEnv(name: string, fallback: string) {
  const raw = process.env[name]?.trim();
  return raw ? raw : fallback;
}

function readOptionalStringEnv(name: string) {
  const raw = process.env[name]?.trim();
  return raw ? raw : null;
}

function normalizeBaseUrl(value: string) {
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_APP_URL;
  }
}

const tursoDatabaseUrl = readOptionalStringEnv("TURSO_DATABASE_URL");
const tursoAuthToken = readOptionalStringEnv("TURSO_AUTH_TOKEN");

export const runtimeConfig = {
  appUrl: normalizeBaseUrl(readStringEnv("PUBLIC_APP_URL", DEFAULT_APP_URL)),
  supportEmail: readStringEnv("SUPPORT_EMAIL", DEFAULT_SUPPORT_EMAIL),
  isp: {
    endpointBaseUrl: readStringEnv("ISP_PROVIDER_BASE_URL", "http://ip-api.com"),
    timeoutMs: readNumberEnv("ISP_PROVIDER_TIMEOUT_MS", 5_000),
    cacheTtlMs: readNumberEnv("ISP_PROVIDER_CACHE_TTL_MS", 900_000),
  },
  websiteProbe: {
    timeoutMs: readNumberEnv("WEBSITE_PROBE_TIMEOUT_MS", 8_000),
    maxRedirects: readNumberEnv("WEBSITE_PROBE_MAX_REDIRECTS", 5),
    maxHtmlBytes: readNumberEnv("WEBSITE_PROBE_MAX_HTML_BYTES", 512 * 1024),
    assetProbeTimeoutMs: readNumberEnv("WEBSITE_ASSET_TIMEOUT_MS", 5_000),
    assetProbeMaxBytes: readNumberEnv("WEBSITE_ASSET_MAX_BYTES", 64 * 1024),
    dnsCacheTtlMs: readNumberEnv("WEBSITE_DNS_CACHE_TTL_MS", 300_000),
    tlsTimeoutMs: readNumberEnv("WEBSITE_TLS_TIMEOUT_MS", 5_000),
  },
  lookupLogging: {
    enabled: readBooleanEnv(
      "TURSO_LOGGING_ENABLED",
      Boolean(tursoDatabaseUrl && tursoAuthToken)
    ),
    databaseUrl: tursoDatabaseUrl,
    authToken: tursoAuthToken,
  },
} as const;

export function getOpenApiServers() {
  const servers = [
    {
      url: DEFAULT_APP_URL,
      description: "Local development server",
    },
  ];

  if (runtimeConfig.appUrl !== DEFAULT_APP_URL) {
    servers.push({
      url: runtimeConfig.appUrl,
      description: "Configured public server",
    });
  }

  return servers;
}

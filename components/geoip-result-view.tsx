import type { ReactNode } from "react";

import { LocationMapPanel } from "@/components/location-map-panel";
import type { LookupResult, WebsiteCheck } from "@/lib/lookup-types";
import { formatUtcOffset } from "@/lib/timezone";

export type LocationData = LookupResult;

type Tone = "neutral" | "success" | "warning" | "danger";

type SummaryMetric = {
  label: string;
  value: string;
  hint: string;
  tone?: Tone;
};

type DetailItem = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: Tone;
  mono?: boolean;
  full?: boolean;
};

type DetailSection = {
  eyebrow: string;
  title: string;
  description: string;
  items: DetailItem[];
  note?: ReactNode;
};

const numberFormatter = new Intl.NumberFormat("en-US");

function formatDateTime(value?: string) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US");
}

function formatBytes(bytes?: number) {
  if (typeof bytes !== "number") {
    return "Unknown";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(2)} KB`;
}

function formatOffset(offset?: number) {
  return formatUtcOffset(offset);
}

function formatNetworkScale(total: number) {
  if (total > 1_000_000) {
    return "Very large network";
  }

  if (total > 100_000) {
    return "Large network";
  }

  if (total > 10_000) {
    return "Medium scale";
  }

  return "Small network";
}

function getRiskTone(level?: string): Tone {
  const normalized = level?.toLocaleLowerCase("en-US") ?? "";

  if (normalized.includes("critical")) {
    return "danger";
  }

  if (
    normalized.includes("high") ||
    normalized.includes("medium")
  ) {
    return "warning";
  }

  if (normalized) {
    return "success";
  }

  return "neutral";
}

function pushIf(
  items: DetailItem[],
  condition: boolean,
  item: DetailItem | (() => DetailItem)
) {
  if (!condition) {
    return;
  }

  items.push(typeof item === "function" ? item() : item);
}

function buildTextNote(parts: Array<string | undefined>) {
  const content = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  if (content.length === 0) {
    return undefined;
  }

  return <p>{content.join(" / ")}</p>;
}

function getLocationLine(result: LocationData) {
  return (
    [result.city, result.region, result.countryName]
      .filter(Boolean)
      .join(", ") ||
    result.countryName ||
    result.country ||
    "Location signal unavailable"
  );
}

function getNetworkLine(result: LocationData) {
  return (
    result.isp?.organization ||
    result.isp?.isp ||
    result.details?.provider ||
    "Unknown"
  );
}

function getCoordinates(result: LocationData) {
  if (result.coordinates) {
    return result.coordinates;
  }

  if (result.location?.coordinates) {
    return {
      latitude: result.location.coordinates.latitude,
      longitude: result.location.coordinates.longitude,
    };
  }

  return null;
}

function StatusBadge({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span className="status-badge" data-tone={tone}>
      {children}
    </span>
  );
}

function TokenList({
  items,
  tone = "neutral",
}: {
  items: string[];
  tone?: Tone;
}) {
  return (
    <div className="token-list">
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="token" data-tone={tone}>
          {item}
        </span>
      ))}
    </div>
  );
}

function SummaryCard({ metric }: { metric: SummaryMetric }) {
  return (
    <article className="metric-card" data-tone={metric.tone ?? "neutral"}>
      <span className="metric-label">{metric.label}</span>
      <strong className="metric-value">{metric.value}</strong>
      <span className="metric-hint">{metric.hint}</span>
    </article>
  );
}

function DetailCard({
  item,
  variant = "primary",
}: {
  item: DetailItem;
  variant?: "primary" | "advanced";
}) {
  return (
    <article
      className={`data-card data-card-${variant}${
        item.full ? " data-card-full" : ""
      }${item.mono ? " data-card-mono" : ""}`}
      data-tone={item.tone ?? "neutral"}
    >
      <span className="data-label">{item.label}</span>
      <div className="data-value">{item.value}</div>
      {item.detail ? <div className="data-detail">{item.detail}</div> : null}
    </article>
  );
}

function DetailSectionCard({
  section,
  variant = "primary",
}: {
  section: DetailSection;
  variant?: "primary" | "advanced";
}) {
  return (
    <section className={`detail-section detail-section-${variant}`}>
      <div className="section-heading title-stack">
        <span className="eyebrow">{section.eyebrow}</span>
        <h3 className="section-title">{section.title}</h3>
        <p className="section-description">{section.description}</p>
      </div>
      <div
        className={`detail-grid${
          variant === "advanced" ? " detail-grid-advanced" : ""
        }`}
      >
        {section.items.map((item, index) => (
          <DetailCard
            key={`${section.title}-${item.label}-${index}`}
            item={item}
            variant={variant}
          />
        ))}
      </div>
      {section.note ? <div className="section-note">{section.note}</div> : null}
    </section>
  );
}

function DisclosureSectionCard({ section }: { section: DetailSection }) {
  return (
    <details className="detail-disclosure">
      <summary className="detail-disclosure-summary">
        <span className="detail-disclosure-copy">
          <span className="eyebrow">{section.eyebrow}</span>
          <span className="detail-disclosure-title">{section.title}</span>
          <span className="detail-disclosure-description">
            {section.description}
          </span>
        </span>
        <span className="detail-disclosure-meta">
          {section.items.length} fields
        </span>
      </summary>
      <div className="detail-disclosure-body">
        <DetailSectionCard section={section} variant="advanced" />
      </div>
    </details>
  );
}

function isWebsiteResult(result: LocationData) {
  return result.lookupType === "website";
}

function getCheckTone(status?: WebsiteCheck["status"]): Tone {
  if (status === "fail") {
    return "danger";
  }

  if (status === "warn") {
    return "warning";
  }

  if (status === "pass") {
    return "success";
  }

  return "neutral";
}

function formatAssetStatus(value?: "present" | "missing" | "unknown") {
  if (value === "present") {
    return "Present";
  }

  if (value === "missing") {
    return "Missing";
  }

  return "Unknown";
}

function formatHeaderLabel(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}

function buildWebsiteSummary(result: LocationData): SummaryMetric[] {
  const resolvedIpCount = result.website?.resolvedIps?.length || 0;
  const transport =
    result.website?.protocol === "https"
      ? "HTTPS"
      : result.website?.protocol === "http"
      ? "HTTP"
      : "Unknown";

  return [
    {
      label: "Analyzed target",
      value:
        result.website?.hostname || result.query || result.normalizedTarget || "Unknown",
      hint: result.website?.url || result.normalizedTarget || "Final URL could not be read",
    },
    {
      label: "Transport layer",
      value: transport,
      hint:
        result.website?.tls?.available && typeof result.website?.tls?.daysRemaining === "number"
          ? `Certificate expires in ${result.website?.tls?.daysRemaining} days`
          : result.website?.summary?.transport || "No TLS information",
    },
    {
      label: "Risk",
      value: result.security?.riskLevel || "No score",
      hint: result.security
        ? `${result.security.riskScore}/100 risk score`
        : "No website risk score generated",
      tone: getRiskTone(result.security?.riskLevel),
    },
    {
      label: "Resolved IP",
      value:
        resolvedIpCount > 0 ? `${resolvedIpCount} addresses` : result.ip || "Not found",
      hint:
        result.website?.resolvedIps?.[0]
          ? [
              result.website.resolvedIps[0].ip,
              result.website.resolvedIps[0].countryName,
              result.website.resolvedIps[0].city,
            ]
              .filter(Boolean)
              .join(" / ")
          : "No DNS result",
    },
  ];
}

function buildWebsiteErrorSummary(result: LocationData): SummaryMetric[] {
  return [
    {
      label: "Analyzed target",
      value: result.query || result.normalizedTarget || "Unknown",
      hint: result.lookupType === "website" ? "Website lookup" : "Limited response",
    },
    {
      label: "Status",
      value: "Could not retrieve a website response",
      hint: result.error || "No details",
      tone: "warning",
    },
    {
      label: "Risk",
      value: result.security?.riskLevel || "No score",
      hint: result.security
        ? `${result.security.riskScore}/100 risk score`
        : "Risk score could not be generated",
      tone: getRiskTone(result.security?.riskLevel),
    },
    {
      label: "Advanced signal",
      value: result.details?.reason || "DNS or HTTP error",
      hint: result.details?.explanation || "No technical explanation",
    },
  ];
}

function buildWebsiteBadges(result: LocationData) {
  const badges: Array<{ label: string; tone?: Tone }> = [{ label: "Website" }];

  if (result.website?.protocol) {
    badges.push({
      label: result.website.protocol.toUpperCase(),
      tone: result.website.protocol === "https" ? "success" : "warning",
    });
  }

  if (result.security?.riskLevel) {
    badges.push({
      label: `Risk: ${result.security.riskLevel}`,
      tone: getRiskTone(result.security.riskLevel),
    });
  }

  if (result.website?.redirects && result.website.redirects.length > 0) {
    badges.push({
      label: `${result.website.redirects.length} redirect`,
      tone: result.website.redirects.length > 2 ? "warning" : "neutral",
    });
  }

  if (result.website?.assets?.robotsTxt === "present") {
    badges.push({ label: "robots.txt", tone: "success" });
  }

  return badges;
}

function buildWebsiteSecurityItems(result: LocationData): DetailItem[] {
  const items: DetailItem[] = [];
  const failedChecks: WebsiteCheck[] = (result.website?.checks || []).filter(
    (check: WebsiteCheck) => check.status !== "pass" && check.status !== "info"
  );

  pushIf(items, Boolean(result.security), () => ({
    label: "Risk level",
    value: (
      <div className="value-stack">
        <span>
          {result.security?.riskScore}/100 ({result.security?.riskLevel})
        </span>
        <StatusBadge tone={getRiskTone(result.security?.riskLevel)}>
          {result.security?.riskLevel || "Score"}
        </StatusBadge>
      </div>
    ),
    tone: getRiskTone(result.security?.riskLevel),
  }));
  pushIf(items, failedChecks.length > 0, () => ({
    label: "Checks that need attention",
    value: <TokenList items={failedChecks.map((check) => check.label)} tone="warning" />,
    full: true,
    tone: "warning",
  }));
  pushIf(items, Boolean(result.website?.checks?.length), {
    label: "Total checks",
    value: `${result.website?.checks?.length || 0} rules`,
  });
  pushIf(items, Boolean(result.details?.dataRetention), {
    label: "Data retention",
    value: result.details?.dataRetention || "Unknown",
  });
  pushIf(items, Boolean(result.details?.recommendations?.length), () => ({
    label: "Recommendations",
    value: <TokenList items={result.details?.recommendations || []} />,
    full: true,
  }));

  return items;
}

function buildWebsitePrimarySections(result: LocationData): DetailSection[] {
  const sections: DetailSection[] = [];

  const overviewItems: DetailItem[] = [];
  pushIf(overviewItems, Boolean(result.query), {
    label: "Query",
    value: result.query || "Unknown",
    mono: true,
    full: true,
  });
  pushIf(overviewItems, Boolean(result.website?.url), {
    label: "Final URL",
    value: result.website?.url || "Unknown",
    mono: true,
    full: true,
    detail: result.website?.url ? (
      <a
        href={result.website.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-link"
      >
        Open site
      </a>
    ) : undefined,
  });
  pushIf(overviewItems, Boolean(result.website?.hostname), {
    label: "Hostname",
    value: result.website?.hostname || "Unknown",
  });
  pushIf(overviewItems, Boolean(result.website?.protocol), {
    label: "Protocol",
    value: (
      <div className="value-stack">
        <span>{result.website?.protocol?.toUpperCase()}</span>
        <StatusBadge
          tone={result.website?.protocol === "https" ? "success" : "warning"}
        >
          {result.website?.protocol === "https" ? "Secure transport" : "HTTP"}
        </StatusBadge>
      </div>
    ),
    tone: result.website?.protocol === "https" ? "success" : "warning",
  });
  pushIf(overviewItems, typeof result.website?.http?.status === "number", {
    label: "HTTP status",
    value: `${result.website?.http?.status} ${result.website?.http?.statusText || ""}`.trim(),
    tone:
      (result.website?.http?.status || 0) >= 400
        ? "danger"
        : (result.website?.http?.status || 0) >= 300
        ? "warning"
        : "success",
  });
  pushIf(overviewItems, Boolean(result.website?.meta?.title), {
    label: "Title",
    value: result.website?.meta?.title || "Unknown",
    full: true,
  });
  pushIf(overviewItems, Boolean(result.website?.meta?.description), {
    label: "Meta description",
    value: result.website?.meta?.description || "Unknown",
    full: true,
  });
  pushIf(overviewItems, Boolean(result.website?.meta?.canonical), {
    label: "Canonical",
    value: result.website?.meta?.canonical || "Unknown",
    mono: true,
    full: true,
  });
  pushIf(overviewItems, Boolean(result.website?.meta?.lang), {
    label: "Language",
    value: result.website?.meta?.lang || "Unknown",
  });

  sections.push({
    eyebrow: "Website",
    title: "Website summary",
    description: "The final URL, document metadata, and first HTML signals are collected here.",
    items: overviewItems,
    note: buildTextNote([
      result.website?.summary?.primarySignal || undefined,
      result.website?.summary?.transport || undefined,
      result.location?.diagnosis || undefined,
      result.details?.note || undefined,
    ]),
  });

  const dnsItems: DetailItem[] = [];
  pushIf(dnsItems, Boolean(result.website?.dns?.a?.length), () => ({
    label: "A records",
    value: <TokenList items={result.website?.dns?.a || []} />,
    full: true,
  }));
  pushIf(dnsItems, Boolean(result.website?.dns?.aaaa?.length), () => ({
    label: "AAAA records",
    value: <TokenList items={result.website?.dns?.aaaa || []} />,
    full: true,
  }));
  pushIf(dnsItems, Boolean(result.website?.dns?.cname?.length), () => ({
    label: "CNAME",
    value: <TokenList items={result.website?.dns?.cname || []} />,
    full: true,
  }));
  pushIf(dnsItems, Boolean(result.website?.dns?.ns?.length), () => ({
    label: "NS",
    value: <TokenList items={result.website?.dns?.ns || []} />,
    full: true,
  }));
  pushIf(dnsItems, Boolean(result.website?.dns?.mx?.length), () => ({
    label: "MX",
    value: <TokenList items={result.website?.dns?.mx || []} />,
    full: true,
  }));
  pushIf(dnsItems, Boolean(result.website?.resolvedIps?.length), () => ({
    label: "Resolved IPs",
    value: (
      <TokenList
        items={result.website?.resolvedIps?.map((entry: { ip: string }) => entry.ip) || []}
      />
    ),
    full: true,
  }));
  pushIf(dnsItems, Boolean(result.ip), {
    label: "Primary IP",
    value: result.ip,
    mono: true,
    detail:
      result.countryName || result.city
        ? [result.countryName, result.city, result.region].filter(Boolean).join(" / ")
        : undefined,
  });

  if (dnsItems.length > 0) {
    sections.push({
      eyebrow: "DNS",
      title: "DNS and resolved IPs",
      description: "Hostname records and IP summaries tied to location appear in this block.",
      items: dnsItems,
      note: buildTextNote([
        result.website?.summary?.hosting || undefined,
        result.location?.dataSource ? `Location source: ${result.location.dataSource}` : undefined,
        result.location?.diagnosis || undefined,
      ]),
    });
  }

  const securityItems = buildWebsiteSecurityItems(result);

  if (securityItems.length > 0) {
    sections.push({
      eyebrow: "Checks",
      title: "Risk and check summary",
      description: "The score, problematic rules, and action recommendations appear here.",
      items: securityItems,
      note: buildTextNote([
        result.details?.privacyLevel
          ? `Risk level: ${result.details.privacyLevel}`
          : undefined,
      ]),
    });
  }

  return sections;
}

function buildWebsiteAdvancedSections(result: LocationData): DetailSection[] {
  const sections: DetailSection[] = [];

  const httpItems: DetailItem[] = [];
  pushIf(httpItems, typeof result.website?.http?.status === "number", {
    label: "Status code",
    value: `${result.website?.http?.status} ${result.website?.http?.statusText || ""}`.trim(),
  });
  pushIf(httpItems, Boolean(result.website?.http?.contentType), {
    label: "Content-Type",
    value: result.website?.http?.contentType || "Unknown",
  });
  pushIf(httpItems, typeof result.website?.http?.contentLength === "number", {
    label: "Content-Length",
    value: formatBytes(result.website?.http?.contentLength ?? undefined),
  });
  pushIf(httpItems, Boolean(result.website?.http?.server), {
    label: "Server",
    value: result.website?.http?.server || "Unknown",
  });
  pushIf(httpItems, Boolean(result.website?.http?.cacheControl), {
    label: "Cache-Control",
    value: result.website?.http?.cacheControl || "Unknown",
    mono: true,
    full: true,
  });
  Object.entries(result.website?.http?.headers || {}).forEach(([key, value]) => {
    pushIf(httpItems, Boolean(value), {
      label: formatHeaderLabel(key),
      value: String(value),
      mono: true,
      full: true,
    });
  });
  pushIf(httpItems, Boolean(result.website?.redirects?.length), {
    label: "Redirect chain",
    value: (
      <TokenList
        items={
          result.website?.redirects?.map(
            (redirect: { status: number; to: string }) =>
              `${redirect.status} ${new URL(redirect.to).hostname}`
          ) || []
        }
      />
    ),
    full: true,
  });

  if (httpItems.length > 0) {
    sections.push({
      eyebrow: "HTTP",
      title: "HTTP and security headers",
      description: "The main response, selected headers, and redirect chain expand here.",
      items: httpItems,
    });
  }

  const tlsMetaItems: DetailItem[] = [];
  pushIf(tlsMetaItems, typeof result.website?.tls?.available === "boolean", {
    label: "TLS status",
    value: (
      <div className="value-stack">
        <span>{result.website?.tls?.available ? "Active" : "Unavailable / unreadable"}</span>
        <StatusBadge tone={result.website?.tls?.available ? "success" : "warning"}>
          {result.website?.tls?.available ? "Certificate available" : "TLS issue"}
        </StatusBadge>
      </div>
    ),
    tone: result.website?.tls?.available ? "success" : "warning",
  });
  pushIf(tlsMetaItems, Boolean(result.website?.tls?.issuer), {
    label: "Issuer",
    value: result.website?.tls?.issuer || "Unknown",
    full: true,
  });
  pushIf(tlsMetaItems, Boolean(result.website?.tls?.subject), {
    label: "Subject",
    value: result.website?.tls?.subject || "Unknown",
    full: true,
  });
  pushIf(tlsMetaItems, Boolean(result.website?.tls?.validFrom), {
    label: "Valid from",
    value: formatDateTime(result.website?.tls?.validFrom),
  });
  pushIf(tlsMetaItems, Boolean(result.website?.tls?.validTo), {
    label: "Valid until",
    value: formatDateTime(result.website?.tls?.validTo),
  });
  pushIf(tlsMetaItems, typeof result.website?.tls?.daysRemaining === "number", {
    label: "Days remaining",
    value: `${result.website?.tls?.daysRemaining} days`,
    tone:
      (result.website?.tls?.daysRemaining || 0) < 14
        ? "warning"
        : "success",
  });
  pushIf(tlsMetaItems, Boolean(result.website?.tls?.san?.length), () => ({
    label: "SAN",
    value: <TokenList items={result.website?.tls?.san || []} />,
    full: true,
  }));
  pushIf(tlsMetaItems, Boolean(result.website?.tls?.error), {
    label: "TLS error",
    value: result.website?.tls?.error || "Unknown",
    full: true,
    tone: "warning",
  });
  pushIf(tlsMetaItems, Boolean(result.website?.meta?.robots), {
    label: "Meta robots",
    value: result.website?.meta?.robots || "Unknown",
    mono: true,
    full: true,
  });
  pushIf(tlsMetaItems, Boolean(result.website?.meta?.generator), {
    label: "Generator",
    value: result.website?.meta?.generator || "Unknown",
  });
  pushIf(tlsMetaItems, Boolean(result.website?.meta?.openGraph?.title), {
    label: "OG title",
    value: result.website?.meta?.openGraph?.title || "Unknown",
    full: true,
  });
  pushIf(tlsMetaItems, Boolean(result.website?.meta?.openGraph?.description), {
    label: "OG description",
    value: result.website?.meta?.openGraph?.description || "Unknown",
    full: true,
  });
  pushIf(tlsMetaItems, Boolean(result.website?.meta?.openGraph?.image), {
    label: "OG image",
    value: result.website?.meta?.openGraph?.image || "Unknown",
    mono: true,
    full: true,
  });
  pushIf(tlsMetaItems, Boolean(result.website?.assets), {
    label: "robots.txt",
    value: formatAssetStatus(result.website?.assets?.robotsTxt),
    tone: result.website?.assets?.robotsTxt === "present" ? "success" : "neutral",
  });
  pushIf(tlsMetaItems, Boolean(result.website?.assets), {
    label: "sitemap.xml",
    value: formatAssetStatus(result.website?.assets?.sitemapXml),
    tone: result.website?.assets?.sitemapXml === "present" ? "success" : "neutral",
  });
  pushIf(tlsMetaItems, Boolean(result.website?.assets?.favicon), {
    label: "Favicon",
    value: result.website?.assets?.favicon || "Unknown",
    mono: true,
    full: true,
  });

  if (tlsMetaItems.length > 0) {
    sections.push({
      eyebrow: "TLS + Meta",
      title: "TLS and document metadata",
      description: "Certificate, robots, Open Graph fields, and indexability signals appear here.",
      items: tlsMetaItems,
    });
  }

  const resolvedIpItems: DetailItem[] = [];
  (result.website?.resolvedIps || []).forEach(
    (
      entry: {
        ip: string;
        countryName?: string | null;
        city?: string | null;
        region?: string | null;
        isp?: { asn?: string; organization?: string; isp?: string };
      },
      index: number
    ) => {
    resolvedIpItems.push({
      label: `IP ${index + 1}`,
      value: entry.ip,
      mono: true,
      full: true,
      detail: [
        entry.countryName,
        entry.city,
        entry.region,
        entry.isp?.asn,
        entry.isp?.organization || entry.isp?.isp,
      ]
        .filter(Boolean)
        .join(" / "),
    });
    }
  );

  if (resolvedIpItems.length > 0) {
    sections.push({
      eyebrow: "IP summaries",
      title: "Resolved IP details",
      description: "Location and network summaries are listed for each resolved IP.",
      items: resolvedIpItems,
    });
  }

  const checkItems: DetailItem[] = [];
  (result.website?.checks || []).forEach((check: WebsiteCheck) => {
    checkItems.push({
      label: check.label,
      value: (
        <div className="value-stack">
          <span>{check.message}</span>
          <StatusBadge tone={getCheckTone(check.status)}>
            {check.status.toUpperCase()}
          </StatusBadge>
        </div>
      ),
      detail: check.recommendation || undefined,
      full: true,
      tone: getCheckTone(check.status),
    });
  });

  if (checkItems.length > 0) {
    sections.push({
      eyebrow: "Checks",
      title: "Check details",
      description: "All website checks that affect the score are listed with explanations.",
      items: checkItems,
    });
  }

  return sections;
}

function buildSuccessSummary(result: LocationData): SummaryMetric[] {
  if (isWebsiteResult(result)) {
    return buildWebsiteSummary(result);
  }

  const riskTone = result.security?.riskLevel
    ? getRiskTone(result.security.riskLevel)
    : result.isp?.proxy
    ? "warning"
    : "neutral";

  return [
    {
      label: "Analyzed IP",
      value: result.ip,
      hint:
        result.requestedIp && result.requestedIp !== result.ip
          ? `Requested: ${result.requestedIp}`
          : result.ipType || "Auto-detected",
    },
    {
      label: "Location",
      value: getLocationLine(result),
      hint:
        result.timezone ||
        result.location?.timezone?.name ||
        "No timezone information",
    },
    {
      label: "Risk",
      value:
        result.security?.riskLevel || (result.isp?.proxy ? "Needs review" : "No score"),
      hint: result.security
        ? `${result.security.riskScore}/100 risk score${
            result.isp?.proxy ? " / Proxy signal present" : ""
          }`
        : result.isp?.proxy
        ? "Proxy signal detected"
        : "No security score generated",
      tone: riskTone,
    },
    {
      label: "Network",
      value: getNetworkLine(result),
      hint: result.isp?.asn
        ? `${result.isp.asn} ${result.isp.asnName}`.trim()
        : result.network?.responseTime || "No provider information",
    },
  ];
}

function buildErrorSummary(result: LocationData): SummaryMetric[] {
  if (isWebsiteResult(result)) {
    return buildWebsiteErrorSummary(result);
  }

  const riskTone = result.security?.riskLevel
    ? getRiskTone(result.security.riskLevel)
    : "warning";

  return [
    {
      label: "Analyzed IP",
      value: result.ip || result.requestedIp || "Unknown",
      hint: result.ipType || "Limited response",
    },
    {
      label: "Status",
      value: result.isLocal ? "Local or private network" : "No exact match",
      hint: result.error || "No details",
      tone: "warning",
    },
    {
      label: "Security",
      value: result.security?.riskLevel || "No score",
      hint: result.security
        ? `${result.security.riskScore}/100 risk score`
        : "No security score generated",
      tone: riskTone,
    },
    {
      label: "Available signal",
      value: result.device?.browser.fullName || "Limited client data",
      hint: result.device?.os.fullName || "No additional device info",
    },
  ];
}

function buildSharedBadges(result: LocationData) {
  if (isWebsiteResult(result)) {
    return buildWebsiteBadges(result);
  }

  const badges: Array<{ label: string; tone?: Tone }> = [];

  if (result.ipType) {
    badges.push({ label: result.ipType });
  }

  if (result.isLocal) {
    badges.push({ label: "Local network", tone: "warning" });
  }

  if (result.security?.riskLevel) {
    badges.push({
      label: `Risk: ${result.security.riskLevel}`,
      tone: getRiskTone(result.security.riskLevel),
    });
  }

  if (result.isp?.proxy) {
    badges.push({ label: "Proxy signal", tone: "warning" });
  }

  return badges;
}

function buildLocationLabel(result: LocationData) {
  if (isWebsiteResult(result)) {
    return (
      result.website?.hostname ||
      [result.city, result.region, result.countryName || result.country]
        .filter(Boolean)
        .join(", ") ||
      result.query ||
      "Website"
    );
  }

  return (
    [result.city, result.region, result.countryName || result.country]
      .filter(Boolean)
      .join(", ") || result.ip
  );
}

function buildSecurityItems(result: LocationData): DetailItem[] {
  if (isWebsiteResult(result)) {
    return buildWebsiteSecurityItems(result);
  }

  const items: DetailItem[] = [];

  pushIf(items, Boolean(result.security), () => ({
    label: "Risk level",
    value: (
      <div className="value-stack">
        <span>
          {result.security?.riskScore}/100 ({result.security?.riskLevel})
        </span>
        <StatusBadge tone={getRiskTone(result.security?.riskLevel)}>
          {result.security?.riskLevel || "Score"}
        </StatusBadge>
      </div>
    ),
    tone: getRiskTone(result.security?.riskLevel),
  }));
  pushIf(items, Boolean(result.security), () => ({
    label: "Bot status",
    value: (
      <div className="value-stack">
        <span>
          {result.security?.isBot ? "Bot detected" : "Human user"}
        </span>
        <StatusBadge tone={result.security?.isBot ? "warning" : "success"}>
          {result.security?.isBot ? "Suspicious" : "Normal"}
        </StatusBadge>
      </div>
    ),
    tone: result.security?.isBot ? "warning" : "success",
  }));
  pushIf(items, Boolean(result.security?.botProbability), {
    label: "Bot likelihood",
    value: result.security?.botProbability || "Unknown",
  });
  pushIf(items, Boolean(result.security?.suspiciousHeaders?.length), () => ({
    label: "Suspicious basliklar",
    value: (
      <TokenList items={result.security?.suspiciousHeaders || []} tone="warning" />
    ),
    full: true,
    tone: "warning",
  }));
  pushIf(items, Boolean(result.details?.privacyLevel), {
    label: "Privacy level",
    value: result.details?.privacyLevel || "Unknown",
  });
  pushIf(items, Boolean(result.details?.dataRetention), {
    label: "Data retention",
    value: result.details?.dataRetention || "Unknown",
  });
  pushIf(items, Boolean(result.details?.recommendations?.length), () => ({
    label: "Recommendations",
    value: <TokenList items={result.details?.recommendations || []} />,
    full: true,
  }));

  return items;
}

function buildSuccessPrimarySections(result: LocationData): DetailSection[] {
  if (isWebsiteResult(result)) {
    return buildWebsitePrimarySections(result);
  }

  const sections: DetailSection[] = [];
  const coordinates = getCoordinates(result);

  const locationItems: DetailItem[] = [
    {
      label: "IP address",
      value: result.ip,
      mono: true,
    },
  ];

  pushIf(
    locationItems,
    Boolean(result.requestedIp && result.requestedIp !== result.ip),
    {
      label: "Requested IP",
      value: result.requestedIp || "",
      mono: true,
    }
  );
  pushIf(locationItems, Boolean(result.ipType), {
    label: "IP type",
    value: result.ipType || "Unknown",
  });
  pushIf(locationItems, Boolean(result.country || result.countryName), {
    label: "Country",
    value:
      result.countryName && result.country
        ? `${result.countryName} (${result.country})`
        : result.countryName || result.country || "Unknown",
  });
  pushIf(locationItems, Boolean(result.city || result.region), {
    label: "City / region",
    value: [result.city, result.region].filter(Boolean).join(" / "),
  });
  pushIf(locationItems, Boolean(result.timezone || result.location?.timezone?.name), {
    label: "Timezone",
    value: result.timezone || result.location?.timezone?.name || "Unknown",
  });
  pushIf(locationItems, Boolean(result.location?.timezone?.currentTime), {
    label: "Local time",
    value: result.location?.timezone?.currentTime || "Unknown",
  });
  pushIf(locationItems, Boolean(coordinates), () => ({
    label: "Coordinates",
    value: `${coordinates?.latitude.toFixed(4)}, ${coordinates?.longitude.toFixed(4)}`,
    detail: (
      <a
        href={`https://www.google.com/maps?q=${coordinates?.latitude},${coordinates?.longitude}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-link"
      >
        Open on map
      </a>
    ),
  }));
  pushIf(locationItems, Boolean(result.location?.accuracy || result.location?.confidence), {
    label: "Accuracy",
    value:
      [result.location?.accuracy, result.location?.confidence]
        .filter(Boolean)
        .join(" / ") || "Unknown",
  });

  sections.push({
    eyebrow: "Location",
    title: "Location summary",
    description: "Start with location, time, and accuracy for the first interpretation.",
    items: locationItems,
    note: buildTextNote([
      result.isLocal
        ? "Location data may be limited for local or private network addresses."
        : undefined,
      result.location?.dataSource ? `Source: ${result.location.dataSource}` : undefined,
      result.location?.diagnosis || undefined,
      result.location?.lastUpdated
        ? `Last updated: ${formatDateTime(result.location.lastUpdated)}`
        : undefined,
    ]),
  });

  const networkItems: DetailItem[] = [];
  pushIf(networkItems, Boolean(getNetworkLine(result)), {
    label: "Provider",
    value: getNetworkLine(result),
    detail:
      result.isp?.organization &&
      result.isp?.isp &&
      result.isp.organization !== result.isp.isp
        ? result.isp.isp
        : undefined,
  });
  pushIf(networkItems, Boolean(result.isp?.asn), {
    label: "ASN",
    value: result.isp?.asn || "Unknown",
    detail: result.isp?.asnName || undefined,
    mono: true,
  });
  pushIf(networkItems, Boolean(result.ipRange?.start && result.ipRange?.end), {
    label: "Network range",
    value: `${result.ipRange?.start} - ${result.ipRange?.end}`,
    mono: true,
    full: true,
  });
  pushIf(networkItems, typeof result.ipRange?.total === "number", {
    label: "Total IPs",
    value: `${numberFormatter.format(result.ipRange?.total || 0)} IP`,
  });
  pushIf(networkItems, typeof result.ipRange?.total === "number", {
    label: "Network size",
    value: formatNetworkScale(result.ipRange?.total || 0),
  });
  pushIf(networkItems, typeof result.isp?.mobile === "boolean", {
    label: "Mobile connection",
    value: (
      <div className="value-stack">
        <span>{result.isp?.mobile ? "Yes" : "No"}</span>
        <StatusBadge tone={result.isp?.mobile ? "success" : "neutral"}>
          {result.isp?.mobile ? "Mobile" : "Fixed"}
        </StatusBadge>
      </div>
    ),
    tone: result.isp?.mobile ? "success" : "neutral",
  });
  pushIf(networkItems, typeof result.isp?.proxy === "boolean", {
    label: "Proxy usage",
    value: (
      <div className="value-stack">
        <span>{result.isp?.proxy ? "Detected" : "Not detected"}</span>
        <StatusBadge tone={result.isp?.proxy ? "warning" : "success"}>
          {result.isp?.proxy ? "Caution" : "Clean"}
        </StatusBadge>
      </div>
    ),
    tone: result.isp?.proxy ? "warning" : "success",
  });
  pushIf(networkItems, typeof result.isp?.hosting === "boolean", {
    label: "Hosting provider",
    value: (
      <div className="value-stack">
        <span>{result.isp?.hosting ? "Yes" : "No"}</span>
        <StatusBadge tone={result.isp?.hosting ? "warning" : "neutral"}>
          {result.isp?.hosting ? "Server" : "Client"}
        </StatusBadge>
      </div>
    ),
    tone: result.isp?.hosting ? "warning" : "neutral",
  });
  pushIf(networkItems, Boolean(result.isp?.zipCode), {
    label: "Postal code",
    value: result.isp?.zipCode || "Unknown",
  });

  if (networkItems.length > 0) {
    sections.push({
      eyebrow: "Network",
      title: "Network and provider",
      description: "Read provider, range, and routing signals in this block.",
      items: networkItems,
      note: buildTextNote([
        result.details?.provider ? `Data provider: ${result.details.provider}` : undefined,
        result.details?.totalIpsInRange || undefined,
      ]),
    });
  }

  const securityItems = buildSecurityItems(result);

  if (securityItems.length > 0) {
    sections.push({
      eyebrow: "Security",
      title: "Risk and security",
      description: "Risk level, bot signals, and privacy notes are collected here.",
      items: securityItems,
      note: buildTextNote([
        result.details?.note || undefined,
        result.details?.reason || undefined,
        result.details?.explanation || undefined,
      ]),
    });
  }

  return sections;
}

function buildErrorPrimarySections(result: LocationData): DetailSection[] {
  if (isWebsiteResult(result)) {
    return buildWebsitePrimarySections(result);
  }

  const sections: DetailSection[] = [];

  const statusItems: DetailItem[] = [
    {
      label: "Address status",
      value: result.isLocal ? "Local or private network" : "No exact GeoIP match",
      tone: "warning",
    },
  ];

  pushIf(statusItems, Boolean(result.ip), {
    label: "IP address",
    value: result.ip,
    mono: true,
  });
  pushIf(statusItems, Boolean(result.requestedIp && result.requestedIp !== result.ip), {
    label: "Requested IP",
    value: result.requestedIp || "",
    mono: true,
  });
  pushIf(statusItems, Boolean(result.ipType), {
    label: "IP type",
    value: result.ipType || "Unknown",
  });
  pushIf(statusItems, Boolean(result.error), {
    label: "Error message",
    value: result.error || "No details",
    full: true,
  });
  pushIf(statusItems, Boolean(result.details?.reason), {
    label: "Reason",
    value: result.details?.reason || "Unknown",
    full: true,
  });
  pushIf(statusItems, Boolean(result.details?.explanation), {
    label: "Explanation",
    value: result.details?.explanation || "Unknown",
    full: true,
  });
  pushIf(statusItems, Boolean(result.details?.recommendations?.length), () => ({
    label: "Recommended actions",
    value: <TokenList items={result.details?.recommendations || []} />,
    full: true,
  }));

  sections.push({
    eyebrow: "Status",
    title: "Why is there no exact match?",
    description: "Even if location data is missing, the available status information is separated here.",
    items: statusItems,
    note: buildTextNote([
      result.isLocal
        ? "Local or private network addresses may not exist in public GeoIP databases."
        : undefined,
    ]),
  });

  const securityItems = buildSecurityItems(result);

  if (securityItems.length > 0) {
    sections.push({
      eyebrow: "Security",
      title: "Still-readable risk signals",
      description: "Risk, bot, and privacy signals can still be read even when location data is unavailable.",
      items: securityItems,
      note: buildTextNote([result.details?.note || undefined]),
    });
  }

  const environmentItems: DetailItem[] = [];
  pushIf(environmentItems, Boolean(result.device?.browser.fullName), {
    label: "Browser",
    value: result.device?.browser.fullName || "Unknown",
  });
  pushIf(environmentItems, Boolean(result.device?.os.fullName), {
    label: "Operating system",
    value: result.device?.os.fullName || "Unknown",
  });
  pushIf(environmentItems, Boolean(result.device?.device.type), {
    label: "Device",
    value:
      result.device?.device.fullName !== "Unknown"
        ? result.device?.device.fullName
        : result.device?.device.type || "Unknown",
    detail: result.device?.device.vendor || result.device?.device.model || undefined,
  });
  pushIf(environmentItems, Boolean(result.device?.cpu.architecture), {
    label: "CPU architecture",
    value: result.device?.cpu.architecture || "Unknown",
  });

  if (environmentItems.length > 0) {
    sections.push({
      eyebrow: "Client",
      title: "Available client signals",
      description: "Device and browser signals are still available for interpretation.",
      items: environmentItems,
    });
  }

  return sections;
}

function buildDeviceSection(result: LocationData): DetailSection | null {
  const items: DetailItem[] = [];

  pushIf(items, Boolean(result.device?.browser.fullName), {
    label: "Browser",
    value: result.device?.browser.fullName || "Unknown",
    detail: result.device?.browser.major
      ? `Major version: ${result.device.browser.major}`
      : undefined,
  });
  pushIf(items, Boolean(result.device?.os.fullName), {
    label: "Operating system",
    value: result.device?.os.fullName || "Unknown",
  });
  pushIf(items, Boolean(result.device?.device.type), {
    label: "Device",
    value:
      result.device?.device.fullName !== "Unknown"
        ? result.device?.device.fullName
        : result.device?.device.type || "Unknown",
    detail: result.device?.device.vendor || result.device?.device.model || undefined,
  });
  pushIf(items, Boolean(result.device?.engine.fullName), {
    label: "Rendering engine",
    value: result.device?.engine.fullName || "Unknown",
  });
  pushIf(items, Boolean(result.device?.cpu.architecture), {
    label: "CPU architecture",
    value: result.device?.cpu.architecture || "Unknown",
  });
  pushIf(items, Boolean(result.device?.screen.screenResolution), {
    label: "Screen resolution",
    value: result.device?.screen.screenResolution || "Unknown",
  });
  pushIf(items, Boolean(result.device?.screen.availableResolution), {
    label: "Available space",
    value: result.device?.screen.availableResolution || "Unknown",
  });
  pushIf(items, Boolean(result.device?.screen.colorDepth), {
    label: "Color depth",
    value: result.device?.screen.colorDepth || "Unknown",
  });
  pushIf(items, Boolean(result.device?.screen.devicePixelRatio), {
    label: "Pixel ratio",
    value: result.device?.screen.devicePixelRatio || "Unknown",
  });
  pushIf(items, typeof result.device?.capabilities.javascript === "boolean", {
    label: "JavaScript",
    value: (
      <div className="value-stack">
        <span>{result.device?.capabilities.javascript ? "Enabled" : "Inactive"}</span>
        <StatusBadge
          tone={result.device?.capabilities.javascript ? "success" : "warning"}
        >
          {result.device?.capabilities.javascript ? "Running" : "Off"}
        </StatusBadge>
      </div>
    ),
    tone: result.device?.capabilities.javascript ? "success" : "warning",
  });
  pushIf(items, Boolean(result.device?.capabilities.cookies), {
    label: "Cookies",
    value: result.device?.capabilities.cookies || "Unknown",
  });
  pushIf(items, Boolean(result.device?.capabilities.localStorage), {
    label: "LocalStorage",
    value: result.device?.capabilities.localStorage || "Unknown",
  });
  pushIf(items, Boolean(result.device?.capabilities.sessionStorage), {
    label: "SessionStorage",
    value: result.device?.capabilities.sessionStorage || "Unknown",
  });
  pushIf(items, Boolean(result.device?.capabilities.webGL), {
    label: "WebGL",
    value: result.device?.capabilities.webGL || "Unknown",
  });
  pushIf(items, Boolean(result.device?.capabilities.canvas), {
    label: "Canvas",
    value: result.device?.capabilities.canvas || "Unknown",
  });

  if (items.length === 0) {
    return null;
  }

  return {
    eyebrow: "Client",
    title: "Device and browser",
    description: "Hardware, screen, and browser capabilities open only when needed.",
    items,
  };
}

function buildConnectionSection(result: LocationData): DetailSection | null {
  const items: DetailItem[] = [];

  pushIf(items, Boolean(result.connection?.protocol), {
    label: "Protocol",
    value: `${result.connection?.protocol.toUpperCase()} / HTTP ${result.connection?.httpVersion}`,
  });
  pushIf(items, Boolean(result.connection?.language), {
    label: "Language preferences",
    value: result.connection?.language || "Unknown",
  });
  pushIf(items, Boolean(result.connection?.encoding), {
    label: "Compression",
    value: result.connection?.encoding || "Unknown",
  });
  pushIf(items, Boolean(result.connection?.connection), {
    label: "Connection type",
    value: result.connection?.connection || "Unknown",
  });
  pushIf(items, Boolean(result.connection?.cacheControl), {
    label: "Cache-Control",
    value: result.connection?.cacheControl || "Unknown",
  });
  pushIf(items, Boolean(result.connection?.doNotTrack), {
    label: "Do Not Track",
    value: result.connection?.doNotTrack || "Unknown",
  });
  pushIf(items, Boolean(result.connection?.httpsUpgrade), {
    label: "HTTPS upgrade",
    value: result.connection?.httpsUpgrade || "Unknown",
  });
  pushIf(items, Boolean(result.connection?.securityHeaders.strictTransportSecurity), {
    label: "Strict-Transport-Security",
    value: result.connection?.securityHeaders.strictTransportSecurity || "Missing",
    mono: true,
  });
  pushIf(items, Boolean(result.connection?.securityHeaders.contentSecurityPolicy), {
    label: "Content-Security-Policy",
    value: result.connection?.securityHeaders.contentSecurityPolicy || "Missing",
    full: true,
    mono: true,
  });
  pushIf(items, Boolean(result.connection?.securityHeaders.xFrameOptions), {
    label: "X-Frame-Options",
    value: result.connection?.securityHeaders.xFrameOptions || "Missing",
  });
  pushIf(items, Boolean(result.connection?.securityHeaders.xContentTypeOptions), {
    label: "X-Content-Type-Options",
    value: result.connection?.securityHeaders.xContentTypeOptions || "Missing",
  });
  pushIf(items, Boolean(result.connection?.securityHeaders.referrerPolicy), {
    label: "Referrer-Policy",
    value: result.connection?.securityHeaders.referrerPolicy || "Missing",
  });
  pushIf(items, Boolean(result.connection?.performanceHints.saveData), {
    label: "Save-Data",
    value: result.connection?.performanceHints.saveData || "Unknown",
  });
  pushIf(items, Boolean(result.connection?.performanceHints.effectiveType), {
    label: "Effective connection",
    value: result.connection?.performanceHints.effectiveType || "Unknown",
  });
  pushIf(items, Boolean(result.connection?.performanceHints.downlink), {
    label: "Downlink",
    value: result.connection?.performanceHints.downlink || "Unknown",
  });
  pushIf(items, Boolean(result.connection?.performanceHints.rtt), {
    label: "RTT",
    value: result.connection?.performanceHints.rtt || "Unknown",
  });
  pushIf(items, Boolean(result.connection?.clientHints.viewportWidth), {
    label: "Viewport width",
    value: result.connection?.clientHints.viewportWidth || "Unknown",
  });
  pushIf(items, Boolean(result.connection?.clientHints.deviceMemory), {
    label: "Device memory",
    value: result.connection?.clientHints.deviceMemory || "Unknown",
  });
  pushIf(items, Boolean(result.connection?.clientHints.dpr), {
    label: "DPR",
    value: result.connection?.clientHints.dpr || "Unknown",
  });

  if (items.length === 0) {
    return null;
  }

  return {
    eyebrow: "Connection",
    title: "Connection details",
    description: "HTTP and client hint details stay collapsed by default.",
    items,
  };
}

function buildObservabilitySection(result: LocationData): DetailSection | null {
  const items: DetailItem[] = [];

  pushIf(items, Boolean(result.network?.responseTime), {
    label: "API response time",
    value: result.network?.responseTime || "Unknown",
  });
  pushIf(items, typeof result.network?.requestSize === "number", {
    label: "Request size",
    value: formatBytes(result.network?.requestSize),
  });
  pushIf(items, Boolean(result.network?.timestamp.formatted), {
    label: "Server time",
    value: result.network?.timestamp.formatted || "Unknown",
  });
  pushIf(items, Boolean(result.network?.serverTime.timezone), {
    label: "Server timezone",
    value: result.network?.serverTime.timezone || "Unknown",
    detail:
      typeof result.network?.serverTime.offset === "number"
        ? `Offset: ${formatOffset(result.network.serverTime.offset)}`
        : undefined,
  });
  pushIf(items, typeof result.network?.timestamp.unix === "number", {
    label: "Unix timestamp",
    value: String(result.network?.timestamp.unix),
    mono: true,
  });
  pushIf(items, Boolean(result.network?.timestamp.iso), {
    label: "ISO timestamp",
    value: result.network?.timestamp.iso || "Unknown",
    mono: true,
  });
  pushIf(items, Boolean(result.analytics?.pageLoadTime), {
    label: "Page load time",
    value: result.analytics?.pageLoadTime || "Unknown",
  });
  pushIf(items, typeof result.analytics?.browserSupport.es6 === "boolean", {
    label: "ES6 support",
    value: result.analytics?.browserSupport.es6
      ? "Supported"
      : "Not supported",
    tone: result.analytics?.browserSupport.es6 ? "success" : "warning",
  });
  pushIf(items, Boolean(result.analytics?.browserSupport.webGL), {
    label: "WebGL support",
    value: result.analytics?.browserSupport.webGL || "Unknown",
  });
  pushIf(items, Boolean(result.analytics?.browserSupport.touchSupport), {
    label: "Touch support",
    value: result.analytics?.browserSupport.touchSupport || "Unknown",
  });
  pushIf(items, Boolean(result.analytics?.browserSupport.orientation), {
    label: "Screen orientation",
    value: result.analytics?.browserSupport.orientation || "Unknown",
  });
  pushIf(items, Boolean(result.analytics?.geoAccuracy), {
    label: "Geo accuracy",
    value: result.analytics?.geoAccuracy || "Unknown",
  });
  pushIf(items, Boolean(result.analytics?.dataFreshness), {
    label: "Data freshness",
    value: result.analytics?.dataFreshness || "Unknown",
  });
  pushIf(items, Boolean(result.analytics?.totalRequestTime), {
    label: "Total request time",
    value: result.analytics?.totalRequestTime || "Unknown",
  });

  if (items.length === 0) {
    return null;
  }

  return {
    eyebrow: "Performance",
    title: "Technical telemetry",
    description: "Server time and performance signals live in a dedicated panel.",
    items,
  };
}

function buildIdentitySection(result: LocationData): DetailSection | null {
  const items: DetailItem[] = [];

  pushIf(items, Boolean(result.requestInfo?.timestamp), {
    label: "Request time",
    value: formatDateTime(result.requestInfo?.timestamp),
  });
  pushIf(items, Boolean(result.requestInfo?.method), {
    label: "HTTP method",
    value: (
      <div className="value-stack">
        <span>{result.requestInfo?.method}</span>
        <StatusBadge tone="neutral">{result.requestInfo?.method}</StatusBadge>
      </div>
    ),
    mono: true,
  });
  pushIf(items, Boolean(result.requestInfo?.url), {
    label: "URL",
    value: result.requestInfo?.url || "Unknown",
    mono: true,
    full: true,
  });
  pushIf(items, Boolean(result.requestInfo?.userAgent), {
    label: "User-Agent",
    value: result.requestInfo?.userAgent || "Unknown",
    mono: true,
    full: true,
  });
  pushIf(items, Boolean(result.requestInfo?.headers?.host), {
    label: "Host",
    value: result.requestInfo?.headers?.host || "Unknown",
  });
  pushIf(items, Boolean(result.requestInfo?.headers?.accept), {
    label: "Accept header",
    value: result.requestInfo?.headers?.accept || "Unknown",
    mono: true,
    full: true,
  });
  pushIf(items, Boolean(result.requestInfo?.headers?.contentType), {
    label: "Content-Type",
    value: result.requestInfo?.headers?.contentType || "Unknown",
  });
  pushIf(items, Boolean(result.requestInfo?.headers?.requestId), {
    label: "Request ID",
    value: result.requestInfo?.headers?.requestId || "Unknown",
    mono: true,
    full: true,
  });

  if (items.length === 0) {
    return null;
  }

  return {
    eyebrow: "Request",
    title: "Request context",
    description: "Only low-risk request metadata is kept for troubleshooting.",
    items,
  };
}

function buildWarningsSection(result: LocationData): DetailSection | null {
  if (!result.warnings?.length) {
    return null;
  }

  return {
    eyebrow: "Warnings",
    title: "Probe warnings",
    description:
      "These warnings did not stop the lookup, but they did affect fallback or enrichment behavior.",
    items: [
      {
        label: "Warnings",
        value: <TokenList items={result.warnings} tone="warning" />,
        full: true,
      },
    ],
  };
}

function buildAdvancedSections(result: LocationData): DetailSection[] {
  if (isWebsiteResult(result)) {
    return [buildWarningsSection(result), ...buildWebsiteAdvancedSections(result)].filter(
      (section): section is DetailSection => section !== null
    );
  }

  return [
    buildWarningsSection(result),
    buildDeviceSection(result),
    buildConnectionSection(result),
    buildObservabilitySection(result),
    buildIdentitySection(result),
  ].filter((section): section is DetailSection => section !== null);
}

export function LookupResults({ result }: { result: LocationData }) {
  const isErrorResult = Boolean(result.error);
  const websiteResult = isWebsiteResult(result);
  const summary = isErrorResult
    ? buildErrorSummary(result)
    : buildSuccessSummary(result);
  const primarySections = isErrorResult
    ? buildErrorPrimarySections(result)
    : buildSuccessPrimarySections(result);
  const advancedSections = buildAdvancedSections(result);
  const badges = buildSharedBadges(result);
  const coordinates = getCoordinates(result);
  const hasMap =
    !isErrorResult &&
    typeof coordinates?.latitude === "number" &&
    typeof coordinates?.longitude === "number";

  return (
    <div className="results-stack">
      <div className="results-header">
        <div className="title-stack">
          <span className="eyebrow">
            {isErrorResult
              ? websiteResult
                ? "Limited website response"
                : "Limited response"
              : websiteResult
              ? "Website analysis"
              : "Analysis summary"}
          </span>
          <h2 className="results-title">
            {isErrorResult
              ? websiteResult
                ? "Could not retrieve a complete technical response for the website"
                : "A complete GeoIP match was not found for this address"
              : websiteResult
              ? "Website analysis completed"
              : "IP analysis completed"}
          </h2>
          <p className="results-description">
            {isErrorResult
              ? websiteResult
                ? result.error ||
                  "One of the DNS, HTTP, or TLS steps returned incomplete data; the remaining signals are broken down below."
                : result.isLocal
                ? "Public GeoIP data may be unavailable for local or private network addresses. The readable signals are still broken down below."
                : result.error ||
                  "There is no exact match, but the interpretable signals are still grouped below."
              : websiteResult
              ? "The first four cards summarize the final URL, transport layer, risk, and resolved IPs. Then open the DNS, HTTP, TLS, and check blocks."
              : "The first four cards are optimized for a quick read. For more context, continue with the location, network, and security blocks."}
          </p>
        </div>

        <div className="results-aside">
          {badges.length > 0 ? (
            <div className="badge-row">
              {badges.map((badge) => (
                <StatusBadge
                  key={`${badge.label}-${badge.tone ?? "neutral"}`}
                  tone={badge.tone}
                >
                  {badge.label}
                </StatusBadge>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="summary-grid">
        {summary.map((metric) => (
          <SummaryCard key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="sections-stack sections-stack-primary">
        {hasMap ? (
          <LocationMapPanel
            latitude={coordinates!.latitude}
            longitude={coordinates!.longitude}
            label={buildLocationLabel(result)}
            timezone={result.timezone || undefined}
            accuracy={result.location?.accuracy}
            isLocal={result.isLocal}
          />
        ) : null}

        {primarySections.map((section) => (
          <DetailSectionCard key={section.title} section={section} />
        ))}
      </div>

      {advancedSections.length > 0 ? (
        <section className="panel advanced-panel">
          <div className="panel-header">
            <div className="title-stack">
              <span className="eyebrow">Advanced details</span>
              <h2 className="panel-title">
                {websiteResult ? "Detailed website panels" : "Technical panels"}
              </h2>
            </div>
            <p className="panel-description">
              {websiteResult
                ? "HTTP headers, TLS, resolved IP summaries, and the rule-based checklist stay collapsed by default."
                : "These panels stay collapsed by default. Open device, connection, performance, and request context details only when needed."}
            </p>
          </div>

          <div className="disclosure-stack">
            {advancedSections.map((section) => (
              <DisclosureSectionCard key={section.title} section={section} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

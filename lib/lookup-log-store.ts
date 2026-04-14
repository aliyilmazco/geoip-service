import crypto from "node:crypto";
import { isIP } from "node:net";

import { logEvent } from "@/lib/logger";
import type { LookupResult } from "@/lib/lookup-types";
import type { LookupExecutionContext } from "@/lib/request-utils";
import { ensureLookupStorageSchema, isLookupLoggingEnabled } from "@/lib/turso";

export type LookupRouteKind = "query" | "path";

export interface LookupLogRecord {
  id: string;
  createdAt: string;
  requestId: string;
  requesterIp: string;
  routeKind: LookupRouteKind;
  rawTarget: string;
  normalizedTarget: string;
  lookupType: string;
  resolvedIp: string | null;
  httpStatus: number;
  resultStatus: string;
  errorCode: string | null;
  responseJson: string;
  country: string | null;
  countryName: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
  ispName: string | null;
  organization: string | null;
  asn: string | null;
}

export interface LookupInventoryRecord {
  ip: string;
  updatedAt: string;
  lastRequesterIp: string;
  lastTarget: string;
  lookupType: string;
  country: string | null;
  countryName: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
  ispName: string | null;
  organization: string | null;
  asn: string | null;
  responseJson: string;
  relatedResolvedIpsJson: string;
  lastLogId: string;
}

export interface LookupPersistenceRecord {
  log: LookupLogRecord;
  inventory: LookupInventoryRecord | null;
}

type LookupPersistenceWriter = (record: LookupPersistenceRecord) => Promise<void>;

export interface PersistLookupObservationInput {
  context: LookupExecutionContext;
  routeKind: LookupRouteKind;
  rawTarget: string;
  httpStatus: number;
  responseBody: LookupResult;
}

type InventorySource = {
  summary: Record<string, unknown>;
  relatedResolvedIps: string[];
  source: "top-level" | "website.resolvedIps";
  websiteContext?: Record<string, unknown>;
};

let testWriter: LookupPersistenceWriter | null = null;

export function setLookupPersistenceWriterForTests(
  writer: LookupPersistenceWriter | null
) {
  testWriter = writer;
}

export async function persistLookupObservation(
  input: PersistLookupObservationInput
) {
  const writer = resolveLookupPersistenceWriter();

  if (!writer) {
    return;
  }

  const record = buildLookupPersistenceRecord(input);

  try {
    await writer(record);
  } catch (error) {
    logEvent("error", "lookup.persistence_failed", {
      requestId: input.context.requestId,
      rawTarget: input.rawTarget,
      routeKind: input.routeKind,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function resolveLookupPersistenceWriter() {
  if (testWriter) {
    return testWriter;
  }

  if (!isLookupLoggingEnabled()) {
    return null;
  }

  return writeLookupRecordToTurso;
}

function buildLookupPersistenceRecord(
  input: PersistLookupObservationInput
): LookupPersistenceRecord {
  const normalizedBody = asRecord(input.responseBody);
  const details = asRecord(normalizedBody.details);
  const isp = asRecord(normalizedBody.isp);
  const normalizedTarget =
    readNonEmptyString(normalizedBody.normalizedTarget) ||
    readNonEmptyString(normalizedBody.query) ||
    input.rawTarget.trim();
  const resolvedIp = readResolvedIp(normalizedBody);

  const log: LookupLogRecord = {
    id: crypto.randomUUID(),
    createdAt: input.context.timestamp,
    requestId: input.context.requestId,
    requesterIp: input.context.clientIp,
    routeKind: input.routeKind,
    rawTarget: input.rawTarget,
    normalizedTarget,
    lookupType: readNonEmptyString(normalizedBody.lookupType) || "unknown",
    resolvedIp,
    httpStatus: input.httpStatus,
    resultStatus:
      readNonEmptyString(normalizedBody.status) ||
      (input.httpStatus >= 400 ? "error" : "ok"),
    errorCode:
      readNonEmptyString(details.code) ||
      readNonEmptyString(normalizedBody.errorCode),
    responseJson: JSON.stringify(input.responseBody),
    country: readNonEmptyString(normalizedBody.country),
    countryName: readNonEmptyString(normalizedBody.countryName),
    region: readNonEmptyString(normalizedBody.region),
    city: readNonEmptyString(normalizedBody.city),
    timezone: readNonEmptyString(normalizedBody.timezone),
    ispName: readNonEmptyString(isp.isp),
    organization: readNonEmptyString(isp.organization),
    asn: readNonEmptyString(isp.asn),
  };

  return {
    log,
    inventory: buildLookupInventoryRecord(input, log, normalizedBody),
  };
}

function buildLookupInventoryRecord(
  input: PersistLookupObservationInput,
  log: LookupLogRecord,
  body: Record<string, unknown>
): LookupInventoryRecord | null {
  if (!log.resolvedIp || isIP(log.resolvedIp) === 0) {
    return null;
  }

  const inventorySource = findInventorySource(body, log.resolvedIp);
  const summary = inventorySource.summary;
  const isp = asRecord(summary.isp);
  const responsePayload = {
    ip: log.resolvedIp,
    lookupType: log.lookupType,
    routeKind: input.routeKind,
    sourceTarget: input.rawTarget,
    normalizedTarget: log.normalizedTarget,
    requestId: log.requestId,
    observedAt: log.createdAt,
    status: log.resultStatus,
    httpStatus: log.httpStatus,
    primary: true,
    relatedResolvedIps: inventorySource.relatedResolvedIps,
    source: inventorySource.source,
    ipType: readNonEmptyString(summary.ipType) || readNonEmptyString(body.ipType),
    country: readNonEmptyString(summary.country) || log.country,
    countryName: readNonEmptyString(summary.countryName) || log.countryName,
    region: readNonEmptyString(summary.region) || log.region,
    city: readNonEmptyString(summary.city) || log.city,
    timezone: readNonEmptyString(summary.timezone) || log.timezone,
    coordinates: readObject(summary.coordinates),
    isp: Object.keys(isp).length > 0 ? isp : null,
    location: readObject(summary.location),
    websiteContext: inventorySource.websiteContext || null,
  };

  return {
    ip: log.resolvedIp,
    updatedAt: log.createdAt,
    lastRequesterIp: log.requesterIp,
    lastTarget: log.normalizedTarget,
    lookupType: log.lookupType,
    country: readNonEmptyString(summary.country) || log.country,
    countryName: readNonEmptyString(summary.countryName) || log.countryName,
    region: readNonEmptyString(summary.region) || log.region,
    city: readNonEmptyString(summary.city) || log.city,
    timezone: readNonEmptyString(summary.timezone) || log.timezone,
    ispName: readNonEmptyString(isp.isp) || log.ispName,
    organization: readNonEmptyString(isp.organization) || log.organization,
    asn: readNonEmptyString(isp.asn) || log.asn,
    responseJson: JSON.stringify(responsePayload),
    relatedResolvedIpsJson: JSON.stringify(inventorySource.relatedResolvedIps),
    lastLogId: log.id,
  };
}

async function writeLookupRecordToTurso(record: LookupPersistenceRecord) {
  const db = await ensureLookupStorageSchema();

  if (!db) {
    return;
  }

  await db.execute({
    sql: `
      INSERT INTO lookup_logs (
        id,
        created_at,
        request_id,
        requester_ip,
        route_kind,
        raw_target,
        normalized_target,
        lookup_type,
        resolved_ip,
        http_status,
        result_status,
        error_code,
        response_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      record.log.id,
      record.log.createdAt,
      record.log.requestId,
      record.log.requesterIp,
      record.log.routeKind,
      record.log.rawTarget,
      record.log.normalizedTarget,
      record.log.lookupType,
      record.log.resolvedIp,
      record.log.httpStatus,
      record.log.resultStatus,
      record.log.errorCode,
      record.log.responseJson,
    ],
  });

  if (!record.inventory) {
    return;
  }

  await db.execute({
    sql: `
      INSERT INTO ip_inventory (
        ip,
        updated_at,
        last_requester_ip,
        last_target,
        lookup_type,
        country,
        country_name,
        region,
        city,
        timezone,
        isp_name,
        organization,
        asn,
        response_json,
        related_resolved_ips_json,
        last_log_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(ip) DO UPDATE SET
        updated_at = excluded.updated_at,
        last_requester_ip = excluded.last_requester_ip,
        last_target = excluded.last_target,
        lookup_type = excluded.lookup_type,
        country = excluded.country,
        country_name = excluded.country_name,
        region = excluded.region,
        city = excluded.city,
        timezone = excluded.timezone,
        isp_name = excluded.isp_name,
        organization = excluded.organization,
        asn = excluded.asn,
        response_json = excluded.response_json,
        related_resolved_ips_json = excluded.related_resolved_ips_json,
        last_log_id = excluded.last_log_id
    `,
    args: [
      record.inventory.ip,
      record.inventory.updatedAt,
      record.inventory.lastRequesterIp,
      record.inventory.lastTarget,
      record.inventory.lookupType,
      record.inventory.country,
      record.inventory.countryName,
      record.inventory.region,
      record.inventory.city,
      record.inventory.timezone,
      record.inventory.ispName,
      record.inventory.organization,
      record.inventory.asn,
      record.inventory.responseJson,
      record.inventory.relatedResolvedIpsJson,
      record.inventory.lastLogId,
    ],
  });
}

function findInventorySource(
  body: Record<string, unknown>,
  resolvedIp: string
): InventorySource {
  const website = asRecord(body.website);
  const resolvedIps = readResolvedIpSummaries(website.resolvedIps);
  const matchingSummary =
    resolvedIps.find((entry) => readNonEmptyString(entry.ip) === resolvedIp) || null;

  if (matchingSummary) {
    return {
      summary: matchingSummary,
      relatedResolvedIps: dedupeStrings(
        resolvedIps.map((entry) => readNonEmptyString(entry.ip))
      ),
      source: "website.resolvedIps",
      websiteContext: buildWebsiteContext(website),
    };
  }

  return {
    summary: body,
    relatedResolvedIps: [resolvedIp],
    source: "top-level",
  };
}

function buildWebsiteContext(website: Record<string, unknown>) {
  return {
    url: readNonEmptyString(website.url),
    hostname: readNonEmptyString(website.hostname),
    protocol: readNonEmptyString(website.protocol),
    http: readObject(website.http),
    summary: readObject(website.summary),
  };
}

function readResolvedIp(body: Record<string, unknown>) {
  const directIp = readNonEmptyString(body.ip);

  if (directIp && isIP(directIp) !== 0) {
    return directIp;
  }

  const requestedIp = readNonEmptyString(body.requestedIp);
  return requestedIp && isIP(requestedIp) !== 0 ? requestedIp : null;
}

function readResolvedIpSummaries(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asRecord(entry))
    .filter((entry) => Boolean(readNonEmptyString(entry.ip)));
}

function dedupeStrings(values: Array<string | null>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
  );
}

function readNonEmptyString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function readObject(value: unknown) {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

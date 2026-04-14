import { createClient, type Client } from "@libsql/client";

import { runtimeConfig } from "@/lib/runtime-config";

let client: Client | null = null;
let schemaReady: Promise<void> | null = null;

export function isLookupLoggingEnabled() {
  return runtimeConfig.lookupLogging.enabled;
}

function getRequiredLookupLoggingConfig() {
  if (!runtimeConfig.lookupLogging.enabled) {
    return null;
  }

  const { databaseUrl, authToken } = runtimeConfig.lookupLogging;

  if (!databaseUrl || !authToken) {
    throw new Error(
      "Turso lookup logging is enabled but TURSO_DATABASE_URL or TURSO_AUTH_TOKEN is missing."
    );
  }

  return {
    databaseUrl,
    authToken,
  };
}

export function getTursoClient() {
  const config = getRequiredLookupLoggingConfig();

  if (!config) {
    return null;
  }

  if (!client) {
    client = createClient({
      url: config.databaseUrl,
      authToken: config.authToken,
    });
  }

  return client;
}

export async function ensureLookupStorageSchema() {
  const db = getTursoClient();

  if (!db) {
    return null;
  }

  if (!schemaReady) {
    schemaReady = initializeLookupStorageSchema(db).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }

  await schemaReady;
  return db;
}

async function initializeLookupStorageSchema(db: Client) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS lookup_logs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      request_id TEXT NOT NULL,
      requester_ip TEXT NOT NULL,
      route_kind TEXT NOT NULL,
      raw_target TEXT NOT NULL,
      normalized_target TEXT,
      lookup_type TEXT NOT NULL,
      resolved_ip TEXT,
      http_status INTEGER NOT NULL,
      result_status TEXT NOT NULL,
      error_code TEXT,
      response_json TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_lookup_logs_created_at
    ON lookup_logs (created_at)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_lookup_logs_requester_ip
    ON lookup_logs (requester_ip)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_lookup_logs_normalized_target
    ON lookup_logs (normalized_target)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_lookup_logs_resolved_ip
    ON lookup_logs (resolved_ip)
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS ip_inventory (
      ip TEXT PRIMARY KEY,
      updated_at TEXT NOT NULL,
      last_requester_ip TEXT NOT NULL,
      last_target TEXT NOT NULL,
      lookup_type TEXT NOT NULL,
      country TEXT,
      country_name TEXT,
      region TEXT,
      city TEXT,
      timezone TEXT,
      isp_name TEXT,
      organization TEXT,
      asn TEXT,
      response_json TEXT NOT NULL,
      related_resolved_ips_json TEXT NOT NULL DEFAULT '[]',
      last_log_id TEXT NOT NULL
    )
  `);

  await ensureTableColumn(
    db,
    "ip_inventory",
    "related_resolved_ips_json",
    "TEXT NOT NULL DEFAULT '[]'"
  );

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_ip_inventory_updated_at
    ON ip_inventory (updated_at)
  `);
}

async function ensureTableColumn(
  db: Client,
  tableName: string,
  columnName: string,
  columnDefinition: string
) {
  const result = await db.execute(`PRAGMA table_info(${tableName})`);
  const columnExists = result.rows.some((row) => {
    const name = (row as Record<string, unknown>).name;
    return typeof name === "string" && name === columnName;
  });

  if (columnExists) {
    return;
  }

  await db.execute(
    `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`
  );
}

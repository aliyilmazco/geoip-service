import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import { logEvent } from "@/lib/logger";

let geoipModule: any = null;
let isInitialized = false;
let initializationError: Error | null = null;
let hasWarnedAboutFallback = false;
const require = createRequire(import.meta.url);

const GEOIP_DATA_FILES = [
  "geoip-city.dat",
  "geoip-city6.dat",
  "geoip-city-names.dat",
  "geoip-country.dat",
  "geoip-country6.dat",
] as const;

export type GeoIPRuntimeStatus = {
  status: "ready" | "unavailable";
  reason?: "data_files_missing" | "module_load_failed" | "lookup_failed";
  dataDirectory: string | null;
  checkedPaths: string[];
  missingFiles: string[];
  modulePath: string | null;
  message?: string;
  lastLookupError?: string | null;
};

type ResolveGeoIPDataDirectoryOptions = {
  cwd?: string;
  envPath?: string | null;
  legacyEnvPath?: string | null;
  pathExists?: (candidatePath: string) => boolean;
};

let geoipRuntimeStatus: GeoIPRuntimeStatus = {
  status: "unavailable",
  reason: "data_files_missing",
  dataDirectory: null,
  checkedPaths: [],
  missingFiles: [...GEOIP_DATA_FILES],
  modulePath: null,
  message: "GeoIP has not been initialized yet.",
  lastLookupError: null,
};

export interface GeoIPResult {
  country?: string;
  region?: string;
  eu?: string;
  timezone?: string;
  city?: string;
  ll?: [number, number];
  metro?: number;
  area?: number;
  range?: [number, number];
}

function normalizeCandidatePath(candidatePath: string, cwd: string) {
  if (!candidatePath.trim()) {
    return "";
  }

  return path.isAbsolute(candidatePath)
    ? path.normalize(candidatePath)
    : path.resolve(cwd, candidatePath);
}

function inspectGeoIPDataDirectory(
  directory: string,
  pathExists: (candidatePath: string) => boolean
) {
  const fileState = Object.fromEntries(
    GEOIP_DATA_FILES.map((fileName) => [
      fileName,
      pathExists(path.join(directory, fileName)),
    ])
  ) as Record<(typeof GEOIP_DATA_FILES)[number], boolean>;

  const hasIpv4Dataset = fileState["geoip-city.dat"] || fileState["geoip-country.dat"];
  const hasIpv6Dataset = fileState["geoip-city6.dat"] || fileState["geoip-country6.dat"];
  const missingFiles = GEOIP_DATA_FILES.filter((fileName) => !fileState[fileName]);

  return {
    usable: hasIpv4Dataset && hasIpv6Dataset,
    missingFiles,
  };
}

export function resolveGeoIPDataDirectory(
  options: ResolveGeoIPDataDirectoryOptions = {}
) {
  const cwd = options.cwd || process.cwd();
  const pathExists = options.pathExists || fs.existsSync;
  const checkedPaths = Array.from(
    new Set(
      [
        normalizeCandidatePath(
          options.envPath ?? process.env.GEOIP_DATA_PATH ?? "",
          cwd
        ),
        normalizeCandidatePath(
          options.legacyEnvPath ?? process.env.GEODATADIR ?? "",
          cwd
        ),
        path.resolve(cwd, "node_modules/geoip-lite/data"),
        path.resolve(cwd, "public/data"),
        path.resolve(cwd, ".next/server/data"),
        path.resolve(cwd, ".next-dev/server/data"),
      ].filter(Boolean)
    )
  );

  let bestMissingFiles = [...GEOIP_DATA_FILES];

  for (const candidatePath of checkedPaths) {
    const inspection = inspectGeoIPDataDirectory(candidatePath, pathExists);

    if (inspection.usable) {
      return {
        dataDirectory: candidatePath,
        checkedPaths,
        missingFiles: inspection.missingFiles,
      };
    }

    if (inspection.missingFiles.length < bestMissingFiles.length) {
      bestMissingFiles = inspection.missingFiles;
    }
  }

  return {
    dataDirectory: null,
    checkedPaths,
    missingFiles: bestMissingFiles,
  };
}

function initializeGeoIP() {
  if (isInitialized) return;

  const dataDirectoryResolution = resolveGeoIPDataDirectory();
  let modulePath: string | null = null;

  if (!dataDirectoryResolution.dataDirectory) {
    initializationError = new Error(
      "GeoIP data files were not found in any known runtime directory."
    );
    geoipRuntimeStatus = {
      status: "unavailable",
      reason: "data_files_missing",
      dataDirectory: null,
      checkedPaths: dataDirectoryResolution.checkedPaths,
      missingFiles: dataDirectoryResolution.missingFiles,
      modulePath,
      message: initializationError.message,
      lastLookupError: null,
    };
    logEvent("warn", "geoip.init_failed", {
      message: initializationError.message,
      checkedPaths: dataDirectoryResolution.checkedPaths,
      missingFiles: dataDirectoryResolution.missingFiles,
    });
    isInitialized = true;
    return;
  }

  try {
    (globalThis as typeof globalThis & { geodatadir?: string }).geodatadir =
      dataDirectoryResolution.dataDirectory;
    modulePath = require.resolve("geoip-lite");
    geoipModule = require("geoip-lite");
    initializationError = null;
    geoipRuntimeStatus = {
      status: "ready",
      dataDirectory: dataDirectoryResolution.dataDirectory,
      checkedPaths: dataDirectoryResolution.checkedPaths,
      missingFiles: dataDirectoryResolution.missingFiles,
      modulePath,
      lastLookupError: null,
    };
  } catch (error) {
    initializationError =
      error instanceof Error ? error : new Error(String(error));
    geoipModule = null;
    geoipRuntimeStatus = {
      status: "unavailable",
      reason: "module_load_failed",
      dataDirectory: dataDirectoryResolution.dataDirectory,
      checkedPaths: dataDirectoryResolution.checkedPaths,
      missingFiles: dataDirectoryResolution.missingFiles,
      modulePath,
      message: initializationError.message,
      lastLookupError: null,
    };
    logEvent("warn", "geoip.init_failed", {
      message: initializationError.message,
      dataDirectory: dataDirectoryResolution.dataDirectory,
      modulePath,
      checkedPaths: dataDirectoryResolution.checkedPaths,
      missingFiles: dataDirectoryResolution.missingFiles,
    });
  }
  isInitialized = true;
}

export function getGeoIPRuntimeStatus(): GeoIPRuntimeStatus {
  initializeGeoIP();
  return { ...geoipRuntimeStatus };
}

export function lookupIP(ip: string): GeoIPResult | null {
  initializeGeoIP();

  if (!geoipModule) {
    if (!hasWarnedAboutFallback) {
      const reason = initializationError
        ? ` Initialization error: ${initializationError.message}`
        : "";

      logEvent("warn", "geoip.unavailable", {
        message:
          "GeoIP-lite unavailable; API will continue without local GeoIP data and return null for local database lookups.",
        reason,
        dataDirectory: geoipRuntimeStatus.dataDirectory,
        checkedPaths: geoipRuntimeStatus.checkedPaths,
        missingFiles: geoipRuntimeStatus.missingFiles,
        modulePath: geoipRuntimeStatus.modulePath,
      });
      hasWarnedAboutFallback = true;
    }

    return null;
  }

  try {
    const result = geoipModule.lookup(ip);
    geoipRuntimeStatus = {
      ...geoipRuntimeStatus,
      status: "ready",
      reason: undefined,
      message: undefined,
      lastLookupError: null,
    };
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    geoipRuntimeStatus = {
      ...geoipRuntimeStatus,
      reason: "lookup_failed",
      message,
      lastLookupError: message,
    };
    logEvent("warn", "geoip.lookup_failed", {
      ip,
      message,
      dataDirectory: geoipRuntimeStatus.dataDirectory,
    });
    return null;
  }
}

import assert from "node:assert/strict";
import test from "node:test";

import { resolveGeoIPDataDirectory, type GeoIPRuntimeStatus } from "../lib/geoip-safe";
import {
  buildLocationAnalysis,
  buildLocationDiagnosis,
  buildResolvedIpSummary,
  getLocationDataSourceLabel,
} from "../lib/ip-analysis";
import type { IspInfo } from "../lib/lookup-types";

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

test("resolveGeoIPDataDirectory prefers an explicit usable data path", () => {
  const result = resolveGeoIPDataDirectory({
    cwd: "/repo",
    envPath: "./custom-geoip",
    legacyEnvPath: null,
    pathExists: (candidatePath) => candidatePath.startsWith("/repo/custom-geoip/"),
  });

  assert.equal(result.dataDirectory, "/repo/custom-geoip");
});

test("resolveGeoIPDataDirectory reports missing data when no runtime path is usable", () => {
  const result = resolveGeoIPDataDirectory({
    cwd: "/repo",
    envPath: null,
    legacyEnvPath: null,
    pathExists: () => false,
  });

  assert.equal(result.dataDirectory, null);
  assert.ok(result.checkedPaths.includes("/repo/node_modules/geoip-lite/data"));
  assert.ok(result.checkedPaths.includes("/repo/public/data"));
  assert.ok(result.missingFiles.includes("geoip-city.dat"));
  assert.ok(result.missingFiles.includes("geoip-country6.dat"));
});

test("buildLocationAnalysis marks missing geographic data as unavailable", () => {
  const location = buildLocationAnalysis(
    null,
    "GeoIP unavailable",
    new Date("2026-01-15T12:00:00.000Z"),
    "GeoIP database files were not available at runtime. Optional ISP enrichment is disabled."
  );

  assert.equal(location.accuracy, "Unavailable");
  assert.equal(location.confidence, "No geographic match");
  assert.equal(
    location.diagnosis,
    "GeoIP database files were not available at runtime. Optional ISP enrichment is disabled."
  );
  assert.equal(location.coordinates, null);
  assert.equal(location.timezone, null);
});

test("buildLocationDiagnosis explains runtime GeoIP failures", () => {
  const geoipStatus: GeoIPRuntimeStatus = {
    status: "unavailable",
    reason: "data_files_missing",
    dataDirectory: null,
    checkedPaths: ["/repo/node_modules/geoip-lite/data", "/repo/public/data"],
    missingFiles: ["geoip-city.dat", "geoip-city6.dat"],
    modulePath: null,
    message: "GeoIP data files were not found in any known runtime directory.",
    lastLookupError: null,
  };

  const diagnosis = buildLocationDiagnosis(
    null,
    buildUnknownIspInfo(),
    geoipStatus
  );
  const dataSource = getLocationDataSourceLabel(
    null,
    buildUnknownIspInfo(),
    geoipStatus
  );

  assert.match(diagnosis || "", /GeoIP database files were not available at runtime\./);
  assert.match(diagnosis || "", /Optional ISP enrichment is disabled\./);
  assert.equal(dataSource, "GeoIP unavailable");
});

test("buildResolvedIpSummary keeps public GeoIP data for known website IPs", async () => {
  const summary = await buildResolvedIpSummary("188.114.97.7");

  assert.equal(summary.country, "NL");
  assert.equal(summary.countryName, "Netherlands");
  assert.equal(summary.city, "Amsterdam");
  assert.equal(summary.timezone, "Europe/Amsterdam");
  assert.equal(summary.location?.dataSource, "geoip-lite");
  assert.equal(summary.location?.diagnosis, undefined);
  assert.deepEqual(summary.coordinates, {
    latitude: 52.3759,
    longitude: 4.8975,
  });
});

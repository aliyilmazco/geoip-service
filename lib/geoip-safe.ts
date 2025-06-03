let geoipModule: any = null;
let isInitialized = false;

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

function initializeGeoIP() {
  if (isInitialized) return;

  try {
    geoipModule = require("geoip-lite");
    console.log("GeoIP-lite initialized successfully");
  } catch (error) {
    console.warn("GeoIP-lite failed to initialize:", error);
    geoipModule = null;
  }
  isInitialized = true;
}

export function lookupIP(ip: string): GeoIPResult | null {
  initializeGeoIP();

  if (!geoipModule) {
    console.warn("GeoIP database not available, returning null");
    return null;
  }

  try {
    return geoipModule.lookup(ip);
  } catch (error) {
    console.warn("GeoIP lookup failed:", error);
    return null;
  }
}

export function isGeoIPAvailable(): boolean {
  initializeGeoIP();
  return geoipModule !== null;
}

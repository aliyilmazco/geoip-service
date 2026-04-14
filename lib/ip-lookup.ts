import { NextRequest } from "next/server";

import { lookupIP } from "@/lib/geoip-safe";
import {
  buildBrowserSupport,
  buildLocationDiagnosis,
  buildLocationAnalysis,
  buildLocationDataFromSources,
  calculateIpRange,
  getConnectionInfo,
  getCountryName,
  getLocationDataSourceLabel,
  getDeviceInfo,
  getIpType,
  getIspInfo,
  getNetworkMetrics,
  getSecurityAnalysis,
  isPrivateIp,
  stripLocationDataFromIsp,
} from "@/lib/ip-analysis";
import { logEvent } from "@/lib/logger";
import { buildLookupBase, buildLookupError } from "@/lib/lookup-response";
import { isValidIp } from "@/lib/lookup-target";
import type { LookupResult } from "@/lib/lookup-types";
import {
  buildRequestInfo,
  createLookupExecutionContext,
  getClientIp,
  type LookupExecutionContext,
} from "@/lib/request-utils";

type AnalysisResponse = {
  status: number;
  body: LookupResult;
};

type IpLocationSnapshot = {
  coordinates:
    | {
        latitude: number;
        longitude: number;
      }
    | null;
  country: string | null;
  countryName: string;
  geo: ReturnType<typeof lookupIP>;
  ipRange: ReturnType<typeof calculateIpRange> | null;
  ispInfo: Awaited<ReturnType<typeof getIspInfo>>;
  locationAnalysis: ReturnType<typeof buildLocationAnalysis>;
  locationData: ReturnType<typeof buildLocationDataFromSources>;
  locationDiagnosis: ReturnType<typeof buildLocationDiagnosis>;
  region: string | null;
  timezone: string | null;
  city: string | null;
};

async function buildIpLocationSnapshot(ip: string): Promise<IpLocationSnapshot> {
  const [ispInfo] = await Promise.all([getIspInfo(ip)]);
  const geo = lookupIP(ip);
  const locationData = buildLocationDataFromSources(geo, ispInfo);
  const locationDiagnosis = buildLocationDiagnosis(geo, ispInfo);
  const ipRange = geo?.range ? calculateIpRange(geo.range) : null;
  const locationAnalysis = buildLocationAnalysis(
    locationData,
    getLocationDataSourceLabel(geo, ispInfo),
    new Date(),
    locationDiagnosis
  );

  return {
    geo,
    ispInfo,
    locationData,
    locationDiagnosis,
    ipRange,
    locationAnalysis,
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
  };
}

function buildIpLocationError(
  context: LookupExecutionContext,
  query: string,
  ip: string,
  message: string,
  snapshot?: Pick<IpLocationSnapshot, "ispInfo" | "locationAnalysis">
) {
  const response = buildLookupError({
    context,
    lookupType: "ip",
    query,
    ip,
    error: message,
    details: {
      code: "IP_LOCATION_UNAVAILABLE",
      reason: getIpType(ip).includes("Private")
        ? "Private network IP address"
        : "No location data available",
      explanation:
        snapshot?.locationAnalysis.diagnosis ||
        "No geographic location data is available for this IP address from the configured providers.",
      recommendations: [
        "Verify the IP address format",
        "Use a public IP address when geographic data is required",
        "Retry later if upstream enrichment is temporarily unavailable",
      ],
      note: snapshot?.locationAnalysis.diagnosis,
      retryable: !isPrivateIp(ip),
    },
  });

  return {
    ...response,
    isp: snapshot ? stripLocationDataFromIsp(snapshot.ispInfo) : undefined,
    location: snapshot?.locationAnalysis,
  };
}

export async function analyzeCurrentIpRequest(
  request: NextRequest,
  context: LookupExecutionContext = createLookupExecutionContext(request)
): Promise<AnalysisResponse> {
  const startedAt = Date.now();
  const ip = getClientIp(request);

  try {
    const [snapshot, deviceInfo, connectionInfo, securityInfo] = await Promise.all([
        buildIpLocationSnapshot(ip),
        Promise.resolve(getDeviceInfo(context.userAgent)),
        Promise.resolve(getConnectionInfo(request)),
        Promise.resolve(getSecurityAnalysis(request, ip)),
      ]);

    const networkMetrics = {
      ...getNetworkMetrics(request),
      responseTime: `${Date.now() - startedAt}ms`,
    };

    if (!snapshot.geo && !snapshot.ispInfo.locationData) {
      return {
        status: 200,
        body: {
          ...buildIpLocationError(
            context,
            ip,
            ip,
            "Location data was not found (likely a local IP)",
            snapshot
          ),
          partialData: {
            device: deviceInfo,
            connection: connectionInfo,
            security: securityInfo,
            timestamp: context.timestamp,
          },
        },
      };
    }

    return {
      status: 200,
      body: {
        ...buildLookupBase({
          context,
          lookupType: "ip",
          query: ip,
          ip,
        }),
        ipType: getIpType(ip),
        country: snapshot.country,
        countryName: snapshot.countryName,
        city: snapshot.city,
        region: snapshot.region,
        timezone: snapshot.timezone,
        coordinates: snapshot.coordinates,
        range: snapshot.geo?.range || null,
        ipRange: snapshot.ipRange,
        device: deviceInfo,
        connection: connectionInfo,
        security: securityInfo,
        network: networkMetrics,
        isp: stripLocationDataFromIsp(snapshot.ispInfo),
        location: snapshot.locationAnalysis,
        requestInfo: buildRequestInfo(request, context),
        analytics: {
          pageLoadTime: networkMetrics.responseTime,
          browserSupport: buildBrowserSupport(deviceInfo),
          geoAccuracy: snapshot.locationAnalysis.accuracy,
          dataFreshness: "Real time",
          totalRequestTime: networkMetrics.responseTime,
        },
        details: {
          accuracy: snapshot.locationAnalysis.accuracy,
          provider: "geoip-lite + optional ISP enrichment",
          lastUpdate: "Continuously updated",
          note:
            snapshot.locationDiagnosis ||
            "Geographic location is an approximate estimate based on ISP location data.",
          totalIpsInRange: snapshot.ipRange
            ? `There are ${snapshot.ipRange.total.toLocaleString("en-US")} IP addresses in this range.`
            : "IP range information is unavailable",
          privacyLevel: securityInfo.riskLevel,
          dataRetention:
            "Current IP lookups are processed in real time and are not written to lookup storage.",
          recommendations: [
            securityInfo.riskScore > 50
              ? "Security risk detected; proceed with caution"
              : "Security posture looks normal",
            snapshot.ispInfo.proxy ? "Proxy usage detected" : "Direct connection",
            snapshot.ispInfo.mobile
              ? "Mobile connection detected"
              : "Fixed-line connection",
          ],
        },
      },
    };
  } catch (error) {
    logEvent("error", "lookup.current_ip_failed", {
      requestId: context.requestId,
      ip,
      message: error instanceof Error ? error.message : String(error),
    });

    const deviceInfo = getDeviceInfo(context.userAgent);
    const connectionInfo = getConnectionInfo(request);
    const securityInfo = getSecurityAnalysis(request, ip);

    return {
      status: 500,
      body: buildLookupError({
        context,
        lookupType: "ip",
        query: ip,
        ip,
        error: "Server error",
        details: {
          code: "LOOKUP_FAILED",
          reason: "Unexpected server error",
          explanation: "The lookup could not be completed safely.",
          recommendations: [
            "Retry the request",
            "Inspect server logs using the request ID if the failure continues",
          ],
          retryable: true,
        },
        partialData: {
          device: deviceInfo,
          connection: connectionInfo,
          security: securityInfo,
          timestamp: context.timestamp,
        },
      }),
    };
  }
}

export async function analyzeIpTarget(
  request: NextRequest,
  ip: string,
  context: LookupExecutionContext = createLookupExecutionContext(request)
): Promise<AnalysisResponse> {
  if (!isValidIp(ip)) {
    return {
      status: 400,
      body: buildLookupError({
        context,
        lookupType: "ip",
        query: ip,
        ip,
        error: "Invalid IP address format",
        details: {
          code: "INVALID_IP",
          reason: "Invalid IP format",
          explanation: "Enter a valid IPv4 or IPv6 address.",
          recommendations: [
            "Use a value such as 8.8.8.8 for IPv4",
            "Use a value such as 2001:4860:4860::8888 for IPv6",
          ],
        },
      }),
    };
  }

  try {
    const [snapshot, deviceInfo] = await Promise.all([
      buildIpLocationSnapshot(ip),
      Promise.resolve(getDeviceInfo(context.userAgent)),
    ]);

    if (!snapshot.geo && !snapshot.ispInfo.locationData) {
      return {
        status: 200,
        body: {
          ...buildIpLocationError(
            context,
            ip,
            ip,
            "Location data was not found",
            snapshot
          ),
          partialData: {
            device: deviceInfo,
            timestamp: context.timestamp,
          },
        },
      };
    }

    return {
      status: 200,
      body: {
        ...buildLookupBase({
          context,
          lookupType: "ip",
          query: ip,
          ip,
        }),
        requestedIp: ip,
        ipType: getIpType(ip),
        country: snapshot.country,
        countryName: snapshot.countryName,
        city: snapshot.city,
        region: snapshot.region,
        timezone: snapshot.timezone,
        coordinates: snapshot.coordinates,
        range: snapshot.geo?.range || null,
        ipRange: snapshot.ipRange,
        device: deviceInfo,
        isp: stripLocationDataFromIsp(snapshot.ispInfo),
        location: snapshot.locationAnalysis,
        requestInfo: buildRequestInfo(request, context),
        analytics: {
          geoAccuracy: snapshot.locationAnalysis.accuracy,
          dataFreshness: "Real time",
          browserSupport: buildBrowserSupport(deviceInfo),
        },
        details: {
          accuracy: snapshot.locationAnalysis.accuracy,
          provider: "geoip-lite + optional ISP enrichment",
          lastUpdate: "Continuously updated",
          note:
            snapshot.locationDiagnosis ||
            "Geographic location is an approximate estimate based on ISP location data.",
          totalIpsInRange: snapshot.ipRange
            ? `There are ${snapshot.ipRange.total.toLocaleString("en-US")} IP addresses in this range.`
            : "IP range information is unavailable",
          dataRetention:
            "Target IP lookups can be retained in Turso-backed lookup storage when logging is enabled.",
          recommendations: [
            snapshot.ispInfo.proxy ? "Proxy usage detected" : "Direct connection",
            snapshot.ispInfo.mobile ? "Mobile connection detected" : "Fixed-line connection",
            snapshot.ispInfo.hosting
              ? "Hosting provider IP detected"
              : "Typical end-user IP",
          ],
        },
      },
    };
  } catch (error) {
    logEvent("error", "lookup.ip_target_failed", {
      requestId: context.requestId,
      ip,
      message: error instanceof Error ? error.message : String(error),
    });

    return {
      status: 500,
      body: buildLookupError({
        context,
        lookupType: "ip",
        query: ip,
        ip,
        error: "Server error",
        details: {
          code: "LOOKUP_FAILED",
          reason: "Unexpected server error",
          explanation: "The lookup could not be completed safely.",
          recommendations: [
            "Retry the request",
            "Inspect server logs using the request ID if the failure continues",
          ],
          retryable: true,
        },
      }),
    };
  }
}

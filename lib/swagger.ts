import swaggerJSDoc from "swagger-jsdoc";

import { getOpenApiServers, runtimeConfig } from "@/lib/runtime-config";

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "GeoIP Service API",
      version: "1.1.0",
      description:
        "Public API for IP lookups and website probes. Responses carry a stable request ID, typed error details, rate-limit metadata, and live DNS/HTTP/TLS analysis for public website targets.",
      contact: {
        name: "GeoIP Service Support",
        email: runtimeConfig.supportEmail,
        url: "https://github.com/aliyilmazco/geoip-service/issues",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: getOpenApiServers(),
    tags: [
      {
        name: "Unified Lookup",
        description:
          "Lookup endpoints that auto-detect whether the target should be handled as an IP lookup or a website probe.",
      },
    ],
    components: {
      schemas: {
        RateLimitInfo: {
          type: "object",
          properties: {
            scope: { type: "string", example: "lookup.current" },
            limit: { type: "integer", example: 20 },
            remaining: { type: "integer", example: 19 },
            resetAt: { type: "string", format: "date-time" },
            retryAfterSeconds: { type: "integer", example: 60 },
          },
        },
        LookupErrorDetails: {
          type: "object",
          required: ["code", "reason", "explanation"],
          properties: {
            code: { type: "string", example: "TARGET_NOT_ALLOWED" },
            reason: { type: "string", example: "Blocked resolved address" },
            explanation: {
              type: "string",
              example:
                "The hostname resolved to a private or otherwise non-public address.",
            },
            recommendations: {
              type: "array",
              items: { type: "string" },
            },
            retryable: { type: "boolean" },
            retryAfterSeconds: { type: "integer" },
            rateLimit: {
              allOf: [{ $ref: "#/components/schemas/RateLimitInfo" }],
            },
          },
        },
        LocationAnalysis: {
          type: "object",
          properties: {
            accuracy: { type: "string", example: "City-level (±5-50 km)" },
            confidence: { type: "string", example: "Medium-High" },
            dataSource: { type: "string", example: "geoip-lite" },
            lastUpdated: { type: "string", example: "Within the last 30 days" },
            diagnosis: {
              type: "string",
              nullable: true,
              example:
                "GeoIP database files were not available at runtime. Optional ISP enrichment is disabled.",
            },
            coordinates: {
              type: "object",
              nullable: true,
              properties: {
                latitude: { type: "number" },
                longitude: { type: "number" },
                precision: { type: "string" },
                format: { type: "string" },
              },
            },
            timezone: {
              type: "object",
              nullable: true,
              properties: {
                name: { type: "string" },
                offset: { type: "number" },
                isDST: { type: "boolean" },
                currentTime: { type: "string" },
              },
            },
          },
        },
        LookupBase: {
          type: "object",
          required: ["lookupType", "query", "ip"],
          properties: {
            status: { type: "string", enum: ["ok", "error"] },
            lookupType: { type: "string", enum: ["ip", "website"] },
            query: { type: "string" },
            normalizedTarget: { type: "string" },
            requestId: { type: "string", example: "2f7f16bc-0f86-4cf6-9091-d285e8d06f9a" },
            timestamp: { type: "string", format: "date-time" },
            warnings: {
              type: "array",
              items: { type: "string" },
            },
            ip: { type: "string", example: "8.8.8.8" },
            rateLimit: {
              $ref: "#/components/schemas/RateLimitInfo",
            },
          },
        },
        LookupErrorResponse: {
          allOf: [
            { $ref: "#/components/schemas/LookupBase" },
            {
              type: "object",
              required: ["status", "error", "details"],
              properties: {
                status: { type: "string", enum: ["error"] },
                error: { type: "string", example: "Rate limit exceeded" },
                details: {
                  $ref: "#/components/schemas/LookupErrorDetails",
                },
              },
            },
          ],
        },
        IpLookupResponse: {
          allOf: [
            { $ref: "#/components/schemas/LookupBase" },
            {
              type: "object",
              required: ["status", "lookupType"],
              properties: {
                status: { type: "string", enum: ["ok"] },
                lookupType: { type: "string", enum: ["ip"] },
                requestedIp: { type: "string" },
                ipType: { type: "string", example: "Public IPv4" },
                country: { type: "string", nullable: true },
                countryName: { type: "string", nullable: true },
                city: { type: "string", nullable: true },
                region: { type: "string", nullable: true },
                timezone: { type: "string", nullable: true },
                coordinates: {
                  type: "object",
                  nullable: true,
                  properties: {
                    latitude: { type: "number" },
                    longitude: { type: "number" },
                  },
                },
                details: {
                  type: "object",
                  properties: {
                    provider: { type: "string" },
                    note: { type: "string" },
                    recommendations: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                },
                location: {
                  $ref: "#/components/schemas/LocationAnalysis",
                },
              },
            },
          ],
        },
        WebsiteCheck: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            status: { type: "string", enum: ["pass", "warn", "fail", "info"] },
            severity: { type: "string", enum: ["low", "medium", "high"] },
            message: { type: "string" },
            recommendation: { type: "string" },
          },
        },
        WebsiteLookupResponse: {
          allOf: [
            { $ref: "#/components/schemas/LookupBase" },
            {
              type: "object",
              required: ["status", "lookupType"],
              properties: {
                status: { type: "string", enum: ["ok"] },
                lookupType: { type: "string", enum: ["website"] },
                website: {
                  type: "object",
                  properties: {
                    url: { type: "string" },
                    hostname: { type: "string" },
                    protocol: { type: "string", example: "https" },
                    checks: {
                      type: "array",
                      items: { $ref: "#/components/schemas/WebsiteCheck" },
                    },
                  },
                },
                security: {
                  type: "object",
                  properties: {
                    riskScore: { type: "number" },
                    riskLevel: { type: "string" },
                    suspiciousHeaders: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                },
                location: {
                  $ref: "#/components/schemas/LocationAnalysis",
                },
              },
            },
          ],
        },
      },
    },
  },
  apis: ["./app/api/**/*.ts"],
};

export const swaggerSpec = swaggerJSDoc(options);

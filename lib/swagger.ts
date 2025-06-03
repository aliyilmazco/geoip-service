import swaggerJSDoc from "swagger-jsdoc";

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "GeoIP Service API",
      version: "1.0.0",
      description: `
# GeoIP Service API

A comprehensive geolocation and IP analysis service built with Next.js 15. This API provides detailed information about IP addresses including geographic location, ISP details, device information, security analysis, and much more.

## Features

- 🌍 **Geographic Location**: Country, region, city, latitude/longitude
- 🏢 **ISP Information**: Internet Service Provider, organization, ASN details
- 📱 **Device Analysis**: Browser, operating system, device type detection
- 🔒 **Security Analysis**: Bot detection, risk scoring, threat assessment
- 📊 **Session Tracking**: Request counting, session duration, activity monitoring
- 🌐 **Network Metrics**: Response times, request analysis, server information
- 🔍 **Digital Fingerprinting**: Unique visitor identification
- 📈 **Analytics**: Comprehensive visitor analytics and insights

## Rate Limiting

- No rate limiting currently implemented
- ISP data fetching has 5-second timeout
- Session data is automatically cleaned every 5 minutes

## Authentication

No authentication required for public endpoints.

## Response Format

All responses are in JSON format with consistent error handling.
      `,
      termsOfService: "https://github.com/aliyilmazco/geoip-service",
      contact: {
        name: "API Support",
        url: "https://github.com/aliyilmazco/geoip-service/issues",
        email: "support@example.com",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
      {
        url: "https://ip.aliyilmaz.co/",
        description: "Production server",
      },
    ],
    tags: [
      {
        name: "IP Lookup",
        description: "IP address geolocation and analysis endpoints",
      },
    ],
    components: {
      schemas: {
        IPLookupResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              description: "Whether the request was successful",
            },
            ip: {
              type: "string",
              description: "The analyzed IP address",
              example: "8.8.8.8",
            },
            location: {
              type: "object",
              properties: {
                country: {
                  type: "string",
                  description: "Country name",
                  example: "United States",
                },
                countryCode: {
                  type: "string",
                  description: "ISO 3166-1 alpha-2 country code",
                  example: "US",
                },
                region: {
                  type: "string",
                  description: "Region/state code",
                  example: "CA",
                },
                regionName: {
                  type: "string",
                  description: "Region/state name",
                  example: "California",
                },
                city: {
                  type: "string",
                  description: "City name",
                  example: "Mountain View",
                },
                latitude: {
                  type: "number",
                  description: "Latitude coordinate",
                  example: 37.4056,
                },
                longitude: {
                  type: "number",
                  description: "Longitude coordinate",
                  example: -122.0775,
                },
                timezone: {
                  type: "string",
                  description: "Timezone identifier",
                  example: "America/Los_Angeles",
                },
              },
            },
            isp: {
              type: "object",
              properties: {
                isp: {
                  type: "string",
                  description: "Internet Service Provider name",
                  example: "Google LLC",
                },
                organization: {
                  type: "string",
                  description: "Organization name",
                  example: "Google Public DNS",
                },
                asn: {
                  type: "string",
                  description: "Autonomous System Number",
                  example: "AS15169",
                },
                asnName: {
                  type: "string",
                  description: "ASN organization name",
                  example: "GOOGLE",
                },
                mobile: {
                  type: "boolean",
                  description: "Whether the connection is mobile",
                },
                proxy: {
                  type: "boolean",
                  description: "Whether the IP is a proxy",
                },
                hosting: {
                  type: "boolean",
                  description: "Whether the IP is from a hosting provider",
                },
                zipCode: {
                  type: "string",
                  description: "ZIP/postal code",
                  example: "94043",
                },
              },
            },
            device: {
              type: "object",
              properties: {
                userAgent: {
                  type: "string",
                  description: "Raw user agent string",
                },
                browser: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      example: "Chrome",
                    },
                    version: {
                      type: "string",
                      example: "91.0.4472.124",
                    },
                    major: {
                      type: "string",
                      example: "91",
                    },
                  },
                },
                os: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      example: "Windows",
                    },
                    version: {
                      type: "string",
                      example: "10",
                    },
                  },
                },
                device: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      example: "desktop",
                    },
                    model: {
                      type: "string",
                      example: "Desktop Computer",
                    },
                    vendor: {
                      type: "string",
                      example: "Generic",
                    },
                  },
                },
                cpu: {
                  type: "object",
                  properties: {
                    architecture: {
                      type: "string",
                      example: "amd64",
                    },
                  },
                },
              },
            },
            security: {
              type: "object",
              properties: {
                isBot: {
                  type: "boolean",
                  description: "Whether the request appears to be from a bot",
                },
                riskScore: {
                  type: "number",
                  description: "Risk score from 0-100",
                  example: 15,
                },
                riskLevel: {
                  type: "string",
                  enum: ["Düşük", "Orta", "Yüksek", "Kritik"],
                  description: "Risk level assessment",
                },
                suspiciousHeaders: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  description: "List of suspicious header issues",
                },
                botProbability: {
                  type: "string",
                  enum: ["Düşük", "Orta", "Yüksek"],
                  description: "Probability that the request is from a bot",
                },
              },
            },
            session: {
              type: "object",
              properties: {
                firstRequest: {
                  type: "boolean",
                  description:
                    "Whether this is the first request from this session",
                },
                requestCount: {
                  type: "number",
                  description: "Number of requests from this session",
                  example: 1,
                },
                lastActivity: {
                  type: "string",
                  format: "date-time",
                  description: "ISO timestamp of last activity",
                },
                sessionDuration: {
                  type: "string",
                  description: "Duration of the session",
                  example: "0ms",
                },
                sessionId: {
                  type: "string",
                  description: "Truncated session identifier",
                  example: "a1b2c3d4",
                },
              },
            },
            network: {
              type: "object",
              properties: {
                responseTime: {
                  type: "string",
                  description: "Response time",
                  example: "50ms",
                },
                requestSize: {
                  type: "number",
                  description: "Size of the request in bytes",
                },
                timestamp: {
                  type: "object",
                  properties: {
                    iso: {
                      type: "string",
                      format: "date-time",
                      description: "ISO timestamp",
                    },
                    unix: {
                      type: "number",
                      description: "Unix timestamp",
                    },
                    formatted: {
                      type: "string",
                      description: "Formatted timestamp",
                    },
                  },
                },
                serverTime: {
                  type: "object",
                  properties: {
                    timezone: {
                      type: "string",
                      description: "Server timezone",
                    },
                    offset: {
                      type: "number",
                      description: "Timezone offset in minutes",
                    },
                  },
                },
              },
            },
            fingerprint: {
              type: "object",
              properties: {
                hash: {
                  type: "string",
                  description: "MD5 hash of the fingerprint",
                },
                components: {
                  type: "object",
                  properties: {
                    userAgent: {
                      type: "string",
                      description: "User agent component",
                    },
                    acceptLanguage: {
                      type: "string",
                      description: "Accept-Language header",
                    },
                    acceptEncoding: {
                      type: "string",
                      description: "Accept-Encoding header",
                    },
                    screenResolution: {
                      type: "string",
                      description: "Estimated screen resolution",
                    },
                  },
                },
                uniqueness: {
                  type: "string",
                  enum: ["Düşük", "Orta", "Yüksek"],
                  description: "Fingerprint uniqueness level",
                },
              },
            },
            analytics: {
              type: "object",
              properties: {
                pageViews: {
                  type: "number",
                  description: "Number of page views",
                },
                visitDuration: {
                  type: "string",
                  description: "Visit duration",
                },
                referrer: {
                  type: "string",
                  description: "Referrer URL",
                },
                language: {
                  type: "string",
                  description: "Browser language",
                },
                languages: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  description: "All supported languages",
                },
                browserSupport: {
                  type: "object",
                  properties: {
                    es6: {
                      type: "boolean",
                      description: "ES6 support",
                    },
                    webgl: {
                      type: "boolean",
                      description: "WebGL support",
                    },
                    localStorage: {
                      type: "boolean",
                      description: "localStorage support",
                    },
                  },
                },
              },
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            error: {
              type: "string",
              description: "Error message",
            },
            details: {
              type: "string",
              description: "Additional error details",
            },
          },
        },
      },
    },
  },
  apis: ["./app/api/**/*.ts"],
};

export const swaggerSpec = swaggerJSDoc(options);

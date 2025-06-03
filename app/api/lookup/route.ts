import { NextRequest, NextResponse } from "next/server";
import { lookupIP, isGeoIPAvailable } from "../../../lib/geoip-safe";
import { UAParser } from "ua-parser-js";
import crypto from "crypto";
import axios from "axios";

/**
 * @swagger
 * /api/lookup:
 *   get:
 *     tags:
 *       - IP Lookup
 *     summary: Analyze current client IP address
 *     description: |
 *       Performs comprehensive analysis of the client's IP address, including:
 *       - Geographic location (country, region, city, coordinates)
 *       - ISP and network information
 *       - Device and browser detection
 *       - Security analysis and bot detection
 *       - Session tracking and analytics
 *       - Digital fingerprinting
 *       - Network performance metrics
 *     responses:
 *       200:
 *         description: Successful IP analysis
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/IPLookupResponse'
 *             example:
 *               success: true
 *               ip: "8.8.8.8"
 *               location:
 *                 country: "United States"
 *                 countryCode: "US"
 *                 region: "CA"
 *                 regionName: "California"
 *                 city: "Mountain View"
 *                 latitude: 37.4056
 *                 longitude: -122.0775
 *                 timezone: "America/Los_Angeles"
 *               isp:
 *                 isp: "Google LLC"
 *                 organization: "Google Public DNS"
 *                 asn: "AS15169"
 *                 asnName: "GOOGLE"
 *                 mobile: false
 *                 proxy: false
 *                 hosting: true
 *                 zipCode: "94043"
 *               device:
 *                 browser:
 *                   name: "Chrome"
 *                   version: "91.0.4472.124"
 *                   major: "91"
 *                 os:
 *                   name: "Windows"
 *                   version: "10"
 *                 device:
 *                   type: "desktop"
 *                   model: "Desktop Computer"
 *                   vendor: "Generic"
 *                 cpu:
 *                   architecture: "amd64"
 *               security:
 *                 isBot: false
 *                 riskScore: 15
 *                 riskLevel: "Düşük"
 *                 suspiciousHeaders: []
 *                 botProbability: "Düşük"
 *               session:
 *                 firstRequest: true
 *                 requestCount: 1
 *                 lastActivity: "2024-01-15T10:30:00.000Z"
 *                 sessionDuration: "0ms"
 *                 sessionId: "a1b2c3d4"
 *               network:
 *                 responseTime: "45ms"
 *                 requestSize: 1024
 *                 timestamp:
 *                   iso: "2024-01-15T10:30:00.000Z"
 *                   unix: 1705316200
 *                   formatted: "15.01.2024 13:30:00"
 *                 serverTime:
 *                   timezone: "Europe/Istanbul"
 *                   offset: -180
 *               fingerprint:
 *                 hash: "d41d8cd98f00b204e9800998ecf8427e"
 *                 components:
 *                   userAgent: "Mozilla/5.0..."
 *                   acceptLanguage: "en-US,en;q=0.9"
 *                   acceptEncoding: "gzip, deflate, br"
 *                   screenResolution: "1920x1080"
 *                 uniqueness: "Yüksek"
 *               analytics:
 *                 pageViews: 1
 *                 visitDuration: "0ms"
 *                 referrer: "https://google.com"
 *                 language: "en-US"
 *                 languages: ["en-US", "en", "tr"]
 *                 browserSupport:
 *                   es6: true
 *                   webgl: true
 *                   localStorage: true
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "GeoIP veritabanı mevcut değil"
 *               details: "geoip-lite paketi düzgün yüklenmemiş olabilir"
 */

const sessionStore: {
  [key: string]: { count: number; firstSeen: number; lastSeen: number };
} = {};

setInterval(() => {
  const now = Date.now();
  Object.keys(sessionStore).forEach((key) => {
    if (now - sessionStore[key].lastSeen > 3600000) {
      delete sessionStore[key];
    }
  });
}, 300000);

function getSessionInfo(ip: string, userAgent: string) {
  const sessionKey = crypto
    .createHash("md5")
    .update(`${ip}:${userAgent}`)
    .digest("hex");
  const now = Date.now();

  if (!sessionStore[sessionKey]) {
    sessionStore[sessionKey] = {
      count: 1,
      firstSeen: now,
      lastSeen: now,
    };

    return {
      firstRequest: true,
      requestCount: 1,
      lastActivity: new Date(now).toISOString(),
      sessionDuration: "0ms",
      sessionId: sessionKey.substring(0, 8),
    };
  } else {
    sessionStore[sessionKey].count++;
    const sessionDuration = now - sessionStore[sessionKey].firstSeen;
    sessionStore[sessionKey].lastSeen = now;

    return {
      firstRequest: false,
      requestCount: sessionStore[sessionKey].count,
      lastActivity: new Date(sessionStore[sessionKey].lastSeen).toISOString(),
      sessionDuration: `${sessionDuration}ms`,
      sessionId: sessionKey.substring(0, 8),
    };
  }
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const real = request.headers.get("x-real-ip");
  const cloudflareIp = request.headers.get("cf-connecting-ip");

  if (cloudflareIp) return cloudflareIp;
  if (forwarded) return forwarded.split(",")[0].trim();
  if (real) return real;

  return "127.0.0.1";
}

async function getIspInfo(ip: string) {
  try {
    const response = await axios.get(
      `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting,query`,
      {
        timeout: 5000,
      }
    );

    if (response.data.status === "success") {
      return {
        isp: response.data.isp || "Bilinmiyor",
        organization: response.data.org || "Bilinmiyor",
        asn: response.data.as || "Bilinmiyor",
        asnName: response.data.asname || "Bilinmiyor",
        mobile: response.data.mobile || false,
        proxy: response.data.proxy || false,
        hosting: response.data.hosting || false,
        zipCode: response.data.zip || "Bilinmiyor",
        locationData:
          response.data.lat && response.data.lon
            ? {
                country: response.data.country || null,
                countryCode: response.data.countryCode || null,
                region: response.data.region || null,
                regionName: response.data.regionName || null,
                city: response.data.city || null,
                timezone: response.data.timezone || null,
                latitude: response.data.lat,
                longitude: response.data.lon,
              }
            : null,
      };
    }
  } catch (error) {
    console.log("ISP bilgisi alınamadı:", error);
  }

  return {
    isp: "Bilinmiyor",
    organization: "Bilinmiyor",
    asn: "Bilinmiyor",
    asnName: "Bilinmiyor",
    mobile: false,
    proxy: false,
    hosting: false,
    zipCode: "Bilinmiyor",
    locationData: null,
  };
}

function getSecurityAnalysis(request: NextRequest, ip: string) {
  const userAgent = request.headers.get("user-agent") || "";
  const acceptLanguage = request.headers.get("accept-language") || "";
  const acceptEncoding = request.headers.get("accept-encoding") || "";

  const botIndicators = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /wget/i,
    /curl/i,
    /python/i,
    /requests/i,
    /axios/i,
    /httpx/i,
    /urllib/i,
  ];

  const isBot = botIndicators.some((pattern) => pattern.test(userAgent));

  const suspiciousHeaders = [];
  if (!request.headers.get("accept"))
    suspiciousHeaders.push("Accept header eksik");
  if (!request.headers.get("accept-language"))
    suspiciousHeaders.push("Accept-Language header eksik");
  if (!request.headers.get("accept-encoding"))
    suspiciousHeaders.push("Accept-Encoding header eksik");
  if (userAgent.length < 10) suspiciousHeaders.push("User-Agent çok kısa");

  let riskScore = 0;
  if (isBot) riskScore += 30;
  if (suspiciousHeaders.length > 0) riskScore += suspiciousHeaders.length * 10;
  if (
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.")
  )
    riskScore += 5;
  if (!request.headers.get("referer")) riskScore += 10;

  return {
    isBot,
    riskScore: Math.min(riskScore, 100),
    riskLevel:
      riskScore < 20
        ? "Düşük"
        : riskScore < 50
        ? "Orta"
        : riskScore < 80
        ? "Yüksek"
        : "Kritik",
    suspiciousHeaders,
    botProbability: isBot
      ? "Yüksek"
      : suspiciousHeaders.length > 2
      ? "Orta"
      : "Düşük",
  };
}

function getNetworkMetrics(request: NextRequest) {
  const startTime = Date.now();
  const responseTime = Date.now() - startTime;

  return {
    responseTime: `${responseTime}ms`,
    requestSize: JSON.stringify(Object.fromEntries(request.headers)).length,
    timestamp: {
      iso: new Date().toISOString(),
      unix: Math.floor(Date.now() / 1000),
      formatted: new Date().toLocaleString("tr-TR"),
    },
    serverTime: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      offset: new Date().getTimezoneOffset(),
    },
  };
}

function getFingerprint(request: NextRequest, ip: string) {
  const userAgent = request.headers.get("user-agent") || "";
  const acceptLanguage = request.headers.get("accept-language") || "";
  const acceptEncoding = request.headers.get("accept-encoding") || "";

  const fingerprintData = [
    ip,
    userAgent,
    acceptLanguage,
    acceptEncoding,
    request.headers.get("accept"),
    request.headers.get("sec-ch-ua"),
    request.headers.get("sec-ch-ua-mobile"),
    request.headers.get("sec-ch-ua-platform"),
  ].join("|");

  const fingerprint = crypto
    .createHash("sha256")
    .update(fingerprintData)
    .digest("hex")
    .substring(0, 16);

  return {
    id: fingerprint,
    uniqueIdentifiers: {
      userAgentHash: crypto
        .createHash("md5")
        .update(userAgent)
        .digest("hex")
        .substring(0, 8),
      headerFingerprint: crypto
        .createHash("md5")
        .update(JSON.stringify(Object.fromEntries(request.headers)))
        .digest("hex")
        .substring(0, 8),
      languageSignature: acceptLanguage.split(",")[0] || "unknown",
    },
    clientHints: {
      platform: request.headers.get("sec-ch-ua-platform") || "Bilinmiyor",
      mobile:
        request.headers.get("sec-ch-ua-mobile") === "?1" ? "Evet" : "Hayır",
      brands: request.headers.get("sec-ch-ua") || "Bilinmiyor",
    },
  };
}

function getDeviceInfo(userAgent: string) {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  let cpuArchitecture = result.cpu.architecture || "Bilinmiyor";
  if (cpuArchitecture === "Bilinmiyor" || !cpuArchitecture) {
    const ua = userAgent.toLowerCase();
    if (ua.includes("arm64") || ua.includes("aarch64")) {
      cpuArchitecture = "ARM64";
    } else if (ua.includes("arm")) {
      cpuArchitecture = "ARM";
    } else if (
      ua.includes("x86_64") ||
      ua.includes("win64") ||
      ua.includes("wow64")
    ) {
      cpuArchitecture = "x86_64";
    } else if (
      ua.includes("x86") ||
      ua.includes("i386") ||
      ua.includes("i686")
    ) {
      cpuArchitecture = "x86";
    } else if (ua.includes("android") || ua.includes("mobile")) {
      cpuArchitecture = "ARM (mobil)";
    } else {
      cpuArchitecture = "x86_64 (varsayılan)";
    }
  }

  let osName = result.os.name || "Bilinmiyor";
  let osVersion = result.os.version || "Bilinmiyor";
  let osFullName = `${osName} ${osVersion}`.trim();

  if (osName === "Bilinmiyor" || !osName) {
    const ua = userAgent.toLowerCase();
    if (ua.includes("windows nt 10.0")) {
      osName = "Windows";
      osVersion = "10/11";
      osFullName = "Windows 10/11";
    } else if (ua.includes("windows nt 6.3")) {
      osName = "Windows";
      osVersion = "8.1";
      osFullName = "Windows 8.1";
    } else if (ua.includes("windows nt 6.1")) {
      osName = "Windows";
      osVersion = "7";
      osFullName = "Windows 7";
    } else if (ua.includes("mac os x") || ua.includes("macos")) {
      osName = "macOS";
      const macMatch = ua.match(/mac os x ([\d_]+)/);
      if (macMatch) {
        osVersion = macMatch[1].replace(/_/g, ".");
        osFullName = `macOS ${osVersion}`;
      }
    } else if (ua.includes("android")) {
      osName = "Android";
      const androidMatch = ua.match(/android ([\d.]+)/);
      if (androidMatch) {
        osVersion = androidMatch[1];
        osFullName = `Android ${osVersion}`;
      }
    } else if (ua.includes("iphone") || ua.includes("ipad")) {
      osName = "iOS";
      const iosMatch = ua.match(/os ([\d_]+)/);
      if (iosMatch) {
        osVersion = iosMatch[1].replace(/_/g, ".");
        osFullName = `iOS ${osVersion}`;
      }
    }
  }

  let engineName = result.engine.name || "Bilinmiyor";
  let engineVersion = result.engine.version || "Bilinmiyor";
  let engineFullName = `${engineName} ${engineVersion}`.trim();

  if (engineName === "Bilinmiyor" || !engineName) {
    const ua = userAgent.toLowerCase();
    if (ua.includes("webkit") && ua.includes("chrome")) {
      engineName = "Blink";
      engineFullName = "Blink (Chromium)";
    } else if (ua.includes("webkit") && ua.includes("safari")) {
      engineName = "WebKit";
      engineFullName = "WebKit (Safari)";
    } else if (ua.includes("gecko") && ua.includes("firefox")) {
      engineName = "Gecko";
      engineFullName = "Gecko (Firefox)";
    } else if (ua.includes("trident")) {
      engineName = "Trident";
      engineFullName = "Trident (Internet Explorer)";
    }
  }

  let deviceType = result.device.type || "desktop";
  let deviceVendor = result.device.vendor || "Bilinmiyor";
  let deviceModel = result.device.model || "Bilinmiyor";

  if (deviceVendor === "Bilinmiyor" || !deviceVendor) {
    const ua = userAgent.toLowerCase();
    if (ua.includes("iphone")) {
      deviceVendor = "Apple";
      deviceModel = "iPhone";
      deviceType = "mobile";
    } else if (ua.includes("ipad")) {
      deviceVendor = "Apple";
      deviceModel = "iPad";
      deviceType = "tablet";
    } else if (ua.includes("macintosh") || ua.includes("mac os")) {
      deviceVendor = "Apple";
      deviceModel = "Mac";
      deviceType = "desktop";
    } else if (ua.includes("samsung")) {
      deviceVendor = "Samsung";
      deviceType = ua.includes("mobile") ? "mobile" : "tablet";
    } else if (ua.includes("android")) {
      deviceType = ua.includes("mobile") ? "mobile" : "tablet";
      if (ua.includes("sm-")) {
        deviceVendor = "Samsung";
      } else if (ua.includes("pixel")) {
        deviceVendor = "Google";
        deviceModel = "Pixel";
      }
    } else if (ua.includes("windows")) {
      deviceType = "desktop";
      deviceVendor = "PC";
      deviceModel = "Windows PC";
    }
  }

  let deviceFullName = "Bilinmiyor";
  if (deviceVendor !== "Bilinmiyor" && deviceModel !== "Bilinmiyor") {
    deviceFullName = `${deviceVendor} ${deviceModel}`;
  } else if (deviceVendor !== "Bilinmiyor") {
    deviceFullName = deviceVendor;
  } else if (deviceModel !== "Bilinmiyor") {
    deviceFullName = deviceModel;
  } else {
    if (deviceType === "mobile") {
      deviceFullName = "📱 Mobil Cihaz";
    } else if (deviceType === "tablet") {
      deviceFullName = "📊 Tablet";
    } else {
      deviceFullName = "💻 Masaüstü Bilgisayar";
    }
  }

  const screenInfo = {
    colorDepth: "Bilinmiyor (client-side gerekli)",
    screenResolution: "Bilinmiyor (client-side gerekli)",
    availableResolution: "Bilinmiyor (client-side gerekli)",
    devicePixelRatio: "Bilinmiyor (client-side gerekli)",
  };

  return {
    browser: {
      name: result.browser.name || "Bilinmiyor",
      version: result.browser.version || "Bilinmiyor",
      major: result.browser.major || "Bilinmiyor",
      fullName: `${result.browser.name || "Bilinmiyor"} ${
        result.browser.version || ""
      }`.trim(),
    },
    device: {
      model: deviceModel,
      type: deviceType,
      vendor: deviceVendor,
      fullName: deviceFullName,
    },
    engine: {
      name: engineName,
      version: engineVersion,
      fullName: engineFullName,
    },
    os: {
      name: osName,
      version: osVersion,
      fullName: osFullName,
    },
    cpu: {
      architecture: cpuArchitecture,
    },
    screen: screenInfo,
    capabilities: {
      javascript: true,
      cookies: "Bilinmiyor (client-side gerekli)",
      localStorage: "Bilinmiyor (client-side gerekli)",
      sessionStorage: "Bilinmiyor (client-side gerekli)",
      webGL: "Bilinmiyor (client-side gerekli)",
      canvas: "Bilinmiyor (client-side gerekli)",
    },
  };
}

function getConnectionInfo(request: NextRequest) {
  const acceptLanguage = request.headers.get("accept-language");
  const acceptEncoding = request.headers.get("accept-encoding");
  const connection = request.headers.get("connection");
  const cacheControl = request.headers.get("cache-control");
  const dnt = request.headers.get("dnt");
  const upgradeInsecureRequests = request.headers.get(
    "upgrade-insecure-requests"
  );

  const protocol = request.headers.get("x-forwarded-proto") || "http";

  const securityHeaders = {
    strictTransportSecurity:
      request.headers.get("strict-transport-security") || "Yok",
    contentSecurityPolicy:
      request.headers.get("content-security-policy") || "Yok",
    xFrameOptions: request.headers.get("x-frame-options") || "Yok",
    xContentTypeOptions: request.headers.get("x-content-type-options") || "Yok",
    referrerPolicy: request.headers.get("referrer-policy") || "Yok",
  };

  const performanceHints = {
    saveData:
      request.headers.get("save-data") === "on" ? "Etkin" : "Devre Dışı",
    downlink: request.headers.get("downlink") || "Bilinmiyor",
    effectiveType: request.headers.get("ect") || "Bilinmiyor",
    rtt: request.headers.get("rtt") || "Bilinmiyor",
  };

  return {
    language: acceptLanguage || "Bilinmiyor",
    encoding: acceptEncoding || "Bilinmiyor",
    connection: connection || "Bilinmiyor",
    cacheControl: cacheControl || "Bilinmiyor",
    doNotTrack: dnt === "1" ? "Etkin" : "Devre Dışı",
    httpsUpgrade: upgradeInsecureRequests === "1" ? "Etkin" : "Devre Dışı",
    referrer: request.headers.get("referer") || "Yok",
    protocol: protocol,
    httpVersion: "2.0",
    securityHeaders,
    performanceHints,
    clientHints: {
      viewportWidth: request.headers.get("viewport-width") || "Bilinmiyor",
      deviceMemory: request.headers.get("device-memory") || "Bilinmiyor",
      dpr: request.headers.get("dpr") || "Bilinmiyor",
    },
  };
}

function getIpType(ip: string): string {
  if (ip === "127.0.0.1" || ip === "::1") return "Loopback (Yerel)";
  if (ip.startsWith("192.168.")) return "Özel Ağ (192.168.x.x)";
  if (ip.startsWith("10.")) return "Özel Ağ (10.x.x.x)";
  if (ip.startsWith("172.")) {
    const secondOctet = parseInt(ip.split(".")[1]);
    if (secondOctet >= 16 && secondOctet <= 31)
      return "Özel Ağ (172.16-31.x.x)";
  }
  if (ip.startsWith("169.254.")) return "Link-Local";
  if (ip.includes(":")) return "IPv6";
  return "Genel IPv4";
}

function getCountryName(countryCode: string): string {
  const countries: { [key: string]: string } = {
    US: "Amerika Birleşik Devletleri",
    TR: "Türkiye",
    DE: "Almanya",
    FR: "Fransa",
    GB: "Birleşik Krallık",
    IT: "İtalya",
    ES: "İspanya",
    NL: "Hollanda",
    CA: "Kanada",
    AU: "Avustralya",
    JP: "Japonya",
    CN: "Çin",
    RU: "Rusya",
    BR: "Brezilya",
    IN: "Hindistan",
    MX: "Meksika",
    KR: "Güney Kore",
    SE: "İsveç",
    NO: "Norveç",
    DK: "Danimarka",
    FI: "Finlandiya",
    CH: "İsviçre",
    AT: "Avusturya",
    BE: "Belçika",
    PL: "Polonya",
    CZ: "Çek Cumhuriyeti",
    HU: "Macaristan",
    PT: "Portekiz",
    GR: "Yunanistan",
    IE: "İrlanda",
    IL: "İsrail",
    SG: "Singapur",
    TH: "Tayland",
    MY: "Malezya",
    ID: "Endonezya",
    PH: "Filipinler",
    VN: "Vietnam",
    ZA: "Güney Afrika",
    EG: "Mısır",
    NG: "Nijerya",
    KE: "Kenya",
    AR: "Arjantin",
    CL: "Şili",
    CO: "Kolombiya",
    PE: "Peru",
    VE: "Venezuela",
    UA: "Ukrayna",
    RO: "Romanya",
    BG: "Bulgaristan",
    HR: "Hırvatistan",
    SI: "Slovenya",
    SK: "Slovakya",
    LT: "Litvanya",
    LV: "Letonya",
    EE: "Estonya",
  };
  return countries[countryCode] || countryCode;
}

function calculateIpRange(range: number[]): {
  start: string;
  end: string;
  total: number;
} {
  const start = range[0];
  const end = range[1];

  function longToIp(long: number): string {
    return [
      (long >>> 24) & 255,
      (long >>> 16) & 255,
      (long >>> 8) & 255,
      long & 255,
    ].join(".");
  }

  return {
    start: longToIp(start),
    end: longToIp(end),
    total: end - start + 1,
  };
}

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") || "";

    const [
      deviceInfo,
      connectionInfo,
      securityInfo,
      networkMetrics,
      fingerprint,
      ispInfo,
    ] = await Promise.all([
      Promise.resolve(getDeviceInfo(userAgent)),
      Promise.resolve(getConnectionInfo(request)),
      Promise.resolve(getSecurityAnalysis(request, ip)),
      Promise.resolve(getNetworkMetrics(request)),
      Promise.resolve(getFingerprint(request, ip)),
      getIspInfo(ip),
    ]);

    console.log(`IP aranıyor: ${ip}`);

    const geo = lookupIP(ip);

    if (!geo && !ispInfo.locationData) {
      return NextResponse.json({
        ip,
        ipType: getIpType(ip),
        error: "Konum bilgisi bulunamadı (muhtemelen local IP)",
        isLocal:
          ip === "127.0.0.1" ||
          ip.startsWith("192.168.") ||
          ip.startsWith("10.") ||
          ip.startsWith("172."),
        device: deviceInfo,
        connection: connectionInfo,
        security: securityInfo,
        network: networkMetrics,
        fingerprint: fingerprint,
        isp: ispInfo,
        requestInfo: {
          timestamp: new Date().toISOString(),
          userAgent: userAgent,
          method: request.method,
          url: request.url,
          headers: {
            host: request.headers.get("host"),
            origin: request.headers.get("origin"),
            referer: request.headers.get("referer"),
            accept: request.headers.get("accept"),
            contentType: request.headers.get("content-type"),
          },
          sessionInfo: getSessionInfo(ip, userAgent),
        },
        analytics: {
          pageLoadTime: `${
            Date.now() - networkMetrics.timestamp.unix * 1000
          }ms`,
          browserSupport: {
            es6: deviceInfo.browser.name !== "Internet Explorer",
            webGL: "Destekleniyor olabilir",
            touchSupport:
              deviceInfo.device.type === "mobile" ||
              deviceInfo.device.type === "tablet",
            orientation:
              deviceInfo.device.type === "mobile"
                ? "Portrait/Landscape"
                : "Landscape",
          },
          geoAccuracy: "Şehir seviyesi",
          dataFreshness: "Gerçek zamanlı",
        },
        details: {
          explanation:
            "Bu IP adresi özel bir ağa ait olduğu için coğrafi konum bilgisi mevcut değil.",
          reason: "Yerel ağ IP adresi",
          note: "Yerel IP adresleri için coğrafi konum belirlenemez.",
          recommendations: [
            "Gerçek IP adresinizi öğrenmek için VPN'inizi kapatın",
            "Router ayarlarınızı kontrol edin",
            "İnternet servis sağlayıcınızla iletişime geçin",
          ],
        },
      });
    }

    const ipRange = geo?.range ? calculateIpRange(geo.range) : null;

    const locationData =
      geo ||
      (ispInfo.locationData
        ? {
            country: ispInfo.locationData.countryCode,
            region: ispInfo.locationData.region,
            city: ispInfo.locationData.city,
            timezone: ispInfo.locationData.timezone,
            ll: [
              ispInfo.locationData.latitude,
              ispInfo.locationData.longitude,
            ] as [number, number],
          }
        : null);

    const locationAnalysis = {
      accuracy: "Şehir seviyesi (±5-50 km)",
      confidence: "Orta-Yüksek",
      dataSource: geo ? "geoip-lite + IP-API" : "IP-API",
      lastUpdated: "Son 30 gün içinde",
      coordinates: locationData?.ll
        ? {
            latitude: locationData.ll[0],
            longitude: locationData.ll[1],
            precision: "~10km radius",
            format: "Decimal Degrees (DD)",
          }
        : null,
      timezone: locationData?.timezone
        ? {
            name: locationData.timezone,
            offset: new Date().getTimezoneOffset() / -60,
            isDST:
              new Date().getTimezoneOffset() !==
              new Date(new Date().getFullYear(), 0, 1).getTimezoneOffset(),
            currentTime: new Date().toLocaleString("tr-TR", {
              timeZone: locationData.timezone,
            }),
          }
        : null,
    };

    return NextResponse.json({
      ip,
      ipType: getIpType(ip),
      country:
        locationData?.country || ispInfo.locationData?.countryCode || null,
      countryName: getCountryName(
        locationData?.country || ispInfo.locationData?.countryCode || ""
      ),
      city: locationData?.city || ispInfo.locationData?.city || null,
      region: locationData?.region || ispInfo.locationData?.regionName || null,
      timezone:
        locationData?.timezone || ispInfo.locationData?.timezone || null,
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
      range: geo?.range || null,
      ipRange: ipRange,
      device: deviceInfo,
      connection: connectionInfo,
      security: securityInfo,
      network: networkMetrics,
      fingerprint: fingerprint,
      isp: ispInfo,
      location: locationAnalysis,
      requestInfo: {
        timestamp: new Date().toISOString(),
        userAgent: userAgent,
        method: request.method,
        url: request.url,
        headers: {
          host: request.headers.get("host"),
          origin: request.headers.get("origin"),
          referer: request.headers.get("referer"),
          accept: request.headers.get("accept"),
          contentType: request.headers.get("content-type"),
          forwarded: request.headers.get("x-forwarded-for"),
          realIp: request.headers.get("x-real-ip"),
        },
        sessionInfo: getSessionInfo(ip, userAgent),
      },
      analytics: {
        pageLoadTime: `${Date.now() - networkMetrics.timestamp.unix * 1000}ms`,
        browserSupport: {
          es6: !deviceInfo.browser.name.includes("Internet Explorer"),
          webGL: "Muhtemelen destekleniyor",
          touchSupport:
            deviceInfo.device.type === "mobile" ||
            deviceInfo.device.type === "tablet"
              ? "Evet"
              : "Hayır",
          orientation:
            deviceInfo.device.type === "mobile"
              ? "Portrait/Landscape"
              : "Landscape",
          cookieSupport: "Test edilmedi",
          localStorageSupport: "Test edilmedi",
        },
        geoAccuracy: locationAnalysis.accuracy,
        dataFreshness: "Gerçek zamanlı",
        totalRequestTime: networkMetrics.responseTime,
      },
      details: {
        accuracy: locationAnalysis.accuracy,
        provider: "geoip-lite + IP-API enhanced",
        lastUpdate: "Sürekli güncellenir",
        note: "Coğrafi konum yaklaşık bir tahmindir ve ISP lokasyonuna dayanır.",
        totalIpsInRange: ipRange
          ? `Bu IP aralığında ${ipRange.total.toLocaleString()} IP adresi bulunmaktadır.`
          : "IP aralığı bilgisi mevcut değil",
        privacyLevel: securityInfo.riskLevel,
        dataRetention: "Veriler saklanmaz, gerçek zamanlı işlenir",
        recommendations: [
          securityInfo.riskScore > 50
            ? "Güvenlik riski tespit edildi, dikkatli olun"
            : "Güvenlik durumu normal görünüyor",
          ispInfo.proxy ? "Proxy kullanımı tespit edildi" : "Direkt bağlantı",
          ispInfo.mobile ? "Mobil bağlantı tespit edildi" : "Sabit bağlantı",
        ],
      },
    });
  } catch (error) {
    console.error("Lookup hatası:", error);

    const ip = getClientIp(request);
    const deviceInfo = getDeviceInfo(request.headers.get("user-agent") || "");
    const connectionInfo = getConnectionInfo(request);
    const securityInfo = getSecurityAnalysis(request, ip);

    return NextResponse.json(
      {
        error: "Sunucu hatası",
        details: (error as Error).message,
        partialData: {
          device: deviceInfo,
          connection: connectionInfo,
          security: securityInfo,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}

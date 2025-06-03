import { NextRequest, NextResponse } from "next/server";
import { lookupIP, isGeoIPAvailable } from "../../../../lib/geoip-safe";
import { UAParser } from "ua-parser-js";
import crypto from "crypto";
import axios from "axios";

/**
 * @swagger
 * /api/lookup/{ip}:
 *   get:
 *     tags:
 *       - IP Lookup
 *     summary: Analyze specific IP address
 *     description: |
 *       Performs comprehensive analysis of a specific IP address with all the same features as the main lookup endpoint:
 *       - Geographic location (country, region, city, coordinates)
 *       - ISP and network information
 *       - Device and browser detection (from client headers)
 *       - Security analysis and bot detection
 *       - Digital fingerprinting
 *       - Network performance metrics
 *
 *       This endpoint allows you to analyze any public IP address, not just the client's IP.
 *     parameters:
 *       - in: path
 *         name: ip
 *         required: true
 *         schema:
 *           type: string
 *           format: ipv4
 *           pattern: '^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$'
 *         description: IPv4 address to analyze
 *         example: "8.8.8.8"
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
 *       400:
 *         description: Invalid IP address format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "Geçersiz IP adresi formatı"
 *               details: "Lütfen geçerli bir IPv4 adresi girin (örn: 8.8.8.8)"
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

function isValidIp(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

  if (ipv4Regex.test(ip)) {
    const parts = ip.split(".");
    return parts.every((part) => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  return ipv6Regex.test(ip);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ip: string }> }
) {
  try {
    const { ip } = await params;

    if (!isValidIp(ip)) {
      return NextResponse.json(
        {
          error: "Geçersiz IP adresi formatı",
          provided: ip,
          details: "Lütfen geçerli bir IPv4 veya IPv6 adresi girin.",
          examples: ["192.168.1.1", "8.8.8.8", "2001:db8::1"],
        },
        { status: 400 }
      );
    }

    const userAgent = request.headers.get("user-agent") || "";

    const [deviceInfo, ispInfo] = await Promise.all([
      Promise.resolve(getDeviceInfo(userAgent)),
      getIspInfo(ip),
    ]);

    console.log(`Özel IP aranıyor: ${ip}`);

    const geo = lookupIP(ip);

    if (!geo && !ispInfo.locationData) {
      return NextResponse.json({
        ip,
        requestedIp: ip,
        ipType: getIpType(ip),
        error: "Konum bilgisi bulunamadı",
        isLocal:
          ip === "127.0.0.1" ||
          ip.startsWith("192.168.") ||
          ip.startsWith("10.") ||
          ip.startsWith("172."),
        device: deviceInfo,
        isp: ispInfo,
        requestInfo: {
          timestamp: new Date().toISOString(),
          userAgent: userAgent,
          method: request.method,
          url: request.url,
        },
        details: {
          explanation: "Bu IP adresi için coğrafi konum bilgisi mevcut değil.",
          reason: getIpType(ip).includes("Özel")
            ? "Özel ağ IP adresi"
            : "Veri mevcut değil",
          note: "Bazı IP adresleri için coğrafi konum bilgisi bulunmayabilir.",
          recommendations: [
            "IP adresinin doğru yazıldığından emin olun",
            "Farklı bir IP adresi deneyin",
            "Bu IP genel erişimde olmayabilir",
          ],
        },
      });
    }

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

    const ipRange = geo?.range ? calculateIpRange(geo.range) : null;

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
      requestedIp: ip,
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
        },
      },
      analytics: {
        geoAccuracy: locationAnalysis.accuracy,
        dataFreshness: "Gerçek zamanlı",
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
      },
      details: {
        accuracy: locationAnalysis.accuracy,
        provider: "geoip-lite + IP-API enhanced",
        lastUpdate: "Sürekli güncellenir",
        note: "Coğrafi konum yaklaşık bir tahmindir ve ISP lokasyonuna dayanır.",
        totalIpsInRange: ipRange
          ? `Bu IP aralığında ${ipRange.total.toLocaleString()} IP adresi bulunmaktadır.`
          : "IP aralığı bilgisi mevcut değil",
        dataRetention: "Veriler saklanmaz, gerçek zamanlı işlenir",
        recommendations: [
          ispInfo.proxy ? "Proxy kullanımı tespit edildi" : "Direkt bağlantı",
          ispInfo.mobile ? "Mobil bağlantı tespit edildi" : "Sabit bağlantı",
          ispInfo.hosting
            ? "Hosting servisi IP'si tespit edildi"
            : "Normal kullanıcı IP'si",
        ],
      },
    });
  } catch (error) {
    console.error("Özel IP lookup hatası:", error);

    return NextResponse.json(
      {
        error: "Sunucu hatası",
        details: (error as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

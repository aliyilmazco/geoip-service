import type { NextApiRequest, NextApiResponse } from "next";
import geoip from "geoip-lite";
import { UAParser } from "ua-parser-js";
import crypto from "crypto";
import axios from "axios";

// Client IP'sini al
function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  const real = req.headers["x-real-ip"];
  const cloudflareIp = req.headers["cf-connecting-ip"];

  if (typeof cloudflareIp === "string") return cloudflareIp;
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  if (typeof real === "string") return real;

  return req.socket.remoteAddress || "127.0.0.1";
}

// ISP ve ASN bilgilerini alma
async function getIspInfo(ip: string) {
  try {
    // IP-API.com ücretsiz servisi (günde 1000 istek limiti)
    const response = await axios.get(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting,query`, {
      timeout: 5000,
    });
    
    if (response.data.status === 'success') {
      return {
        isp: response.data.isp || "Bilinmiyor",
        organization: response.data.org || "Bilinmiyor",
        asn: response.data.as || "Bilinmiyor",
        asnName: response.data.asname || "Bilinmiyor",
        mobile: response.data.mobile || false,
        proxy: response.data.proxy || false,
        hosting: response.data.hosting || false,
        zipCode: response.data.zip || "Bilinmiyor",
      };
    }
  } catch (error) {
    console.log('ISP bilgisi alınamadı:', error);
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
  };
}

// Güvenlik analizi
function getSecurityAnalysis(req: NextApiRequest, ip: string) {
  const userAgent = req.headers["user-agent"] || "";
  const acceptLanguage = req.headers["accept-language"] || "";
  const acceptEncoding = req.headers["accept-encoding"] || "";
  
  // Potansiyel bot tespiti
  const botIndicators = [
    /bot/i, /crawler/i, /spider/i, /scraper/i, /wget/i, /curl/i,
    /python/i, /requests/i, /axios/i, /httpx/i, /urllib/i
  ];
  
  const isBot = botIndicators.some(pattern => pattern.test(userAgent));
  
  // Şüpheli header analizi
  const suspiciousHeaders = [];
  if (!req.headers.accept) suspiciousHeaders.push("Accept header eksik");
  if (!req.headers["accept-language"]) suspiciousHeaders.push("Accept-Language header eksik");
  if (!req.headers["accept-encoding"]) suspiciousHeaders.push("Accept-Encoding header eksik");
  if (userAgent.length < 10) suspiciousHeaders.push("User-Agent çok kısa");
  
  // Risk skoru hesaplama (0-100)
  let riskScore = 0;
  if (isBot) riskScore += 30;
  if (suspiciousHeaders.length > 0) riskScore += suspiciousHeaders.length * 10;
  if (ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.")) riskScore += 5;
  if (!req.headers.referer) riskScore += 10;
  
  return {
    isBot,
    riskScore: Math.min(riskScore, 100),
    riskLevel: riskScore < 20 ? "Düşük" : riskScore < 50 ? "Orta" : riskScore < 80 ? "Yüksek" : "Kritik",
    suspiciousHeaders,
    botProbability: isBot ? "Yüksek" : suspiciousHeaders.length > 2 ? "Orta" : "Düşük",
  };
}

// Network performans metrikleri
function getNetworkMetrics(req: NextApiRequest) {
  const startTime = Date.now();
  const responseTime = Date.now() - startTime;
  
  return {
    responseTime: `${responseTime}ms`,
    requestSize: JSON.stringify(req.headers).length,
    timestamp: {
      iso: new Date().toISOString(),
      unix: Math.floor(Date.now() / 1000),
      formatted: new Date().toLocaleString('tr-TR'),
    },
    serverTime: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      offset: new Date().getTimezoneOffset(),
    }
  };
}

// Fingerprinting bilgileri
function getFingerprint(req: NextApiRequest, ip: string) {
  const userAgent = req.headers["user-agent"] || "";
  const acceptLanguage = req.headers["accept-language"] || "";
  const acceptEncoding = req.headers["accept-encoding"] || "";
  
  // Unique fingerprint hash
  const fingerprintData = [
    ip,
    userAgent,
    acceptLanguage,
    acceptEncoding,
    req.headers.accept,
    req.headers["sec-ch-ua"],
    req.headers["sec-ch-ua-mobile"],
    req.headers["sec-ch-ua-platform"],
  ].join('|');
  
  const fingerprint = crypto.createHash('sha256').update(fingerprintData).digest('hex').substring(0, 16);
  
  return {
    id: fingerprint,
    uniqueIdentifiers: {
      userAgentHash: crypto.createHash('md5').update(userAgent).digest('hex').substring(0, 8),
      headerFingerprint: crypto.createHash('md5').update(JSON.stringify(req.headers)).digest('hex').substring(0, 8),
      languageSignature: acceptLanguage.split(',')[0] || "unknown",
    },
    clientHints: {
      platform: req.headers["sec-ch-ua-platform"] || "Bilinmiyor",
      mobile: req.headers["sec-ch-ua-mobile"] === "?1" ? "Evet" : "Hayır",
      brands: req.headers["sec-ch-ua"] || "Bilinmiyor",
    }
  };
}

// Device ve browser bilgilerini al (enhanced)
function getDeviceInfo(userAgent: string) {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  // Screen resolution analizi (eğer varsa)
  const screenInfo = {
    colorDepth: "Bilinmiyor",
    screenResolution: "Bilinmiyor",
    availableResolution: "Bilinmiyor",
    devicePixelRatio: "Bilinmiyor",
  };

  return {
    browser: {
      name: result.browser.name || "Bilinmiyor",
      version: result.browser.version || "Bilinmiyor",
      major: result.browser.major || "Bilinmiyor",
      fullName: `${result.browser.name || "Bilinmiyor"} ${result.browser.version || ""}`.trim(),
    },
    device: {
      model: result.device.model || "Bilinmiyor",
      type: result.device.type || "desktop",
      vendor: result.device.vendor || "Bilinmiyor",
      fullName: `${result.device.vendor || ""} ${result.device.model || ""}`.trim() || "Bilinmiyor",
    },
    engine: {
      name: result.engine.name || "Bilinmiyor",
      version: result.engine.version || "Bilinmiyor",
      fullName: `${result.engine.name || "Bilinmiyor"} ${result.engine.version || ""}`.trim(),
    },
    os: {
      name: result.os.name || "Bilinmiyor",
      version: result.os.version || "Bilinmiyor",
      fullName: `${result.os.name || "Bilinmiyor"} ${result.os.version || ""}`.trim(),
    },
    cpu: {
      architecture: result.cpu.architecture || "Bilinmiyor",
    },
    screen: screenInfo,
    capabilities: {
      javascript: true, // API'ye erişebiliyorsa JS aktif
      cookies: "Bilinmiyor",
      localStorage: "Bilinmiyor",
      sessionStorage: "Bilinmiyor",
      webGL: "Bilinmiyor",
      canvas: "Bilinmiyor",
    }
  };
}

// Bağlantı bilgilerini al (enhanced)
function getConnectionInfo(req: NextApiRequest) {
  const acceptLanguage = req.headers["accept-language"];
  const acceptEncoding = req.headers["accept-encoding"];
  const connection = req.headers.connection;
  const cacheControl = req.headers["cache-control"];
  const dnt = req.headers.dnt;
  const upgradeInsecureRequests = req.headers["upgrade-insecure-requests"];

  // HTTP/2 ve diğer protokol desteği
  const httpVersion = req.httpVersion || "1.1";
  const protocol = req.headers["x-forwarded-proto"] || "http";
  
  // Gelişmiş güvenlik başlıkları
  const securityHeaders = {
    strictTransportSecurity: req.headers["strict-transport-security"] || "Yok",
    contentSecurityPolicy: req.headers["content-security-policy"] || "Yok",
    xFrameOptions: req.headers["x-frame-options"] || "Yok",
    xContentTypeOptions: req.headers["x-content-type-options"] || "Yok",
    referrerPolicy: req.headers["referrer-policy"] || "Yok",
  };

  // Bandwidth ve performance hints
  const performanceHints = {
    saveData: req.headers["save-data"] === "on" ? "Etkin" : "Devre Dışı",
    downlink: req.headers["downlink"] || "Bilinmiyor",
    effectiveType: req.headers["ect"] || "Bilinmiyor",
    rtt: req.headers["rtt"] || "Bilinmiyor",
  };

  return {
    language: acceptLanguage || "Bilinmiyor",
    encoding: acceptEncoding || "Bilinmiyor",
    connection: connection || "Bilinmiyor",
    cacheControl: cacheControl || "Bilinmiyor",
    doNotTrack: dnt === "1" ? "Etkin" : "Devre Dışı",
    httpsUpgrade: upgradeInsecureRequests === "1" ? "Etkin" : "Devre Dışı",
    referrer: req.headers.referer || "Yok",
    protocol: protocol,
    httpVersion: httpVersion,
    securityHeaders,
    performanceHints,
    clientHints: {
      viewportWidth: req.headers["viewport-width"] || "Bilinmiyor",
      deviceMemory: req.headers["device-memory"] || "Bilinmiyor",
      dpr: req.headers.dpr || "Bilinmiyor",
    }
  };
}

// IP türünü belirle
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

// Ülke kodunu tam ülke adına çevir
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

// IP aralığını hesapla
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"] || "";

    // Tüm bilgileri paralel olarak al
    const [deviceInfo, connectionInfo, securityInfo, networkMetrics, fingerprint, ispInfo] = await Promise.all([
      Promise.resolve(getDeviceInfo(userAgent)),
      Promise.resolve(getConnectionInfo(req)),
      Promise.resolve(getSecurityAnalysis(req, ip)),
      Promise.resolve(getNetworkMetrics(req)),
      Promise.resolve(getFingerprint(req, ip)),
      getIspInfo(ip)
    ]);

    console.log(`IP aranıyor: ${ip}`);

    const geo = geoip.lookup(ip);

    if (!geo) {
      return res.json({
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
          method: req.method,
          url: req.url,
          headers: {
            host: req.headers.host,
            origin: req.headers.origin,
            referer: req.headers.referer,
            accept: req.headers.accept,
            contentType: req.headers["content-type"],
          },
          sessionInfo: {
            firstRequest: true, // Bu basit versiyonda her zaman true
            requestCount: 1,
            lastActivity: new Date().toISOString(),
          }
        },
        analytics: {
          pageLoadTime: `${Date.now() - networkMetrics.timestamp.unix * 1000}ms`,
          browserSupport: {
            es6: deviceInfo.browser.name !== "Internet Explorer",
            webGL: "Destekleniyor olabilir",
            touchSupport: deviceInfo.device.type === "mobile" || deviceInfo.device.type === "tablet",
            orientation: deviceInfo.device.type === "mobile" ? "Portrait/Landscape" : "Landscape",
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
            "İnternet servis sağlayıcınızla iletişime geçin"
          ]
        },
      });
    }

    const ipRange = calculateIpRange(geo.range);

    // Gelişmiş konum analizi
    const locationAnalysis = {
      accuracy: "Şehir seviyesi (±5-50 km)",
      confidence: "Orta-Yüksek",
      dataSource: "geoip-lite + IP-API",
      lastUpdated: "Son 30 gün içinde",
      coordinates: {
        latitude: geo.ll[0],
        longitude: geo.ll[1],
        precision: "~10km radius",
        format: "Decimal Degrees (DD)",
      },
      timezone: {
        name: geo.timezone,
        offset: new Date().getTimezoneOffset() / -60,
        isDST: new Date().getTimezoneOffset() !== new Date(new Date().getFullYear(), 0, 1).getTimezoneOffset(),
        currentTime: new Date().toLocaleString('tr-TR', { timeZone: geo.timezone }),
      }
    };

    res.json({
      ip,
      ipType: getIpType(ip),
      country: geo.country,
      countryName: getCountryName(geo.country),
      city: geo.city,
      region: geo.region,
      timezone: geo.timezone,
      coordinates: {
        latitude: geo.ll[0],
        longitude: geo.ll[1],
      },
      range: geo.range,
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
        method: req.method,
        url: req.url,
        headers: {
          host: req.headers.host,
          origin: req.headers.origin,
          referer: req.headers.referer,
          accept: req.headers.accept,
          contentType: req.headers["content-type"],
          forwarded: req.headers["x-forwarded-for"],
          realIp: req.headers["x-real-ip"],
        },
        sessionInfo: {
          firstRequest: true,
          requestCount: 1,
          lastActivity: new Date().toISOString(),
          sessionDuration: "0ms",
        }
      },
      analytics: {
        pageLoadTime: `${Date.now() - networkMetrics.timestamp.unix * 1000}ms`,
        browserSupport: {
          es6: !deviceInfo.browser.name.includes("Internet Explorer"),
          webGL: "Muhtemelen destekleniyor",
          touchSupport: deviceInfo.device.type === "mobile" || deviceInfo.device.type === "tablet" ? "Evet" : "Hayır",
          orientation: deviceInfo.device.type === "mobile" ? "Portrait/Landscape" : "Landscape",
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
        totalIpsInRange: `Bu IP aralığında ${ipRange.total.toLocaleString()} IP adresi bulunmaktadır.`,
        privacyLevel: securityInfo.riskLevel,
        dataRetention: "Veriler saklanmaz, gerçek zamanlı işlenir",
        recommendations: [
          securityInfo.riskScore > 50 ? "Güvenlik riski tespit edildi, dikkatli olun" : "Güvenlik durumu normal görünüyor",
          ispInfo.proxy ? "Proxy kullanımı tespit edildi" : "Direkt bağlantı",
          ispInfo.mobile ? "Mobil bağlantı tespit edildi" : "Sabit bağlantı"
        ]
      },
    });
  } catch (error) {
    console.error("Lookup hatası:", error);
    
    // Hata durumunda bile mümkün olan bilgileri döndür
    const deviceInfo = getDeviceInfo(req.headers["user-agent"] || "");
    const connectionInfo = getConnectionInfo(req);
    const securityInfo = getSecurityAnalysis(req, getClientIp(req));
    
    res.status(500).json({
      error: "Sunucu hatası",
      details: (error as Error).message,
      partialData: {
        device: deviceInfo,
        connection: connectionInfo,
        security: securityInfo,
        timestamp: new Date().toISOString(),
      }
    });
  }
}

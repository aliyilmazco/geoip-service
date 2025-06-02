import type { NextApiRequest, NextApiResponse } from "next";
import geoip from "geoip-lite";
import { UAParser } from "ua-parser-js";

function getDeviceInfo(userAgent: string) {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  return {
    browser: {
      name: result.browser.name || "Bilinmiyor",
      version: result.browser.version || "Bilinmiyor",
      major: result.browser.major || "Bilinmiyor",
    },
    device: {
      model: result.device.model || "Bilinmiyor",
      type: result.device.type || "desktop",
      vendor: result.device.vendor || "Bilinmiyor",
    },
    engine: {
      name: result.engine.name || "Bilinmiyor",
      version: result.engine.version || "Bilinmiyor",
    },
    os: {
      name: result.os.name || "Bilinmiyor",
      version: result.os.version || "Bilinmiyor",
    },
    cpu: {
      architecture: result.cpu.architecture || "Bilinmiyor",
    },
  };
}

function getConnectionInfo(req: NextApiRequest) {
  const acceptLanguage = req.headers["accept-language"];
  const acceptEncoding = req.headers["accept-encoding"];
  const connection = req.headers.connection;
  const cacheControl = req.headers["cache-control"];
  const dnt = req.headers.dnt;
  const upgradeInsecureRequests = req.headers["upgrade-insecure-requests"];

  return {
    language: acceptLanguage || "Bilinmiyor",
    encoding: acceptEncoding || "Bilinmiyor",
    connection: connection || "Bilinmiyor",
    cacheControl: cacheControl || "Bilinmiyor",
    doNotTrack: dnt === "1" ? "Etkin" : "Devre Dışı",
    httpsUpgrade: upgradeInsecureRequests === "1" ? "Etkin" : "Devre Dışı",
    referrer: req.headers.referer || "Yok",
    protocol: req.headers["x-forwarded-proto"] || "http",
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
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { ip } = req.query;
    const userAgent = req.headers["user-agent"] || "";

    const deviceInfo = getDeviceInfo(userAgent);
    const connectionInfo = getConnectionInfo(req);

    if (!ip || typeof ip !== "string") {
      return res.status(400).json({ error: "IP adresi gerekli" });
    }

    if (!isValidIp(ip)) {
      return res.status(400).json({
        error: "Geçersiz IP adresi formatı",
        ip,
        device: deviceInfo,
        connection: connectionInfo,
        requestInfo: {
          timestamp: new Date().toISOString(),
          userAgent: userAgent,
          method: req.method,
          url: req.url,
          requestedIp: ip,
        },
        details: {
          note: "Lütfen geçerli bir IPv4 veya IPv6 adresi girin.",
          reason: "IP adresi format kontrolünden geçemedi",
        },
      });
    }

    const geo = geoip.lookup(ip);

    if (!geo) {
      return res.status(404).json({
        ip,
        ipType: getIpType(ip),
        error: "Bu IP adresi için konum bilgisi bulunamadı",
        device: deviceInfo,
        connection: connectionInfo,
        requestInfo: {
          timestamp: new Date().toISOString(),
          userAgent: userAgent,
          method: req.method,
          url: req.url,
          requestedIp: ip,
        },
        details: {
          reason: getIpType(ip).includes("Özel")
            ? "Özel ağ IP adresi"
            : "Veritabanında konum bilgisi mevcut değil",
          note: "Özel ağ IP adresleri için coğrafi konum bilgisi bulunmaz.",
          explanation:
            "Bu IP adresi için GeoIP veritabanında kayıt bulunmuyor.",
        },
      });
    }

    const ipRange = calculateIpRange(geo.range);

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
      requestInfo: {
        timestamp: new Date().toISOString(),
        userAgent: userAgent,
        method: req.method,
        url: req.url,
        requestedIp: ip,
      },
      details: {
        accuracy: "Şehir seviyesi (yaklaşık)",
        provider: "geoip-lite veritabanı",
        lastUpdate: "Düzenli olarak güncellenir",
        note: "Coğrafi konum yaklaşık bir tahmindir ve ISP lokasyonuna dayanır.",
        totalIpsInRange: `Bu IP bloğunda ${ipRange.total.toLocaleString()} IP adresi bulunur`,
      },
    });
  } catch (error) {
    console.error("Lookup hatası:", error);
    res.status(500).json({
      error: "Geçersiz IP adresi",
      details: (error as Error).message,
    });
  }
}

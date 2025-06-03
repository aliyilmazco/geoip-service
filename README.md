# 🌍 GeoIP Service - Gelişmiş IP Lokasyon ve Cihaz Analiz Servisi

[![Next.js](https://img.shields.io/badge/Next.js-15.1.0-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![API Documentation](https://img.shields.io/badge/API-Swagger-orange)](http://ip.aliyilmaz.co/docs)

## 📋 İçindekiler

- [Genel Bakış](#genel-bakış)
- [Özellikler](#özellikler)
- [Demo ve Dokümantasyon](#demo-ve-dokümantasyon)
- [Kurulum](#kurulum)
- [Kullanım](#kullanım)
- [API Referansı](#api-referansı)
- [Proje Yapısı](#proje-yapısı)
- [Konfigürasyon](#konfigürasyon)
- [Geliştirme](#geliştirme)
- [Dağıtım](#dağıtım)
- [Sorun Giderme](#sorun-giderme)
- [Katkıda Bulunma](#katkıda-bulunma)

## 🌍 Genel Bakış

GeoIP Service, IP adreslerinin coğrafi konumunu ve detaylı cihaz bilgilerini analiz eden gelişmiş bir Next.js uygulamasıdır. Bu servis, kullanıcıların IP adreslerini sorgulayarak konum, ISP, güvenlik, cihaz ve ağ analizi bilgileri sunar.

### Ana Özellikler

- **🌐 Coğrafi Lokasyon**: IP adreslerinin şehir, ülke ve koordinat bilgileri
- **📱 Cihaz Analizi**: Tarayıcı, işletim sistemi, cihaz türü ve mimari bilgileri
- **🔒 Güvenlik Analizi**: Bot tespiti, risk skoru ve güvenlik değerlendirmeleri
- **📡 Ağ Analizi**: ISP bilgileri, bağlantı türü ve performans metrikleri
- **🔍 Parmak İzi Analizi**: Benzersiz cihaz kimlik tespiti
- **⚡ Gerçek Zamanlı**: Anlık sorgulama ve yanıt
- **🌙 Dark Mode**: Modern ve kullanıcı dostu arayüz
- **📚 API Dokümantasyonu**: Swagger UI ile interaktif API dokümantasyonu

## 🚀 Demo ve Dokümantasyon

### Canlı Demo

- **Ana Sayfa**: [http://localhost:3000](http://localhost:3000)
- **API Dokümantasyonu**: [http://localhost:3000/docs](http://localhost:3000/docs)

### API Endpoints

- **Mevcut IP**: `GET /api/lookup`
- **Belirli IP**: `GET /api/lookup/{ip}`
- **Swagger Spec**: `GET /api/swagger`

### Hızlı Test

```bash
# Mevcut IP'nizi analiz edin
curl http://localhost:3000/api/lookup

# Belirli bir IP'yi analiz edin
curl http://localhost:3000/api/lookup/8.8.8.8
```

## ✨ Özellikler

### Coğrafi Lokasyon

- Ülke, şehir, bölge bilgileri
- GPS koordinatları (enlem/boylam)
- Zaman dilimi bilgisi
- IP aralığı analizi

### Cihaz ve Tarayıcı Analizi

- Tarayıcı türü, versiyonu ve motoru
- İşletim sistemi detayları
- Cihaz türü (masaüstü, mobil, tablet)
- CPU mimarisi
- Ekran özellikleri

### ISP ve Ağ Bilgileri

- İnternet Servis Sağlayıcısı
- Organizasyon bilgileri
- ASN (Autonomous System Number)
- Mobil/sabit bağlantı tespiti
- Proxy/VPN tespiti
- Hosting servisi tespiti

### Güvenlik ve Risk Analizi

- Bot probability skoru
- Risk seviyesi değerlendirmesi
- Şüpheli header tespiti
- Güvenlik önerileri

### Performance ve Analytics

- Yanıt süresi ölçümü
- Session takibi
- Browser compatibility
- Network performance hints

## 🚀 Kurulum

### Gereksinimler

- **Node.js**: 18.0 veya üzeri
- **npm**: 8.0 veya üzeri
- **Git**: Versiyon kontrolü için

### Adım Adım Kurulum

1. **Projeyi Klonlayın**

   ```bash
   git clone https://github.com/username/geoip-service.git
   cd geoip-service
   ```

2. **Bağımlılıkları Yükleyin**

   ```bash
   npm install
   ```

3. **GeoIP Veritabanını Güncelleyin**

   ```bash
   npm run update-geo
   ```

4. **Geliştirme Sunucusunu Başlatın**

   ```bash
   npm run dev
   ```

5. **Uygulamayı Açın**
   ```
   http://localhost:3000
   ```

## 📖 Kullanım

### Web Arayüzü

1. Ana sayfaya gidin: `http://localhost:3000`
2. IP adresi girin veya kendi IP'nizi analiz edin
3. Detaylı sonuçları görüntüleyin

### API Kullanımı

#### Kendi IP'nizi Sorgulama

```bash
curl http://localhost:3000/api/lookup
```

#### Belirli IP Sorgulama

```bash
curl http://localhost:3000/api/lookup/8.8.8.8
```

#### JavaScript ile Kullanım

```javascript
// Kendi IP'nizi sorgulama
const response = await fetch("/api/lookup");
const data = await response.json();

// Belirli IP sorgulama
const response = await fetch("/api/lookup/8.8.8.8");
const data = await response.json();
```

## 🔧 API Referansı

### 📚 Interaktif API Dokümantasyonu

Bu proje, **Swagger UI** ile tam özellikli API dokümantasyonu içerir:

- **Dokümantasyon URL**: [http://localhost:3000/docs](http://localhost:3000/docs)
- **OpenAPI Spec**: [http://localhost:3000/api/swagger](http://localhost:3000/api/swagger)

Swagger UI üzerinden:

- ✅ Tüm endpoint'leri keşfedin
- ✅ Parametreleri test edin
- ✅ Gerçek zamanlı API çağrıları yapın
- ✅ Response örneklerini görün
- ✅ Schema detaylarını inceleyin

### Endpoint'ler

#### `GET /api/lookup`

Kullanıcının kendi IP adresini analiz eder.

**Yanıt Örneği:**

```json
{
  "ip": "203.0.113.1",
  "ipType": "Genel IPv4",
  "country": "TR",
  "countryName": "Türkiye",
  "city": "Istanbul",
  "coordinates": {
    "latitude": 41.0082,
    "longitude": 28.9784
  },
  "device": {
    "browser": {
      "name": "Chrome",
      "version": "120.0.0.0"
    },
    "os": {
      "name": "Windows",
      "version": "10"
    }
  },
  "isp": {
    "isp": "Turk Telekom",
    "organization": "TTNET"
  }
}
```

#### `GET /api/lookup/[ip]`

Belirtilen IP adresini analiz eder.

**Parametreler:**

- `ip` (string): Analiz edilecek IP adresi (IPv4 veya IPv6)

**Örnek Kullanım:**

```
GET /api/lookup/8.8.8.8
GET /api/lookup/2001:4860:4860::8888
```

### Yanıt Yapısı

API yanıtları aşağıdaki ana bölümleri içerir:

- **ip**: IP adresi bilgileri
- **device**: Cihaz ve tarayıcı bilgileri
- **location**: Coğrafi konum bilgileri
- **isp**: İnternet servis sağlayıcısı bilgileri
- **security**: Güvenlik analizi
- **network**: Ağ performans metrikleri
- **analytics**: Browser uyumluluk ve analitik
- **fingerprint**: Cihaz parmak izi

### Hata Kodları

- **400**: Geçersiz IP adresi formatı
- **404**: IP adresi bulunamadı
- **500**: Sunucu hatası
- **429**: Çok fazla istek (rate limiting)

## 📁 Proje Yapısı

```
geoip-service/
├── app/                    # Next.js App Router
│   ├── api/               # API endpoints
│   │   └── lookup/        # IP lookup API
│   │       ├── route.ts   # Ana lookup endpoint
│   │       └── [ip]/      # Dinamik IP endpoint
│   │           └── route.ts
│   ├── globals.css        # Global stiller
│   ├── layout.tsx         # Ana layout
│   └── page.tsx           # Ana sayfa
├── lib/                   # Utility kütüphaneleri
│   └── geoip-safe.ts     # GeoIP güvenli wrapper
├── public/               # Statik dosyalar
│   └── data/            # GeoIP veritabanı dosyaları
├── package.json         # Proje bağımlılıkları
├── next.config.js       # Next.js konfigürasyonu
├── tsconfig.json        # TypeScript konfigürasyonu
└── README.md           # Bu dosya
```

### Dosya Açıklamaları

#### `/app/api/lookup/route.ts`

- Ana IP lookup endpoint'i
- Kullanıcının kendi IP'sini analiz eder
- Session yönetimi ve analytics

#### `/app/api/lookup/[ip]/route.ts`

- Dinamik IP lookup endpoint'i
- Belirtilen IP adresini analiz eder
- IP validasyonu ve hata yönetimi

#### `/lib/geoip-safe.ts`

- GeoIP-lite için güvenli wrapper
- Hata yönetimi ve fallback mekanizması
- Build-time sorunlarını çözer

#### `/app/page.tsx`

- React-based frontend arayüzü
- Dark mode desteği
- Responsive tasarım

## ⚙️ Konfigürasyon

### Environment Variables

```bash
# .env.local
GEOIP_LITE_DATA_PATH=/custom/path/to/geoip/data
NODE_ENV=production
NEXT_PUBLIC_API_BASE_URL=https://yourapi.com
```

### Next.js Konfigürasyonu

```javascript
// next.config.js
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // GeoIP data dosyalarını kopyala
      config.module.rules.push({
        test: /\.dat$/,
        type: "asset/resource",
        generator: {
          filename: "data/[name][ext]",
        },
      });
    }
    return config;
  },
};
```

## 🛠️ Geliştirme

### Geliştirme Komutları

```bash
# Geliştirme sunucusu
npm run dev

# Production build
npm run build

# Production sunucusu
npm start

# Linting
npm run lint

# GeoIP veritabanı güncelleme
npm run update-geo
```

### Geliştirme Ortamı Kurulumu

1. **VS Code Extensions** (önerilen):

   - TypeScript Hero
   - Prettier
   - ESLint
   - Next.js Extension Pack

2. **Git Hooks** kurulumu:
   ```bash
   npm install --save-dev husky
   npx husky install
   ```

### Kod Standartları

- **TypeScript**: Strict mode aktif
- **ESLint**: Next.js recommended rules
- **Prettier**: Kod formatlama
- **Commit Convention**: Conventional Commits

## 🚀 Dağıtım

### Vercel (Önerilen)

1. **GitHub'a Push**

   ```bash
   git push origin main
   ```

2. **Vercel'e Deploy**
   - Vercel dashboard'a gidin
   - GitHub repository'yi bağlayın
   - Otomatik deploy başlayacak

### Docker

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### Manual Deployment

```bash
# Production build
npm run build

# Dosyaları sunucuya upload edin
# PM2 ile çalıştırın
pm2 start npm --name "geoip-service" -- start
```

## 🔍 Sorun Giderme

### Yaygın Sorunlar

#### 1. GeoIP Database Hatası

```
Error: ENOENT: no such file or directory, open 'geoip-country.dat'
```

**Çözüm:**

```bash
npm run update-geo
npm run build
```

#### 2. TypeScript Hatası

```
Property 'es6' does not exist on type 'undefined'
```

**Çözüm:**

- API yanıtlarında `browserSupport` nesnesinin varlığını kontrol edin
- Safe navigation (`?.`) kullanın

#### 3. CORS Hatası

```
Access to fetch at 'localhost:3000' from origin 'localhost:3000' has been blocked
```

**Çözüm:**

```javascript
// next.config.js
const nextConfig = {
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
};
```

### Debug Modları

```bash
# Verbose logging
DEBUG=* npm run dev

# API debugging
curl -v http://localhost:3000/api/lookup

# Network debugging
NODE_ENV=development npm run dev
```

## 🤝 Katkıda Bulunma

### Katkı Süreci

1. **Fork** edin
2. **Feature branch** oluşturun (`git checkout -b feature/amazing-feature`)
3. **Commit** edin (`git commit -m 'Add some amazing feature'`)
4. **Push** edin (`git push origin feature/amazing-feature`)
5. **Pull Request** açın

### Kod Katkısı Kuralları

- Test yazın
- Dokümantasyonu güncelleyin
- TypeScript tiplerini kullanın
- ESLint kurallarına uyun

## 📝 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 📞 İletişim

- **GitHub**: [Issues](https://github.com/aliyilmazco/geoip-service/issues)
- **Email**: contact@aliyilmaz.co
- **Website**: [https://ip.aliyilmaz.co](https://ip.aliyilmaz.co)

## 🙏 Teşekkürler

- [GeoIP-lite](https://github.com/geoip-lite/node-geoip) - IP geolocation
- [UA-Parser-js](https://github.com/faisalman/ua-parser-js) - User agent parsing
- [IP-API](https://ip-api.com/) - ISP information
- [Next.js](https://nextjs.org/) - React framework
- [Vercel](https://vercel.com/) - Hosting platform

---

⭐ Eğer bu proje işinize yaradıysa, GitHub'da **star** vermeyi unutmayın!

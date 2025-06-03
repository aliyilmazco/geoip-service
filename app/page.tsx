"use client";

import { useState, useEffect, useCallback } from "react";

interface LocationData {
  ip: string;
  requestedIp?: string;
  ipType?: string;
  country?: string;
  countryName?: string;
  city?: string;
  region?: string;
  timezone?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  range?: number[];
  ipRange?: {
    start: string;
    end: string;
    total: number;
  };
  device?: {
    browser: {
      name: string;
      version: string;
      major: string;
      fullName: string;
    };
    device: {
      model: string;
      type: string;
      vendor: string;
      fullName: string;
    };
    engine: {
      name: string;
      version: string;
      fullName: string;
    };
    os: {
      name: string;
      version: string;
      fullName: string;
    };
    cpu: {
      architecture: string;
    };
    screen: {
      colorDepth: string;
      screenResolution: string;
      availableResolution: string;
      devicePixelRatio: string;
    };
    capabilities: {
      javascript: boolean;
      cookies: string;
      localStorage: string;
      sessionStorage: string;
      webGL: string;
      canvas: string;
    };
  };
  connection?: {
    language: string;
    encoding: string;
    connection: string;
    cacheControl: string;
    doNotTrack: string;
    httpsUpgrade: string;
    referrer: string;
    protocol: string;
    httpVersion: string;
    securityHeaders: {
      strictTransportSecurity: string;
      contentSecurityPolicy: string;
      xFrameOptions: string;
      xContentTypeOptions: string;
      referrerPolicy: string;
    };
    performanceHints: {
      saveData: string;
      downlink: string;
      effectiveType: string;
      rtt: string;
    };
    clientHints: {
      viewportWidth: string;
      deviceMemory: string;
      dpr: string;
    };
  };
  security?: {
    isBot: boolean;
    riskScore: number;
    riskLevel: string;
    suspiciousHeaders: string[];
    botProbability: string;
  };
  network?: {
    responseTime: string;
    requestSize: number;
    timestamp: {
      iso: string;
      unix: number;
      formatted: string;
    };
    serverTime: {
      timezone: string;
      offset: number;
    };
  };
  fingerprint?: {
    id: string;
    uniqueIdentifiers: {
      userAgentHash: string;
      headerFingerprint: string;
      languageSignature: string;
    };
    clientHints: {
      platform: string;
      mobile: string;
      brands: string;
    };
  };
  isp?: {
    isp: string;
    organization: string;
    asn: string;
    asnName: string;
    mobile: boolean;
    proxy: boolean;
    hosting: boolean;
    zipCode: string;
  };
  location?: {
    accuracy: string;
    confidence: string;
    dataSource: string;
    lastUpdated: string;
    coordinates: {
      latitude: number;
      longitude: number;
      precision: string;
      format: string;
    };
    timezone: {
      name: string;
      offset: number;
      isDST: boolean;
      currentTime: string;
    };
  };
  requestInfo?: {
    timestamp: string;
    userAgent: string;
    method: string;
    url: string;
    headers?: {
      host?: string;
      origin?: string;
      referer?: string;
      accept?: string;
      contentType?: string;
      forwarded?: string;
      realIp?: string;
    };
    sessionInfo?: {
      firstRequest?: boolean;
      requestCount?: number;
      lastActivity?: string;
      sessionDuration?: string;
      sessionId?: string;
    };
  };
  analytics?: {
    pageLoadTime: string;
    browserSupport: {
      es6: boolean;
      webGL: string;
      touchSupport: string;
      orientation: string;
      cookieSupport?: string;
      localStorageSupport?: string;
    };
    geoAccuracy: string;
    dataFreshness: string;
    totalRequestTime?: string;
  };
  details?: {
    accuracy?: string;
    provider?: string;
    lastUpdate?: string;
    note?: string;
    totalIpsInRange?: string;
    privacyLevel?: string;
    dataRetention?: string;
    recommendations?: string[];
    explanation?: string;
    reason?: string;
  };
  error?: string;
  isLocal?: boolean;
}

export default function Home() {
  const [ipInput, setIpInput] = useState("");
  const [result, setResult] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const showLoading = () => {
    setLoading(true);
    setError("");
    setResult(null);
  };

  const showError = (message: string) => {
    setError(message);
    setLoading(false);
    setResult(null);
  };

  const showResult = (data: LocationData) => {
    setResult(data);
    setLoading(false);
    setError("");
  };

  const getMyLocation = useCallback(async () => {
    showLoading();
    try {
      const response = await fetch("/api/lookup");
      const data = await response.json();
      showResult(data);
    } catch (error) {
      showError(
        "Sunucuya bağlanırken hata oluştu: " + (error as Error).message
      );
    }
  }, []);

  useEffect(() => {
    setTimeout(() => {
      getMyLocation();
    }, 500);
  }, [getMyLocation]);

  const getCustomLocation = async () => {
    const ip = ipInput.trim();
    if (!ip) {
      showError("Lütfen sorgulamak istediğiniz IP adresini girin.");
      return;
    }

    showLoading();
    try {
      const response = await fetch(`/api/lookup/${ip}`);
      const data = await response.json();
      showResult(data);
    } catch (error) {
      showError(
        "Sunucuya bağlanırken hata oluştu: " + (error as Error).message
      );
    }
  };

  const clearResults = () => {
    setResult(null);
    setError("");
    setIpInput("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      getCustomLocation();
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1 className="title">🌍 Gelişmiş IP Konum Servisi</h1>
        <p className="subtitle">
          IP adresinizin konumunu, cihaz bilgilerinizi, güvenlik analizini ve
          çok daha fazlasını keşfedin
        </p>
        <div className="author-info">
          <p>
            <a
              href="https://aliyilmaz.co"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ali Yılmaz
            </a>{" "}
            tarafından geliştirilmiştir
          </p>
        </div>

        <div className="navigation-links">
          <a
            href="/docs"
            className="nav-link docs-link"
            title="API Documentation"
          >
            📚 API Dokümantasyonu
          </a>
          <a
            href="https://github.com/aliyilmazco/geoip-service"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link github-link"
            title="GitHub Repository"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            GitHub
          </a>
        </div>
      </header>

      <div className="controls">
        <div className="input-section">
          <input
            type="text"
            value={ipInput}
            onChange={(e) => setIpInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="IP adresi girin (örn: 8.8.8.8)"
            className="ip-input"
            disabled={loading}
          />
          <button
            onClick={getCustomLocation}
            className="action-button"
            disabled={loading}
          >
            🔍 Sorgula
          </button>
        </div>

        <div className="button-group">
          <button
            onClick={getMyLocation}
            className="btn btn-primary"
            disabled={loading}
          >
            📍 Benim Konumum
          </button>
          <button
            onClick={clearResults}
            className="btn btn-secondary"
            disabled={loading}
          >
            🗑️ Temizle
          </button>
        </div>
      </div>

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Kapsamlı analiz yapılıyor...</p>
        </div>
      )}

      {error && (
        <div className="error">
          <h3>❌ Hata</h3>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="result">
          {result.error ? (
            <div className="error-section">
              <div className="error-main">
                <h3>⚠️ Bilgi Bulunamadı</h3>
                <div className="result-group">
                  <div className="result-item">
                    <strong>🌐 IP Adresi</strong>
                    {result.ip}
                  </div>
                  {result.ipType && (
                    <div className="result-item">
                      <strong>🔗 IP Türü</strong>
                      {result.ipType}
                    </div>
                  )}
                  <div className="result-item error-message">
                    <strong>⚠️ Durum</strong>
                    {result.error}
                  </div>
                </div>
              </div>

              {/* Device Information for errors */}
              {result.device && (
                <div className="detail-info error-detail">
                  <h4>📱 Cihaz Bilgileri</h4>
                  <div className="info-grid">
                    <div className="result-item">
                      <strong>🌐 Tarayıcı</strong>
                      {result.device.browser.fullName}
                    </div>
                    <div className="result-item">
                      <strong>💻 İşletim Sistemi</strong>
                      {result.device.os.fullName}
                    </div>
                    <div className="result-item">
                      <strong>📱 Cihaz Türü</strong>
                      {result.device.device.type === "mobile"
                        ? "📱 Mobil"
                        : result.device.device.type === "tablet"
                        ? "📊 Tablet"
                        : "💻 Masaüstü"}
                    </div>
                    <div className="result-item">
                      <strong>⚙️ Mimari</strong>
                      {result.device.cpu.architecture}
                    </div>
                  </div>
                </div>
              )}

              {result.security && (
                <div className="detail-info">
                  <h4>🔒 Güvenlik Analizi</h4>
                  <div className="info-grid">
                    <div className="result-item">
                      <strong>🤖 Bot Tespiti</strong>
                      {result.security.isBot
                        ? "⚠️ Bot tespit edildi"
                        : "✅ İnsan kullanıcı"}
                    </div>
                    <div
                      className={`result-item ${
                        result.security.riskLevel === "Kritik"
                          ? "high-risk"
                          : result.security.riskLevel === "Yüksek"
                          ? "medium-risk"
                          : "low-risk"
                      }`}
                    >
                      <strong>📊 Risk Skoru</strong>
                      {result.security.riskScore}/100 (
                      {result.security.riskLevel})
                    </div>
                    <div className="result-item">
                      <strong>🔍 Bot Olasılığı</strong>
                      {result.security.botProbability}
                    </div>
                  </div>
                </div>
              )}

              {result.details?.recommendations && (
                <div className="detail-info recommendations">
                  <h4>💡 Öneriler</h4>
                  <ul>
                    {result.details.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="success-section">
              {/* Basic Location Info */}
              <div className="result-main">
                <h3>📍 Konum Bilgileri</h3>
                <div className="result-group">
                  <div className="result-item">
                    <strong>🌐 IP Adresi</strong>
                    {result.ip}
                  </div>
                  {result.ipType && (
                    <div className="result-item">
                      <strong>🔗 IP Türü</strong>
                      {result.ipType}
                    </div>
                  )}
                  {result.country && (
                    <div className="result-item">
                      <strong>🏳️ Ülke</strong>
                      {result.countryName} ({result.country})
                    </div>
                  )}
                  {result.city && (
                    <div className="result-item">
                      <strong>🏙️ Şehir</strong>
                      {result.city}
                    </div>
                  )}
                  {result.region && (
                    <div className="result-item">
                      <strong>🗺️ Bölge</strong>
                      {result.region}
                    </div>
                  )}
                  {result.timezone && (
                    <div className="result-item">
                      <strong>🕐 Zaman Dilimi</strong>
                      {result.timezone}
                    </div>
                  )}
                  {result.coordinates && (
                    <div className="result-item">
                      <strong>📍 Koordinatlar</strong>
                      {result.coordinates.latitude.toFixed(4)},{" "}
                      {result.coordinates.longitude.toFixed(4)}
                      <a
                        href={`https://www.google.com/maps?q=${result.coordinates.latitude},${result.coordinates.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="map-link"
                      >
                        🗺️ Haritada Göster
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* ISP Information */}
              {result.isp && (
                <div className="detail-info">
                  <h4>🌐 İSP ve Ağ Bilgileri</h4>
                  <div className="info-grid">
                    <div className="result-item">
                      <strong>🏢 İSP</strong>
                      {result.isp.isp}
                    </div>
                    <div className="result-item">
                      <strong>🏛️ Organizasyon</strong>
                      {result.isp.organization}
                    </div>
                    <div className="result-item">
                      <strong>🔗 ASN</strong>
                      {result.isp.asn}
                      <div className="sub-info">{result.isp.asnName}</div>
                    </div>
                    <div className="result-item">
                      <strong>📫 Posta Kodu</strong>
                      {result.isp.zipCode}
                    </div>
                    <div className="result-item">
                      <strong>📱 Mobil Bağlantı</strong>
                      {result.isp.mobile ? "✅ Evet" : "❌ Hayır"}
                    </div>
                    <div className="result-item">
                      <strong>🔄 Proxy Kullanımı</strong>
                      {result.isp.proxy
                        ? "⚠️ Tespit edildi"
                        : "✅ Tespit edilmedi"}
                    </div>
                    <div className="result-item">
                      <strong>🖥️ Hosting Servisi</strong>
                      {result.isp.hosting ? "✅ Evet" : "❌ Hayır"}
                    </div>
                  </div>
                </div>
              )}

              {/* Enhanced Location Analysis */}
              {result.location && (
                <div className="detail-info">
                  <h4>🗺️ Gelişmiş Konum Analizi</h4>
                  <div className="info-grid">
                    <div className="result-item">
                      <strong>🎯 Doğruluk Seviyesi</strong>
                      {result.location.accuracy}
                    </div>
                    <div className="result-item">
                      <strong>✅ Güven Seviyesi</strong>
                      {result.location.confidence}
                    </div>
                    <div className="result-item">
                      <strong>📊 Veri Kaynağı</strong>
                      {result.location.dataSource}
                    </div>
                    <div className="result-item">
                      <strong>🕐 Yerel Saat</strong>
                      {result.location.timezone.currentTime}
                    </div>
                    <div className="result-item">
                      <strong>🌅 Yaz Saati Uygulaması</strong>
                      {result.location.timezone.isDST ? "✅ Aktif" : "❌ Pasif"}
                    </div>
                    <div className="result-item">
                      <strong>⏰ UTC Saat Farkı</strong>
                      {result.location.timezone.offset > 0 ? "+" : ""}
                      {result.location.timezone.offset} saat
                    </div>
                    <div className="result-item">
                      <strong>📏 Koordinat Formatı</strong>
                      {result.location.coordinates.format}
                    </div>
                    <div className="result-item">
                      <strong>🎯 Konum Hassasiyeti</strong>
                      {result.location.coordinates.precision}
                    </div>
                  </div>
                </div>
              )}

              {/* Security Analysis */}
              {result.security && (
                <div className="detail-info">
                  <h4>🔒 Güvenlik ve Risk Analizi</h4>
                  <div className="info-grid">
                    <div className="result-item">
                      <strong>🤖 Bot/Crawler Tespiti</strong>
                      {result.security.isBot
                        ? "⚠️ Bot tespit edildi"
                        : "✅ İnsan kullanıcı"}
                    </div>
                    <div
                      className={`result-item ${
                        result.security.riskLevel === "Kritik"
                          ? "high-risk"
                          : result.security.riskLevel === "Yüksek"
                          ? "medium-risk"
                          : "low-risk"
                      }`}
                    >
                      <strong>📊 Risk Seviyesi</strong>
                      {result.security.riskScore}/100 (
                      {result.security.riskLevel})
                    </div>
                    <div className="result-item">
                      <strong>🔍 Bot Olasılık Değerlendirmesi</strong>
                      {result.security.botProbability}
                    </div>
                    {result.security.suspiciousHeaders.length > 0 && (
                      <div className="result-item suspicious-headers">
                        <strong>⚠️ Şüpheli HTTP Headers</strong>
                        <ul className="suspicious-list">
                          {result.security.suspiciousHeaders.map(
                            (header, index) => (
                              <li key={index}>• {header}</li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Device Information */}
              {result.device && (
                <div className="detail-info">
                  <h4>📱 Cihaz ve Tarayıcı Detayları</h4>
                  <div className="info-grid">
                    <div className="result-item">
                      <strong>🌐 Tarayıcı</strong>
                      {result.device.browser.fullName}
                      <div className="sub-info">
                        Ana Sürüm: {result.device.browser.major}
                      </div>
                    </div>
                    <div className="result-item">
                      <strong>💻 İşletim Sistemi</strong>
                      {result.device.os.fullName}
                    </div>
                    <div className="result-item">
                      <strong>📱 Cihaz Bilgisi</strong>
                      {result.device.device.fullName !== "Bilinmiyor"
                        ? result.device.device.fullName
                        : result.device.device.type}
                      <div className="sub-info">
                        Tür:{" "}
                        {result.device.device.type === "mobile"
                          ? "📱 Mobil"
                          : result.device.device.type === "tablet"
                          ? "📊 Tablet"
                          : "💻 Masaüstü"}
                      </div>
                    </div>
                    <div className="result-item">
                      <strong>⚙️ Render Motoru</strong>
                      {result.device.engine.fullName}
                    </div>
                    <div className="result-item">
                      <strong>🖥️ CPU Mimarisi</strong>
                      {result.device.cpu.architecture}
                    </div>
                    <div className="result-item">
                      <strong>🎮 JavaScript Desteği</strong>
                      {result.device.capabilities?.javascript
                        ? "✅ Aktif"
                        : "❌ Pasif"}
                    </div>
                  </div>
                </div>
              )}

              {/* Network & Performance */}
              {result.network && (
                <div className="detail-info">
                  <h4>🌐 Ağ Performansı ve Zaman Bilgileri</h4>
                  <div className="info-grid">
                    <div className="result-item">
                      <strong>⚡ API Yanıt Süresi</strong>
                      {result.network.responseTime}
                    </div>
                    <div className="result-item">
                      <strong>📊 İstek Boyutu</strong>
                      {(result.network.requestSize / 1024).toFixed(2)} KB
                    </div>
                    <div className="result-item">
                      <strong>🕐 Sunucu Zamanı</strong>
                      {result.network.timestamp.formatted}
                    </div>
                    <div className="result-item">
                      <strong>🌍 Sunucu Zaman Dilimi</strong>
                      {result.network.serverTime.timezone}
                    </div>
                    <div className="result-item">
                      <strong>⏰ Unix Zaman Damgası</strong>
                      {result.network.timestamp.unix}
                    </div>
                    <div className="result-item">
                      <strong>📅 ISO Formatı</strong>
                      {result.network.timestamp.iso}
                    </div>
                  </div>
                </div>
              )}

              {/* Connection Details */}
              {result.connection && (
                <div className="detail-info">
                  <h4>🔌 Bağlantı ve Protokol Detayları</h4>
                  <div className="info-grid">
                    <div className="result-item">
                      <strong>🌐 Protokol</strong>
                      {result.connection.protocol.toUpperCase()} / HTTP{" "}
                      {result.connection.httpVersion}
                    </div>
                    <div className="result-item">
                      <strong>🌍 Dil Tercihleri</strong>
                      {result.connection.language}
                    </div>
                    <div className="result-item">
                      <strong>🗜️ Desteklenen Sıkıştırma</strong>
                      {result.connection.encoding}
                    </div>
                    <div className="result-item">
                      <strong>🚫 Do Not Track</strong>
                      {result.connection.doNotTrack}
                    </div>
                    <div className="result-item">
                      <strong>🔒 HTTPS Yükseltme</strong>
                      {result.connection.httpsUpgrade}
                    </div>
                    <div className="result-item">
                      <strong>🔗 Yönlendiren Sayfa</strong>
                      {result.connection.referrer === "Yok"
                        ? "Doğrudan erişim"
                        : result.connection.referrer}
                    </div>
                    <div className="result-item">
                      <strong>🔄 Bağlantı Türü</strong>
                      {result.connection.connection}
                    </div>
                    <div className="result-item">
                      <strong>💾 Önbellek Kontrolü</strong>
                      {result.connection.cacheControl}
                    </div>
                  </div>

                  {/* Performance Hints */}
                  {result.connection.performanceHints && (
                    <div className="sub-section">
                      <h5>📈 Performans İpuçları</h5>
                      <div className="info-grid">
                        <div className="result-item">
                          <strong>💾 Veri Tasarrufu</strong>
                          {result.connection.performanceHints.saveData}
                        </div>
                        <div className="result-item">
                          <strong>📶 Etkili Bağlantı Türü</strong>
                          {result.connection.performanceHints.effectiveType}
                        </div>
                        <div className="result-item">
                          <strong>📡 Downlink Hızı</strong>
                          {result.connection.performanceHints.downlink}
                        </div>
                        <div className="result-item">
                          <strong>⏱️ Round Trip Time</strong>
                          {result.connection.performanceHints.rtt}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Client Hints */}
                  {result.connection.clientHints && (
                    <div className="sub-section">
                      <h5>💡 Client Hints</h5>
                      <div className="info-grid">
                        <div className="result-item">
                          <strong>📏 Viewport Genişlik</strong>
                          {result.connection.clientHints.viewportWidth}
                        </div>
                        <div className="result-item">
                          <strong>🧠 Cihaz Belleği</strong>
                          {result.connection.clientHints.deviceMemory}
                        </div>
                        <div className="result-item">
                          <strong>🖼️ Device Pixel Ratio</strong>
                          {result.connection.clientHints.dpr}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Fingerprint */}
              {result.fingerprint && (
                <div className="detail-info">
                  <h4>🔒 Digital Fingerprint ve Kimlik</h4>
                  <div className="info-grid">
                    <div className="result-item">
                      <strong>🆔 Unique Fingerprint</strong>
                      <code className="fingerprint-code">
                        {result.fingerprint.id}
                      </code>
                    </div>
                    <div className="result-item">
                      <strong>🌐 User Agent Hash</strong>
                      <code className="hash-code">
                        {result.fingerprint.uniqueIdentifiers.userAgentHash}
                      </code>
                    </div>
                    <div className="result-item">
                      <strong>📝 Header Fingerprint</strong>
                      <code className="hash-code">
                        {result.fingerprint.uniqueIdentifiers.headerFingerprint}
                      </code>
                    </div>
                    <div className="result-item">
                      <strong>🗣️ Dil İmzası</strong>
                      {result.fingerprint.uniqueIdentifiers.languageSignature}
                    </div>
                    <div className="result-item">
                      <strong>🖥️ Platform Hint</strong>
                      {result.fingerprint.clientHints.platform}
                    </div>
                    <div className="result-item">
                      <strong>📱 Mobil Durum</strong>
                      {result.fingerprint.clientHints.mobile}
                    </div>
                    <div className="result-item">
                      <strong>🏷️ Tarayıcı Brands</strong>
                      {result.fingerprint.clientHints.brands}
                    </div>
                  </div>
                </div>
              )}

              {/* Analytics */}
              {result.analytics && (
                <div className="detail-info">
                  <h4>📊 Analytics ve Tarayıcı Yetenekleri</h4>
                  <div className="info-grid">
                    <div className="result-item">
                      <strong>⚡ Sayfa Yükleme Süresi</strong>
                      {result.analytics.pageLoadTime}
                    </div>
                    <div className="result-item">
                      <strong>🚀 ES6 JavaScript Desteği</strong>
                      {result.analytics.browserSupport.es6
                        ? "✅ Destekleniyor"
                        : "❌ Desteklenmiyor"}
                    </div>
                    <div className="result-item">
                      <strong>🖼️ WebGL Desteği</strong>
                      {result.analytics.browserSupport.webGL}
                    </div>
                    <div className="result-item">
                      <strong>👆 Dokunmatik Destek</strong>
                      {result.analytics.browserSupport.touchSupport}
                    </div>
                    <div className="result-item">
                      <strong>🔄 Ekran Yönü Desteği</strong>
                      {result.analytics.browserSupport.orientation}
                    </div>
                    <div className="result-item">
                      <strong>🎯 Coğrafi Konum Doğruluğu</strong>
                      {result.analytics.geoAccuracy}
                    </div>
                    <div className="result-item">
                      <strong>🔄 Veri Tazelik Durumu</strong>
                      {result.analytics.dataFreshness}
                    </div>
                    {result.analytics.totalRequestTime && (
                      <div className="result-item">
                        <strong>⏱️ Toplam İstek Süresi</strong>
                        {result.analytics.totalRequestTime}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* IP Range Information */}
              {result.ipRange && (
                <div className="detail-info">
                  <h4>🔢 IP Aralığı ve Ağ Bilgileri</h4>
                  <div className="info-grid">
                    <div className="result-item">
                      <strong>🟢 Aralık Başlangıcı</strong>
                      {result.ipRange.start}
                    </div>
                    <div className="result-item">
                      <strong>🔴 Aralık Sonu</strong>
                      {result.ipRange.end}
                    </div>
                    <div className="result-item">
                      <strong>📊 Toplam IP Sayısı</strong>
                      {result.ipRange.total.toLocaleString("tr-TR")} IP adresi
                    </div>
                    <div className="result-item">
                      <strong>📈 Ağ Büyüklüğü</strong>
                      {result.ipRange.total > 1000000
                        ? "Çok Büyük Ağ"
                        : result.ipRange.total > 100000
                        ? "Büyük Ağ"
                        : result.ipRange.total > 10000
                        ? "Orta Ağ"
                        : "Küçük Ağ"}
                    </div>
                  </div>
                </div>
              )}

              {/* Request Info */}
              {result.requestInfo && (
                <div className="detail-info">
                  <h4>📨 HTTP İstek Detayları</h4>
                  <div className="info-grid">
                    <div className="result-item">
                      <strong>🕐 İstek Zaman Damgası</strong>
                      {new Date(result.requestInfo.timestamp).toLocaleString(
                        "tr-TR"
                      )}
                    </div>
                    <div className="result-item">
                      <strong>🌐 HTTP Metodu</strong>
                      <span className="method-badge">
                        {result.requestInfo.method}
                      </span>
                    </div>
                    <div className="result-item">
                      <strong>🏠 Host Header</strong>
                      {result.requestInfo.headers?.host || "Bilinmiyor"}
                    </div>
                    <div className="result-item">
                      <strong>🔄 İlk İstek Mi?</strong>
                      {result.requestInfo.sessionInfo?.firstRequest
                        ? "✅ Evet"
                        : "❌ Hayır"}
                    </div>
                    <div className="result-item">
                      <strong>📊 İstek Sayacı</strong>
                      {result.requestInfo.sessionInfo?.requestCount || 0}
                    </div>
                    <div className="result-item">
                      <strong>⏰ Son Aktivite</strong>
                      {result.requestInfo.sessionInfo?.lastActivity
                        ? new Date(
                            result.requestInfo.sessionInfo.lastActivity
                          ).toLocaleString("tr-TR")
                        : "Bilinmiyor"}
                    </div>
                    <div className="result-item">
                      <strong>⏱️ Session Süresi</strong>
                      {result.requestInfo.sessionInfo?.sessionDuration || "0ms"}
                    </div>
                    <div className="result-item">
                      <strong>🆔 Session ID</strong>
                      <code className="fingerprint-code">
                        {result.requestInfo.sessionInfo?.sessionId ||
                          "Bilinmiyor"}
                      </code>
                    </div>
                    {result.requestInfo.headers?.origin && (
                      <div className="result-item">
                        <strong>🌐 Origin</strong>
                        {result.requestInfo.headers.origin}
                      </div>
                    )}
                    {result.requestInfo.headers?.accept && (
                      <div className="result-item">
                        <strong>📄 Accept Header</strong>
                        {result.requestInfo.headers.accept.substring(0, 50)}...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Data Quality & Privacy Info */}
              {result.details && (
                <div className="detail-info privacy-info">
                  <h4>🔒 Veri Kalitesi ve Gizlilik</h4>
                  <div className="info-grid">
                    {result.details.provider && (
                      <div className="result-item">
                        <strong>📊 Veri Sağlayıcısı</strong>
                        {result.details.provider}
                      </div>
                    )}
                    {result.details.lastUpdate && (
                      <div className="result-item">
                        <strong>🔄 Son Güncelleme</strong>
                        {result.details.lastUpdate}
                      </div>
                    )}
                    {result.details.dataRetention && (
                      <div className="result-item">
                        <strong>🗃️ Veri Saklama Politikası</strong>
                        {result.details.dataRetention}
                      </div>
                    )}
                    {result.details.privacyLevel && (
                      <div className="result-item">
                        <strong>🔒 Gizlilik Seviyesi</strong>
                        {result.details.privacyLevel}
                      </div>
                    )}
                  </div>
                  {result.details.note && (
                    <div className="privacy-note">
                      <p>
                        📝 <strong>Not:</strong> {result.details.note}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <footer className="footer">
        <div className="footer-content">
          <div className="developer-info">
            <p>
              👨‍💻 <strong>Ali Yılmaz</strong> tarafından geliştirilmiştir
            </p>
            <p>📧 İletişim: okethis@gmail.com | 🌐 GitHub: @aliyilmazco</p>
          </div>
          <div className="privacy-info">
            <p>
              🔒 <strong>Gizliliğiniz önemlidir</strong> - Verileriniz
              saklanmaz, sadece gerçek zamanlı analiz yapılır
            </p>
            <p>
              ⚡ <strong>Gelişmiş GeoIP Servisi</strong> - ISP analizi, cihaz
              tespiti, güvenlik kontrolü, ağ metrikleri ve comprehensive
              fingerprinting ile
            </p>
            <p>
              🌍 <strong>Veri Kaynakları:</strong> geoip-lite, IP-API.com,
              UA-Parser ve çoklu güvenlik kontrolleri
            </p>
          </div>
          <div className="version-info">
            <p>
              📦 Version 1.0.0 | 🚀 Enhanced Edition | ⚡ Real-time Analysis
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

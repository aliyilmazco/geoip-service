"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import Link from "next/link";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

import "swagger-ui-react/swagger-ui.css";

export default function SwaggerPage() {
  const [spec, setSpec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/swagger")
      .then((res) => res.json())
      .then((data) => {
        setSpec(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="docs-loading">
        <div className="loading-content">
          <div className="spinner"></div>
          <p>API Dokümantasyonu Yükleniyor...</p>
        </div>
        <style jsx>{`
          .docs-loading {
            min-height: 100vh;
            background: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
              sans-serif;
          }
          .loading-content {
            text-align: center;
          }
          .spinner {
            width: 64px;
            height: 64px;
            border: 4px solid #e2e8f0;
            border-top: 4px solid #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 16px;
          }
          .loading-content p {
            color: #64748b;
            font-size: 16px;
          }
          @keyframes spin {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="docs-error">
        <div className="error-content">
          <div className="error-icon">❌</div>
          <h2>Dokümantasyon Yüklenemedi</h2>
          <p>{error}</p>
          <Link href="/" className="back-link">
            🏠 Ana Sayfaya Dön
          </Link>
        </div>
        <style jsx>{`
          .docs-error {
            min-height: 100vh;
            background: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
              sans-serif;
          }
          .error-content {
            text-align: center;
            max-width: 400px;
            padding: 20px;
          }
          .error-icon {
            font-size: 48px;
            margin-bottom: 16px;
          }
          .error-content h2 {
            color: #dc2626;
            font-size: 24px;
            margin-bottom: 16px;
            font-weight: bold;
          }
          .error-content p {
            color: #64748b;
            font-size: 16px;
            line-height: 1.5;
            margin-bottom: 24px;
          }
          .back-link {
            display: inline-block;
            padding: 12px 24px;
            background-color: #3b82f6;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 500;
            transition: background-color 0.2s;
          }
          .back-link:hover {
            background-color: #2563eb;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="docs-container">
      {/* Header */}
      <div className="docs-header">
        <div className="header-content">
          <h1>🌍 GeoIP Service API Dokümantasyonu</h1>
          <p>Kapsamlı coğrafi konum ve IP analizi API&apos;si</p>
          <div className="header-links">
            <Link href="/" className="header-link primary">
              🏠 Ana Sayfa
            </Link>
            <Link href="/api/lookup" className="header-link secondary">
              🧪 API Test Et
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="docs-content">
        {/* Quick Start Guide */}
        <div className="quick-start">
          <div className="quick-start-content">
            <strong>💡 Hızlı Başlangıç:</strong> Aşağıdaki{" "}
            <code>/api/lookup</code> endpoint&apos;ini kullanarak mevcut
            IP&apos;nizi analiz edin, veya <code>/api/lookup/8.8.8.8</code> ile
            belirli bir IP adresini analiz edin.
          </div>
        </div>

        {/* Swagger UI Container */}
        {spec && (
          <div className="swagger-container">
            <SwaggerUI
              spec={spec}
              docExpansion="list"
              defaultModelsExpandDepth={2}
              defaultModelExpandDepth={3}
              tryItOutEnabled={true}
              filter={true}
              requestSnippetsEnabled={true}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="docs-footer">
        <div className="footer-content">
          <p>Next.js 15 ile Geliştirildi • Açık Kaynak • MIT Lisansı</p>
          <p>
            🌟 Bu projeyi{" "}
            <a
              href="https://github.com/aliyilmazco/geoip-service"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>{" "}
            üzerinde yıldızlayın
          </p>
        </div>
      </footer>

      <style jsx>{`
        .docs-container {
          min-height: 100vh;
          background: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            sans-serif;
        }

        .docs-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 32px 0;
        }

        .header-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
        }

        .header-content h1 {
          font-size: 36px;
          font-weight: bold;
          margin-bottom: 8px;
          color: white;
        }

        .header-content p {
          font-size: 18px;
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 24px;
        }

        .header-links {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        .header-link {
          display: inline-block;
          padding: 12px 20px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 500;
          transition: all 0.2s;
        }

        .header-link.primary {
          background-color: white;
          color: #667eea;
        }

        .header-link.primary:hover {
          background-color: #f1f5f9;
          transform: translateY(-1px);
        }

        .header-link.secondary {
          background-color: rgba(255, 255, 255, 0.2);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .header-link.secondary:hover {
          background-color: rgba(255, 255, 255, 0.3);
          transform: translateY(-1px);
        }

        .docs-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 32px 24px;
        }

        .quick-start {
          background-color: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 20px;
          margin-bottom: 32px;
          border-radius: 0 8px 8px 0;
        }

        .quick-start-content {
          font-size: 16px;
          color: #92400e;
          line-height: 1.6;
        }

        .quick-start-content strong {
          color: #92400e;
        }

        .quick-start-content code {
          background-color: #fde68a;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 14px;
          font-family: Monaco, Consolas, monospace;
        }

        .swagger-container {
          background-color: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .docs-footer {
          background-color: #f8fafc;
          padding: 32px 0;
          margin-top: 64px;
          border-top: 1px solid #e2e8f0;
        }

        .footer-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
          text-align: center;
          color: #64748b;
        }

        .footer-content p {
          font-size: 16px;
          margin-bottom: 8px;
          color: #64748b;
        }

        .footer-content p:last-child {
          font-size: 14px;
          margin-bottom: 0;
        }

        .footer-content a {
          color: #3b82f6;
          text-decoration: none;
          font-weight: 500;
        }

        .footer-content a:hover {
          text-decoration: underline;
        }
      `}</style>

      <style jsx global>{`
        .swagger-ui {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            sans-serif !important;
        }
        .swagger-ui .topbar {
          display: none !important;
        }
        .swagger-ui .info {
          margin: 20px 0 !important;
        }
        .swagger-ui .info .title {
          color: #1e293b !important;
          font-size: 24px !important;
        }
        .swagger-ui .scheme-container {
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 8px !important;
          margin: 20px 0 !important;
        }
        .swagger-ui .opblock.opblock-get {
          border-color: #10b981 !important;
          background: rgba(16, 185, 129, 0.1) !important;
        }
        .swagger-ui .opblock.opblock-get .opblock-summary {
          border-color: #10b981 !important;
        }
        .swagger-ui .btn.authorize {
          background-color: #3b82f6 !important;
          border-color: #3b82f6 !important;
        }
        .swagger-ui .btn.try-out__btn {
          background-color: #667eea !important;
          border-color: #667eea !important;
        }
        .swagger-ui .response-col_status {
          font-size: 14px !important;
        }
        .swagger-ui .response-col_links {
          display: none !important;
        }
        .swagger-ui .opblock-summary-description {
          font-weight: 500 !important;
        }
        .swagger-ui .parameter__name {
          font-weight: 600 !important;
        }
        .swagger-ui .model-box {
          background: #f8fafc !important;
          border-radius: 8px !important;
        }
      `}</style>
    </div>
  );
}

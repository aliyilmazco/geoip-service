import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "🌍 GeoIP Konum Servisi - Modern IP Adresi Sorgulama",
  description:
    "IP adreslerinin coğrafi konumlarını modern ve güzel bir arayüzle öğrenin. Hızlı, güvenilir ve kullanımı kolay.",
  keywords: ["geoip", "ip lokasyon", "coğrafi konum", "ip sorgulama"],
  authors: [{ name: "GeoIP Service" }],
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌍</text></svg>"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";

import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "GeoIP Service",
  description:
    "A Next.js GeoIP service that presents location, network, device, and risk signals for IP addresses in a professional interface.",
  keywords: ["geoip", "ip lookup", "ip intelligence", "network analysis"],
  authors: [{ name: "GeoIP Service" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ead59d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="icon"
          href="/brand/geoip-service-mark.svg"
          type="image/svg+xml"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

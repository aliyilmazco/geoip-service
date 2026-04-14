import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type HeroAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  external?: boolean;
};

type HeroSignal = {
  label: string;
  value: string;
  hint: string;
};

function HeroActionLink({
  href,
  label,
  variant = "secondary",
  external = false,
}: HeroAction) {
  const className = `button button-${variant}`;

  if (external) {
    return (
      <a
        href={href}
        className={className}
        target="_blank"
        rel="noopener noreferrer"
      >
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

export function BrandMark() {
  return (
    <div className="brand-lockup" aria-label="GeoIP Service">
      <span className="brand-mark" aria-hidden="true">
        <Image
          src="/brand/geoip-service-mark.svg"
          alt=""
          width={48}
          height={48}
          className="brand-mark-image"
          priority
        />
      </span>
      <div className="brand-copy">
        <span className="brand-name">GeoIP Service</span>
        <span className="brand-caption">Real-time IP intelligence</span>
      </div>
    </div>
  );
}

export function PageHero({
  className,
  eyebrow,
  title,
  description,
  actions,
  signals,
  aside,
}: {
  className?: string;
  eyebrow: string;
  title: string;
  description: string;
  actions: HeroAction[];
  signals: HeroSignal[];
  aside?: ReactNode;
}) {
  return (
    <section
      className={["hero-panel", className].filter(Boolean).join(" ")}
    >
      <div className="hero-grid">
        <div className="hero-copy-column">
          <BrandMark />
          <div className="title-stack">
            <span className="eyebrow">{eyebrow}</span>
            <h1 className="hero-title">{title}</h1>
            <p className="hero-description">{description}</p>
          </div>
          <div className="hero-actions">
            {actions.map((action) => (
              <HeroActionLink key={`${action.href}-${action.label}`} {...action} />
            ))}
          </div>
        </div>

        <div className="hero-aside">
          <div className="signal-grid">
            {signals.map((signal) => (
              <article
                key={`${signal.label}-${signal.value}`}
                className="signal-card"
              >
                <span className="signal-label">{signal.label}</span>
                <strong className="signal-value">{signal.value}</strong>
                <span className="signal-hint">{signal.hint}</span>
              </article>
            ))}
          </div>
          {aside}
        </div>
      </div>
    </section>
  );
}

export function PageFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-lead">
          <span className="footer-kicker">GeoIP Service</span>
          <h2 className="footer-title">
            Gather IP, DNS, and website signals into a cleaner final layer.
          </h2>
          <p className="footer-copy">
            GeoIP Service brings IP, device, and risk signals into a single clear
            interface. The technical depth stays intact, but the reading flow is
            easier to follow.
          </p>
          <div className="footer-badges" aria-label="Service highlights">
            <span className="footer-badge">IP + website</span>
            <span className="footer-badge">Real-time lookup</span>
            <span className="footer-badge">JSON + Swagger</span>
          </div>
        </div>

        <div className="footer-card">
          <span className="footer-label">Product</span>
          <p className="footer-copy">
            With a single lookup input, you can read IP location, network detail,
            DNS, HTTP, and TLS layers together.
          </p>
          <div className="footer-meta-list">
            <span>Single input field</span>
            <span>Progressive detail panels</span>
            <span>Fast summary view</span>
          </div>
        </div>

        <div className="footer-card">
          <span className="footer-label">Privacy</span>
          <p className="footer-copy">
            Results are generated on demand. The interface does not suggest a
            persistent logging or dashboard retention flow.
          </p>
          <div className="footer-meta-list">
            <span>No persistent dashboard flow</span>
            <span>Request-based analysis</span>
            <span>Result-focused interface</span>
          </div>
        </div>

        <div className="footer-links-card">
          <span className="footer-label">Links</span>
          <div className="footer-link-list">
            <Link href="/docs" className="footer-link-card">
              <strong>API Documentation</strong>
              <span>Endpoints, parameters, and sample responses</span>
            </Link>
            <a
              href="https://github.com/aliyilmazco/geoip-service"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link-card"
            >
              <strong>GitHub</strong>
              <span>Codebase, development flow, and issue tracking</span>
            </a>
            <a
              href="https://aliyilmaz.co"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link-card"
            >
              <strong>aliyilmaz.co</strong>
              <span>Publisher profile and links to other products</span>
            </a>
          </div>
        </div>
      </div>

      <div className="footer-bar">
        <span>GeoIP Service</span>
        <span>Delivers IP, DNS, HTTP, and TLS signals in one stream.</span>
      </div>
    </footer>
  );
}

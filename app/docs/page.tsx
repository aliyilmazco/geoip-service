"use client";

import { useEffect, useState } from "react";

import { PageFooter, PageHero } from "@/components/site-chrome";
import { SwaggerUIEmbed } from "@/components/swagger-ui-embed";

import "swagger-ui-react/swagger-ui.css";

export default function SwaggerPage() {
  const [spec, setSpec] = useState<object | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSpec() {
      try {
        const response = await fetch("/api/swagger");
        if (!response.ok) {
          const retryAfterSeconds = Number.parseInt(
            response.headers.get("retry-after") || "",
            10
          );
          if (response.status === 429 && Number.isFinite(retryAfterSeconds)) {
            throw new Error(
              `Documentation requests are temporarily throttled. Try again in ${retryAfterSeconds} seconds.`
            );
          }

          throw new Error(`Could not load the documentation: ${response.status}`);
        }

        const nextSpec = (await response.json()) as object;
        if (!active) {
          return;
        }

        setSpec(nextSpec);
      } catch (requestError) {
        if (!active) {
          return;
        }

        setError((requestError as Error).message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSpec();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="site-shell">
      <div className="content-stack">
        <PageHero
          eyebrow="Documentation workspace"
          title="Test endpoints without losing the path."
          description="This page separates IP and website endpoints with quick cards. Choose the right route first, then move into the live Swagger experience."
          actions={[
            { href: "/", label: "Back to Home", variant: "primary" },
            { href: "/api/lookup", label: "Raw Endpoint", variant: "secondary" },
          ]}
          signals={[
            {
              label: "Starting point",
              value: "4 primary entries",
              hint: "Current IP, target lookup, path route, and spec",
            },
            {
              label: "Testing mode",
              value: "Try it out ready",
              hint: "You can send live requests",
            },
            {
              label: "Raw source",
              value: "OpenAPI JSON",
              hint: "Served from the same backend as Swagger",
            },
          ]}
          aside={
            <div className="hero-note">
              <span className="hero-note-label">Recommended order</span>
              <p>
                Start with the route cards above. Then use the Swagger area below
                to submit IP or website targets and inspect the live response shape.
              </p>
            </div>
          }
        />

        {loading ? (
          <section className="state-panel" aria-live="polite">
            <div className="loading-spinner" aria-hidden="true" />
            <div className="title-stack">
              <span className="eyebrow">Documentation</span>
              <h2 className="state-title">Loading Swagger spec</h2>
              <p className="state-copy">
                The OpenAPI document is being fetched and prepared for the UI.
              </p>
            </div>
          </section>
        ) : null}

        {!loading && error ? (
          <section className="state-panel state-panel-danger" aria-live="assertive">
            <div className="title-stack">
              <span className="eyebrow">Documentation error</span>
              <h2 className="state-title">Could not read the spec file</h2>
              <p className="state-copy">{error}</p>
            </div>
          </section>
        ) : null}

        {!loading && !error && spec ? (
          <>
            <section className="panel docs-panel">
              <div className="panel-header">
                <div className="title-stack">
                  <span className="eyebrow">Quick start</span>
                  <h2 className="panel-title">The fastest four entry points</h2>
                </div>
                <p className="panel-description">
                  Pick the right endpoint here first. The live Swagger flow below
                  follows the same structure.
                </p>
              </div>

              <div className="docs-quick-grid">
                <article className="docs-card">
                  <span className="docs-card-label">Browser lookup</span>
                  <code>GET /api/lookup</code>
                  <p>Analyzes the current client IP in a single step.</p>
                </article>
                <article className="docs-card">
                  <span className="docs-card-label">Target lookup</span>
                  <code>GET /api/lookup?target=...</code>
                  <p>
                    Single entry point for IPs, domains, or full URLs. The server
                    auto-detects the target type.
                  </p>
                </article>
                <article className="docs-card">
                  <span className="docs-card-label">Path compatibility</span>
                  <code>GET /api/lookup/[...target]</code>
                  <p>
                    Compatibility route for manual path usage; it still separates
                    IP and website targets automatically.
                  </p>
                </article>
                <article className="docs-card">
                  <span className="docs-card-label">Fetch spec</span>
                  <code>GET /api/swagger</code>
                  <p>
                    Returns the OpenAPI JSON source used by Swagger UI and other clients.
                  </p>
                </article>
              </div>
            </section>

            <section className="panel swagger-panel">
              <div className="panel-header">
                <div className="title-stack">
                  <span className="eyebrow">Live documentation</span>
                  <h2 className="panel-title">Swagger UI</h2>
                </div>
                <p className="panel-description">
                  Use the route cards above as a guide. This area is reserved for
                  live testing, schema inspection, and response review.
                </p>
              </div>

              <div className="swagger-shell">
                <SwaggerUIEmbed spec={spec} />
              </div>
            </section>
          </>
        ) : null}

        <PageFooter />
      </div>
    </div>
  );
}

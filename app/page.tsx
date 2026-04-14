"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  LookupResults,
  type LocationData,
} from "@/components/geoip-result-view";
import { PageFooter, PageHero } from "@/components/site-chrome";

const SAMPLE_TARGETS = [
  "aliyilmaz.co",
  "example.com",
  "https://openai.com",
];
const CURRENT_IP_LOOKUP_KEY = "__current_ip__";
const GLOBAL_LOOKUP_COOLDOWN_MS = 1500;
const SAME_TARGET_LOOKUP_COOLDOWN_MS = 8000;

type LookupIntent = {
  key: string;
  path: string;
};

type LookupHistoryEntry = {
  key: string;
  startedAt: number;
};

async function parseLookupResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as LocationData;
  }

  const fallbackMessage = await response.text();
  return {
    status: "error",
    lookupType: "ip",
    query: "",
    ip: "",
    error: fallbackMessage || `Request failed: ${response.status}`,
    details: {
      reason: "Unexpected non-JSON response",
      explanation: "The server returned a response that could not be parsed as JSON.",
      recommendations: ["Retry the request"],
    },
  } satisfies LocationData;
}

function normalizeLookupKey(target?: string) {
  const normalized = target?.trim().toLowerCase();
  return normalized || CURRENT_IP_LOOKUP_KEY;
}

function getRetryAfterSeconds(response: Response, data: LocationData) {
  const retryAfterHeader = Number.parseInt(
    response.headers.get("retry-after") || "",
    10
  );

  if (Number.isFinite(retryAfterHeader) && retryAfterHeader > 0) {
    return retryAfterHeader;
  }

  if (typeof data.rateLimit?.retryAfterSeconds === "number") {
    return data.rateLimit.retryAfterSeconds;
  }

  if (
    data.details &&
    typeof data.details === "object" &&
    "retryAfterSeconds" in data.details &&
    typeof data.details.retryAfterSeconds === "number"
  ) {
    return data.details.retryAfterSeconds;
  }

  if (
    data.details &&
    typeof data.details === "object" &&
    "rateLimit" in data.details &&
    data.details.rateLimit &&
    typeof data.details.rateLimit === "object" &&
    "retryAfterSeconds" in data.details.rateLimit &&
    typeof data.details.rateLimit.retryAfterSeconds === "number"
  ) {
    return data.details.rateLimit.retryAfterSeconds;
  }

  return undefined;
}

function buildResponseErrorMessage(data: LocationData, status: number) {
  if (data.error) {
    return data.error;
  }

  if (
    data.details &&
    typeof data.details === "object" &&
    "reason" in data.details &&
    typeof data.details.reason === "string"
  ) {
    return data.details.reason;
  }

  return `Request failed: ${status}`;
}

function formatCooldownMessage(seconds: number, repeatedTarget: boolean) {
  if (repeatedTarget) {
    return `The same target was just analyzed. Wait ${seconds} seconds before repeating it.`;
  }

  return `Wait ${seconds} seconds before starting another lookup.`;
}

function formatRateLimitMessage(data: LocationData, retryAfterSeconds: number) {
  const baseMessage = data.error?.trim() || "Too many requests";
  return `${baseMessage}. Try again in ${retryAfterSeconds} seconds.`;
}

export default function Home() {
  const [ipInput, setIpInput] = useState("");
  const [result, setResult] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownMessage, setCooldownMessage] = useState("");
  const [cooldownNow, setCooldownNow] = useState(() => Date.now());

  const abortControllerRef = useRef<AbortController | null>(null);
  const autoLookupStartedRef = useRef(false);
  const lastLookupRef = useRef<LookupHistoryEntry | null>(null);
  const requestSequenceRef = useRef(0);

  const cooldownRemainingMs = cooldownUntil
    ? Math.max(0, cooldownUntil - cooldownNow)
    : 0;
  const cooldownRemainingSeconds = Math.ceil(cooldownRemainingMs / 1000);
  const actionsDisabled = loading || cooldownRemainingMs > 0;

  const applyCooldown = useCallback((durationMs: number, message: string) => {
    const nextCooldownUntil = Date.now() + durationMs;

    setCooldownUntil((current) =>
      current ? Math.max(current, nextCooldownUntil) : nextCooldownUntil
    );
    setCooldownMessage(message);
    setCooldownNow(Date.now());
  }, []);

  const performLookup = useCallback(
    async (intent: LookupIntent) => {
      const now = Date.now();
      const lastLookup = lastLookupRef.current;

      if (lastLookup) {
        const repeatedTarget = lastLookup.key === intent.key;
        const requiredCooldownMs = repeatedTarget
          ? SAME_TARGET_LOOKUP_COOLDOWN_MS
          : GLOBAL_LOOKUP_COOLDOWN_MS;
        const remainingMs = lastLookup.startedAt + requiredCooldownMs - now;

        if (remainingMs > 0) {
          const message = formatCooldownMessage(
            Math.ceil(remainingMs / 1000),
            repeatedTarget
          );

          applyCooldown(remainingMs, message);
          setError(message);
          return;
        }
      }

      const requestId = requestSequenceRef.current + 1;
      requestSequenceRef.current = requestId;
      lastLookupRef.current = {
        key: intent.key,
        startedAt: now,
      };

      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setLoading(true);
      setError("");
      setResult(null);
      setCooldownUntil(null);
      setCooldownMessage("");

      try {
        const response = await fetch(intent.path, {
          signal: abortController.signal,
          cache: "no-store",
        });
        const data = await parseLookupResponse(response);

        if (requestId !== requestSequenceRef.current) {
          return;
        }

        if (response.status === 429) {
          const retryAfterSeconds = getRetryAfterSeconds(response, data) || 5;
          const message = formatRateLimitMessage(data, retryAfterSeconds);

          applyCooldown(retryAfterSeconds * 1000, message);
          setResult(null);
          setError(message);
          return;
        }

        if (!response.ok) {
          setResult(null);
          setError(buildResponseErrorMessage(data, response.status));
          return;
        }

        setResult(data);
      } catch (requestError) {
        if ((requestError as Error).name === "AbortError") {
          return;
        }

        if (requestId !== requestSequenceRef.current) {
          return;
        }

        setResult(null);
        setError(
          "An error occurred while connecting to the server: " +
            (requestError as Error).message
        );
      } finally {
        if (requestId === requestSequenceRef.current) {
          setLoading(false);

          if (abortControllerRef.current === abortController) {
            abortControllerRef.current = null;
          }
        }
      }
    },
    [applyCooldown]
  );

  const lookupMyIp = useCallback(async () => {
    await performLookup({
      key: CURRENT_IP_LOOKUP_KEY,
      path: "/api/lookup",
    });
  }, [performLookup]);

  const lookupCustomTarget = useCallback(
    async (target: string) => {
      await performLookup({
        key: normalizeLookupKey(target),
        path: `/api/lookup?target=${encodeURIComponent(target)}`,
      });
    },
    [performLookup]
  );

  useEffect(() => {
    if (autoLookupStartedRef.current) {
      return undefined;
    }

    autoLookupStartedRef.current = true;

    const timer = window.setTimeout(() => {
      void lookupMyIp();
    }, 250);

    return () => {
      window.clearTimeout(timer);
      requestSequenceRef.current += 1;
      abortControllerRef.current?.abort();
    };
  }, [lookupMyIp]);

  useEffect(() => {
    if (!cooldownUntil) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setCooldownNow(Date.now());
    }, 250);

    return () => window.clearInterval(interval);
  }, [cooldownUntil]);

  useEffect(() => {
    if (!cooldownUntil || cooldownRemainingMs > 0) {
      return;
    }

    setCooldownUntil(null);
    setCooldownMessage("");
  }, [cooldownRemainingMs, cooldownUntil]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextIp = ipInput.trim();
    if (!nextIp) {
      setResult(null);
      setError("Enter the IP address or website you want to analyze.");
      return;
    }

    void lookupCustomTarget(nextIp);
  }

  function handleClear() {
    requestSequenceRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIpInput("");
    setResult(null);
    setError("");
    setLoading(false);
  }

  function handleExampleClick(value: string) {
    setIpInput(value);
    setError("");
    void lookupCustomTarget(value);
  }

  return (
    <div className="site-shell">
      <div className="content-stack">
        <PageHero
          className="hero-panel-compact"
          eyebrow="IP + website intelligence"
          title="Read IP and website signals faster."
          description="IP lookups surface location and network data first, while website checks lead with DNS, HTTP, and TLS."
          actions={[
            { href: "/docs", label: "API Documentation", variant: "primary" },
            {
              href: "https://github.com/aliyilmazco/geoip-service",
              label: "Source Code",
              variant: "secondary",
              external: true,
            },
          ]}
          signals={[
            {
              label: "Entry point",
              value: "IP or website",
              hint: "Single field, two modes",
            },
            {
              label: "Detail model",
              value: "Layered detail",
              hint: "Deep panels stay collapsed",
            },
            {
              label: "API surface",
              value: "Docs + JSON",
              hint: "Swagger and raw routes together",
            },
          ]}
          aside={
            <div className="hero-note">
              <span className="hero-note-label">Recommended flow</span>
              <p>
                Enter an IP, domain, or URL. Read the summary first, then expand
                the deeper panels only when needed.
              </p>
            </div>
          }
        />

        <section className="panel lookup-panel">
          <div className="panel-header">
            <div className="title-stack">
              <span className="eyebrow">Lookup</span>
              <h2 className="panel-title">Analyze an IP address or website</h2>
            </div>
            <p className="panel-description">
              Start with a single query. The system classifies the target
              automatically, then the results view reveals the core interpretation
              before the deeper technical detail.
            </p>
          </div>

          <div className="lookup-layout">
            <form className="search-form" onSubmit={handleSubmit}>
              <label htmlFor="ip-input" className="field-label">
                IP address or website
              </label>
              <div className="search-row">
                <input
                  id="ip-input"
                  type="text"
                  value={ipInput}
                  onChange={(event) => setIpInput(event.target.value)}
                  placeholder="Example: aliyilmaz.co, example.com, or https://openai.com"
                  className="text-input"
                  disabled={loading}
                />
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={actionsDisabled}
                >
                  {cooldownRemainingMs > 0
                    ? `Wait ${cooldownRemainingSeconds}s`
                    : "Start analysis"}
                </button>
              </div>
              <p className="field-hint">
                The target is classified first, then the matching IP or website
                analysis runs on the server so you can observe the real API behavior.
              </p>
              {cooldownRemainingMs > 0 ? (
                <p className="field-hint cooldown-hint" role="status" aria-live="polite">
                  {cooldownMessage ||
                    `Requests are temporarily throttled. Try again in ${cooldownRemainingSeconds} seconds.`}
                </p>
              ) : null}
            </form>

            <div className="lookup-sidecar">
              <div>
                <span className="helper-label">Quick examples</span>
                <div className="chip-row">
                  {SAMPLE_TARGETS.map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      className="chip-button"
                      disabled={actionsDisabled}
                      onClick={() => handleExampleClick(sample)}
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lookup-helper-card">
                <span className="helper-label">What will you see?</span>
                <p className="helper-copy">
                  IP analysis surfaces location, risk, and provider signals.
                  Website analysis highlights the final URL, transport, risk, and
                  resolved IP summary, while deep HTTP, TLS, and technical details
                  stay collapsed below.
                </p>
              </div>

              <div className="action-row">
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={actionsDisabled}
                  onClick={() => void lookupMyIp()}
                >
                  {cooldownRemainingMs > 0
                    ? `Retry in ${cooldownRemainingSeconds}s`
                    : "Analyze current IP"}
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={handleClear}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <section className="state-panel" aria-live="polite">
            <div className="loading-spinner" aria-hidden="true" />
            <div className="title-stack">
              <span className="eyebrow">Live request</span>
              <h2 className="state-title">GeoIP analysis in progress</h2>
              <p className="state-copy">
                Location, risk, DNS, HTTP, and network signals are being prepared
                for the selected target.
              </p>
            </div>
          </section>
        ) : null}

        {!loading && error ? (
          <section className="state-panel state-panel-danger" aria-live="assertive">
            <div className="title-stack">
              <span className="eyebrow">Request error</span>
              <h2 className="state-title">Could not retrieve a server response</h2>
              <p className="state-copy">{error}</p>
            </div>
          </section>
        ) : null}

        {!loading && result ? <LookupResults result={result} /> : null}

        {!loading && !error && !result ? (
          <section className="state-panel state-panel-muted">
            <div className="title-stack">
              <span className="eyebrow">Empty state</span>
              <h2 className="state-title">Start a new lookup</h2>
              <p className="state-copy">
                Enter an IP address, domain, or URL, choose one of the examples,
                or analyze your current IP again.
              </p>
            </div>
          </section>
        ) : null}

        <PageFooter />
      </div>
    </div>
  );
}

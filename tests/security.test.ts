import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { assertPublicWebsiteUrl, enforceRateLimit } from "../lib/security";

test("assertPublicWebsiteUrl rejects localhost and loopback targets", async () => {
  await assert.rejects(() => assertPublicWebsiteUrl("http://127.0.0.1"), {
    code: "TARGET_NOT_ALLOWED",
  });

  await assert.rejects(() => assertPublicWebsiteUrl("http://[::1]"), {
    code: "TARGET_NOT_ALLOWED",
  });
});

test("enforceRateLimit returns a structured 429 response", async () => {
  let result:
    | ReturnType<typeof enforceRateLimit>
    | undefined;

  for (let index = 0; index < 21; index += 1) {
    result = enforceRateLimit(
      new NextRequest("http://localhost:3001/api/lookup", {
        headers: {
          accept: "application/json",
          "accept-encoding": "gzip, deflate, br",
          "accept-language": "en-US,en;q=0.9",
          host: "localhost:3001",
          "user-agent": "rate-limit-test-suite",
          cookie: "geoip_rlid=cccccccccccccccccccccccccccccccc",
        },
      }),
      {
      subject: "lookup",
      }
    );
  }

  assert.ok(result);
  assert.equal(result.allowed, false);

  if (result.allowed) {
    assert.fail("Expected rate limit to block the request");
  }

  assert.equal(result.response.status, 429);

  const body = (await result.response.json()) as {
    details?: { code?: string; rateLimit?: { remaining?: number } };
    error?: string;
    rateLimit?: { remaining?: number };
  };

  assert.equal(body.error, "Too many requests");
  assert.equal(body.details?.code, "RATE_LIMITED");
  assert.equal(body.rateLimit?.remaining, 0);
});

test("enforceRateLimit isolates anonymous clients with distinct fallback cookies", () => {
  const buildRequest = (cookie: string) =>
    new NextRequest("http://localhost:3001/api/lookup", {
      headers: {
        accept: "application/json",
        "accept-encoding": "gzip, deflate, br",
        "accept-language": "en-US,en;q=0.9",
        host: "localhost:3001",
        "user-agent": "rate-limit-cookie-fallback-test",
        cookie,
      },
    });

  for (let index = 0; index < 20; index += 1) {
    const result = enforceRateLimit(buildRequest("geoip_rlid=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), {
      subject: "lookup",
    });

    assert.equal(result.allowed, true);
  }

  const otherClient = enforceRateLimit(
    buildRequest("geoip_rlid=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
    {
      subject: "lookup",
    }
  );

  assert.equal(otherClient.allowed, true);
});

test("enforceRateLimit assigns a dedicated anonymous fallback cookie when no client IP exists", () => {
  const result = enforceRateLimit(
    new NextRequest("http://localhost:3001/api/lookup?target=example.com", {
      headers: {
        accept: "application/json",
        "accept-encoding": "gzip, deflate, br",
        "accept-language": "en-US,en;q=0.9",
        host: "localhost:3001",
        "user-agent": "rate-limit-cookie-issued-test",
      },
    }),
    {
      subject: "lookup",
      target: "example.com",
    }
  );

  assert.equal(result.allowed, true);
  assert.match(
    result.headers["Set-Cookie"] || "",
    /^geoip_rlid=[a-f0-9]{32}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=31536000$/
  );
});

test("enforceRateLimit blocks repeated anonymous requests without cookies", () => {
  const buildRequest = () =>
    new NextRequest("http://localhost:3001/api/lookup", {
      headers: {
        accept: "application/json",
        "accept-encoding": "gzip, deflate, br",
        "accept-language": "en-US,en;q=0.9",
        host: "localhost:3001",
        "user-agent": "rate-limit-stateless-client-test",
      },
    });

  const first = enforceRateLimit(buildRequest(), {
    subject: "lookup",
  });
  const second = enforceRateLimit(buildRequest(), {
    subject: "lookup",
  });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(first.headers["Set-Cookie"], second.headers["Set-Cookie"]);

  let result:
    | ReturnType<typeof enforceRateLimit>
    | undefined = second;

  for (let index = 0; index < 19; index += 1) {
    result = enforceRateLimit(buildRequest(), {
      subject: "lookup",
    });
  }

  assert.ok(result);
  assert.equal(result.allowed, false);
});

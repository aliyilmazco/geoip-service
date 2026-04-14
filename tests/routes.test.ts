import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { GET as lookupRouteGet } from "../app/api/lookup/route";
import { GET as lookupPathRouteGet } from "../app/api/lookup/[...target]/route";

test("current lookup route returns request metadata and structured error payload", async () => {
  const response = await lookupRouteGet(
    new NextRequest("http://localhost:3001/api/lookup", {
      headers: {
        accept: "application/json",
        host: "localhost:3001",
        "user-agent": "route-current-ip-test",
      },
    })
  );

  assert.equal(response.status, 200);
  assert.ok(response.headers.get("x-request-id"));

  const body = (await response.json()) as {
    lookupType: string;
    requestId?: string;
    status?: string;
    error?: string;
  };

  assert.equal(body.lookupType, "ip");
  assert.ok(body.requestId);
  assert.ok(body.status);
  assert.ok(body.error);
});

test("lookup route blocks private website targets with structured details", async () => {
  const response = await lookupRouteGet(
    new NextRequest(
      "http://localhost:3001/api/lookup?target=http%3A%2F%2F127.0.0.1",
      {
        headers: {
          accept: "application/json",
          host: "localhost:3001",
          "user-agent": "route-blocked-website-test",
        },
      }
    )
  );

  assert.equal(response.status, 400);
  const body = (await response.json()) as {
    details?: { code?: string };
    error?: string;
    lookupType?: string;
  };

  assert.equal(body.lookupType, "website");
  assert.equal(body.error, "This target is not allowed for website probing.");
  assert.equal(body.details?.code, "TARGET_NOT_ALLOWED");
});

test("path lookup route reconstructs blocked URL targets safely", async () => {
  const response = await lookupPathRouteGet(
    new NextRequest("http://localhost:3001/api/lookup/http%3A/127.0.0.1", {
      headers: {
        accept: "application/json",
        host: "localhost:3001",
        "user-agent": "route-path-blocked-test",
      },
    }),
    {
      params: Promise.resolve({
        target: ["http:", "127.0.0.1"],
      }),
    }
  );

  assert.equal(response.status, 400);
  const body = (await response.json()) as {
    normalizedTarget?: string;
    details?: { code?: string };
  };

  assert.equal(body.normalizedTarget, "http://127.0.0.1/");
  assert.equal(body.details?.code, "TARGET_NOT_ALLOWED");
});

test("path lookup route preserves encoded slashes inside URL path segments", async () => {
  const response = await lookupPathRouteGet(
    new NextRequest("http://localhost:3001/api/lookup/http%3A/127.0.0.1/a%252Fb", {
      headers: {
        accept: "application/json",
        host: "localhost:3001",
        "user-agent": "route-path-encoded-slash-test",
      },
    }),
    {
      params: Promise.resolve({
        target: ["http%3A", "127.0.0.1", "a%2Fb"],
      }),
    }
  );

  assert.equal(response.status, 400);
  const body = (await response.json()) as {
    normalizedTarget?: string;
    details?: { code?: string };
  };

  assert.equal(body.normalizedTarget, "http://127.0.0.1/a%2Fb");
  assert.equal(body.details?.code, "TARGET_NOT_ALLOWED");
});

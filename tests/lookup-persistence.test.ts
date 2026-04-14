import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { GET as lookupRouteGet } from "../app/api/lookup/route";
import { GET as lookupPathRouteGet } from "../app/api/lookup/[...target]/route";
import {
  persistLookupObservation,
  setLookupPersistenceWriterForTests,
  type LookupPersistenceRecord,
} from "../lib/lookup-log-store";

test(
  "target lookup route persists successful IP lookups",
  { concurrency: false },
  async (t) => {
    const writes: LookupPersistenceRecord[] = [];
    setLookupPersistenceWriterForTests(async (record) => {
      writes.push(record);
    });
    t.after(() => {
      setLookupPersistenceWriterForTests(null);
    });

    const response = await lookupRouteGet(
      new NextRequest("http://localhost:3001/api/lookup?target=8.8.8.8", {
        headers: {
          accept: "application/json",
          host: "localhost:3001",
          "user-agent": "lookup-persistence-ip-test",
        },
      })
    );

    assert.equal(response.status, 200);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].log.routeKind, "query");
    assert.equal(writes[0].log.rawTarget, "8.8.8.8");
    assert.equal(writes[0].log.lookupType, "ip");
    assert.equal(writes[0].log.resolvedIp, "8.8.8.8");
    assert.equal(writes[0].log.httpStatus, 200);
    assert.match(writes[0].log.responseJson, /"ip":"8\.8\.8\.8"/);
    assert.ok(writes[0].inventory);
    assert.equal(writes[0].inventory?.ip, "8.8.8.8");
    assert.equal(writes[0].inventory?.relatedResolvedIpsJson, '["8.8.8.8"]');
  }
);

test(
  "bare current IP lookups are not persisted",
  { concurrency: false },
  async (t) => {
    const writes: LookupPersistenceRecord[] = [];
    setLookupPersistenceWriterForTests(async (record) => {
      writes.push(record);
    });
    t.after(() => {
      setLookupPersistenceWriterForTests(null);
    });

    const response = await lookupRouteGet(
      new NextRequest("http://localhost:3001/api/lookup", {
        headers: {
          accept: "application/json",
          host: "localhost:3001",
          "user-agent": "lookup-persistence-current-test",
        },
      })
    );

    assert.equal(response.status, 200);
    assert.equal(writes.length, 0);
  }
);

test(
  "website inventory payload keeps only the primary row and carries related resolved IPs",
  { concurrency: false },
  async (t) => {
    const writes: LookupPersistenceRecord[] = [];
    setLookupPersistenceWriterForTests(async (record) => {
      writes.push(record);
    });
    t.after(() => {
      setLookupPersistenceWriterForTests(null);
    });

    await persistLookupObservation({
      context: {
        clientIp: "203.0.113.10",
        requestId: "req-website-1",
        timestamp: "2026-04-13T12:00:00.000Z",
        userAgent: "website-persistence-test",
      },
      routeKind: "query",
      rawTarget: "example.com",
      httpStatus: 200,
      responseBody: {
        status: "ok",
        lookupType: "website",
        query: "example.com",
        normalizedTarget: "https://example.com/",
        ip: "93.184.216.34",
        country: "US",
        countryName: "United States",
        city: "Los Angeles",
        region: "California",
        timezone: "America/Los_Angeles",
        isp: {
          isp: "Primary ISP",
          organization: "Primary Org",
          asn: "AS15133",
        },
        website: {
          url: "https://example.com/",
          hostname: "example.com",
          protocol: "https",
          resolvedIps: [
            {
              ip: "203.0.113.20",
              country: "DE",
              countryName: "Germany",
              city: "Frankfurt",
              region: "Hesse",
              timezone: "Europe/Berlin",
              isp: {
                isp: "Secondary ISP",
                organization: "Secondary Org",
                asn: "AS64502",
              },
            },
            {
              ip: "93.184.216.34",
              country: "US",
              countryName: "United States",
              city: "Los Angeles",
              region: "California",
              timezone: "America/Los_Angeles",
              isp: {
                isp: "Primary ISP",
                organization: "Primary Org",
                asn: "AS15133",
              },
            },
          ],
          summary: {
            primarySignal: "Example Domain",
          },
        },
      },
    });

    assert.equal(writes.length, 1);
    assert.equal(writes[0].log.lookupType, "website");
    assert.equal(writes[0].log.resolvedIp, "93.184.216.34");
    assert.equal(writes[0].log.normalizedTarget, "https://example.com/");
    assert.ok(writes[0].inventory);
    assert.equal(writes[0].inventory?.ip, "93.184.216.34");
    assert.equal(
      writes[0].inventory?.relatedResolvedIpsJson,
      '["203.0.113.20","93.184.216.34"]'
    );

    const payload = JSON.parse(writes[0].inventory?.responseJson || "{}") as {
      ip?: string;
      relatedResolvedIps?: string[];
      websiteContext?: { hostname?: string };
      isp?: { isp?: string; organization?: string; asn?: string };
    };

    assert.equal(payload.ip, "93.184.216.34");
    assert.deepEqual(payload.relatedResolvedIps, [
      "203.0.113.20",
      "93.184.216.34",
    ]);
    assert.equal(payload.websiteContext?.hostname, "example.com");
    assert.equal(payload.isp?.isp, "Primary ISP");
    assert.equal(payload.isp?.organization, "Primary Org");
    assert.equal(payload.isp?.asn, "AS15133");
    assert.doesNotMatch(writes[0].inventory?.responseJson || "", /"resolvedIps":/);
  }
);

test(
  "path lookup route persists blocked website targets as errors",
  { concurrency: false },
  async (t) => {
    const writes: LookupPersistenceRecord[] = [];
    setLookupPersistenceWriterForTests(async (record) => {
      writes.push(record);
    });
    t.after(() => {
      setLookupPersistenceWriterForTests(null);
    });

    const response = await lookupPathRouteGet(
      new NextRequest("http://localhost:3001/api/lookup/http%3A/127.0.0.1", {
        headers: {
          accept: "application/json",
          host: "localhost:3001",
          "user-agent": "lookup-persistence-path-test",
        },
      }),
      {
        params: Promise.resolve({
          target: ["http:", "127.0.0.1"],
        }),
      }
    );

    assert.equal(response.status, 400);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].log.routeKind, "path");
    assert.equal(writes[0].log.rawTarget, "http://127.0.0.1");
    assert.equal(writes[0].log.lookupType, "website");
    assert.equal(writes[0].log.resolvedIp, null);
    assert.equal(writes[0].log.errorCode, "TARGET_NOT_ALLOWED");
    assert.equal(writes[0].inventory, null);
  }
);

test(
  "lookup responses stay successful when persistence fails",
  { concurrency: false },
  async (t) => {
    setLookupPersistenceWriterForTests(async () => {
      throw new Error("forced persistence failure");
    });
    t.after(() => {
      setLookupPersistenceWriterForTests(null);
    });

    const response = await lookupRouteGet(
      new NextRequest("http://localhost:3001/api/lookup?target=8.8.8.8", {
        headers: {
          accept: "application/json",
          host: "localhost:3001",
          "user-agent": "lookup-persistence-failure-test",
        },
      })
    );

    const body = (await response.json()) as {
      ip?: string;
      lookupType?: string;
    };

    assert.equal(response.status, 200);
    assert.equal(body.lookupType, "ip");
    assert.equal(body.ip, "8.8.8.8");
  }
);

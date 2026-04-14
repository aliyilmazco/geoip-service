import assert from "node:assert/strict";
import test from "node:test";

import { getTlsInfo, resolveDnsRecords, withTimeout } from "../lib/website-analysis";

test("resolveDnsRecords strips IPv6 brackets before DNS and lookup enrichment", async () => {
  const seenHostnames: string[] = [];
  const resolver = {
    resolve4: async (hostname: string) => {
      seenHostnames.push(hostname);
      return [];
    },
    resolve6: async (hostname: string) => {
      seenHostnames.push(hostname);
      return ["2606:4700:4700::1111"];
    },
    resolveCname: async (hostname: string) => {
      seenHostnames.push(hostname);
      return [];
    },
    resolveNs: async (hostname: string) => {
      seenHostnames.push(hostname);
      return [];
    },
    resolveMx: async (hostname: string) => {
      seenHostnames.push(hostname);
      return [];
    },
    lookup: async (hostname: string) => {
      seenHostnames.push(hostname);
      return [{ address: "2606:4700:4700::1111", family: 6 }];
    },
  };

  const result = await resolveDnsRecords(
    "[2606:4700:4700::1111]",
    "[2606:4700:4700::1111]",
    resolver
  );

  assert.deepEqual(result.aaaa, ["2606:4700:4700::1111"]);
  assert.deepEqual(result.resolvedAddresses, ["2606:4700:4700::1111"]);
  assert.ok(seenHostnames.length > 0);
  assert.ok(seenHostnames.every((hostname) => hostname === "2606:4700:4700::1111"));
});

test("withTimeout clears pending timers after successful resolution", async () => {
  let clearCalls = 0;
  let cleared = false;

  const scheduler = {
    setTimeout: () =>
      ({
        unref() {},
      }) as ReturnType<typeof setTimeout>,
    clearTimeout: () => {
      clearCalls += 1;
      cleared = true;
    },
  };

  const result = await withTimeout(Promise.resolve("ok"), 1_000, scheduler);

  assert.equal(result, "ok");
  assert.equal(clearCalls, 1);
  assert.equal(cleared, true);
});

test("getTlsInfo strips IPv6 brackets before resolving TLS metadata", async () => {
  let resolvedHostname = "";
  let capturedServername: string | undefined;

  const fakeSocket = {
    destroy() {},
    end() {},
    getPeerCertificate: () => ({
      issuer: { CN: "Example CA" },
      subject: { CN: "example.com" },
      subjectaltname: "DNS:example.com",
      valid_from: "Jan  1 00:00:00 2024 GMT",
      valid_to: "Jan  1 00:00:00 2030 GMT",
    }),
    on() {
      return fakeSocket;
    },
    setTimeout() {},
  };

  const tlsInfo = await getTlsInfo("[2606:4700:4700::1111]", {
    connect: ((options: { servername?: string }, onConnect?: () => void) => {
      capturedServername = options.servername;
      queueMicrotask(() => onConnect?.());
      return fakeSocket as never;
    }) as never,
    resolveHostname: async (hostname: string) => {
      resolvedHostname = hostname;
      return [
        {
          address: "2606:4700:4700::1111",
          family: 6,
        },
      ];
    },
  });

  assert.equal(resolvedHostname, "2606:4700:4700::1111");
  assert.equal(capturedServername, undefined);
  assert.equal(tlsInfo.available, true);
  assert.deepEqual(tlsInfo.san, ["example.com"]);
});

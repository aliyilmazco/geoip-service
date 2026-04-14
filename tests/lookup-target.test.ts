import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyLookupTarget,
  isValidIp,
  normalizeWebsiteTarget,
} from "../lib/lookup-target";

test("isValidIp accepts IPv4 and IPv6 values", () => {
  assert.equal(isValidIp("8.8.8.8"), true);
  assert.equal(isValidIp("2001:4860:4860::8888"), true);
  assert.equal(isValidIp("999.8.8.8"), false);
  assert.equal(isValidIp("openai.com"), false);
});

test("classifyLookupTarget distinguishes ip, website, and unknown", () => {
  assert.equal(classifyLookupTarget("8.8.8.8"), "ip");
  assert.equal(classifyLookupTarget("example.com"), "website");
  assert.equal(classifyLookupTarget("https://openai.com"), "website");
  assert.equal(classifyLookupTarget("not a target"), "unknown");
});

test("normalizeWebsiteTarget expands protocol candidates and hostname", () => {
  const normalized = normalizeWebsiteTarget("example.com");

  assert.equal(normalized.query, "example.com");
  assert.equal(normalized.hostname, "example.com");
  assert.deepEqual(normalized.candidates, [
    "https://example.com/",
    "http://example.com/",
  ]);
});

test("classifyLookupTarget accepts bracketed IPv6 website URLs", () => {
  assert.equal(
    classifyLookupTarget("https://[2606:4700:4700::1111]"),
    "website"
  );
});

test("normalizeWebsiteTarget preserves bracketed IPv6 hosts", () => {
  const normalized = normalizeWebsiteTarget("https://[2606:4700:4700::1111]");

  assert.equal(normalized.query, "https://[2606:4700:4700::1111]");
  assert.equal(normalized.hostname, "[2606:4700:4700::1111]");
  assert.deepEqual(normalized.candidates, [
    "https://[2606:4700:4700::1111]/",
  ]);
});

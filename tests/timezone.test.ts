import assert from "node:assert/strict";
import test from "node:test";

import { buildLocationAnalysis } from "../lib/ip-analysis";
import { formatUtcOffset, getTimeZoneDetails } from "../lib/timezone";

test("buildLocationAnalysis derives timezone metadata from the looked-up IANA zone", () => {
  const location = buildLocationAnalysis(
    {
      ll: [40.7128, -74.006],
      timezone: "America/New_York",
    },
    "test-source",
    new Date("2026-01-15T12:00:00.000Z")
  );

  assert.equal(location.timezone?.name, "America/New_York");
  assert.equal(location.timezone?.offset, -5);
  assert.equal(location.timezone?.isDST, false);
  assert.equal(location.timezone?.currentTime, "1/15/2026, 7:00:00 AM");
});

test("getTimeZoneDetails detects daylight saving time in the target zone", () => {
  const details = getTimeZoneDetails(
    "America/New_York",
    new Date("2026-07-15T12:00:00.000Z")
  );

  assert.equal(details?.offset, -4);
  assert.equal(details?.isDST, true);
  assert.equal(details?.currentTime, "7/15/2026, 8:00:00 AM");
});

test("formatUtcOffset normalizes legacy minute offsets before rendering", () => {
  assert.equal(formatUtcOffset(-180), "UTC+03:00");
  assert.equal(formatUtcOffset(5.5), "UTC+05:30");
});

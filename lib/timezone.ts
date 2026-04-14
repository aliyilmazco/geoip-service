export type TimeZoneDetails = {
  offset: number;
  isDST: boolean;
  currentTime: string;
};

export function normalizeUtcOffsetHours(offset: number): number {
  if (!Number.isFinite(offset)) {
    return offset;
  }

  // Older payloads may still contain Date#getTimezoneOffset() minute values.
  if (Math.abs(offset) > 24) {
    return offset / -60;
  }

  return offset;
}

export function formatUtcOffset(offset?: number): string {
  if (typeof offset !== "number" || !Number.isFinite(offset)) {
    return "Unknown";
  }

  const normalizedOffset = normalizeUtcOffsetHours(offset);
  const absoluteMinutes = Math.round(Math.abs(normalizedOffset) * 60);
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, "0");
  const minutes = String(absoluteMinutes % 60).padStart(2, "0");
  const sign = normalizedOffset >= 0 ? "+" : "-";

  return `UTC${sign}${hours}:${minutes}`;
}

export function formatTimeInZone(value: Date, timeZone: string): string {
  try {
    return value.toLocaleString("en-US", { timeZone });
  } catch {
    return value.toLocaleString("en-US");
  }
}

export function getTimeZoneDetails(
  timeZone: string,
  value: Date = new Date()
): TimeZoneDetails | null {
  const currentOffsetMinutes = getTimeZoneOffsetMinutes(timeZone, value);

  if (currentOffsetMinutes === null) {
    return null;
  }

  const year = value.getUTCFullYear();
  const januaryOffset = getTimeZoneOffsetMinutes(
    timeZone,
    new Date(Date.UTC(year, 0, 1, 12, 0, 0))
  );
  const julyOffset = getTimeZoneOffsetMinutes(
    timeZone,
    new Date(Date.UTC(year, 6, 1, 12, 0, 0))
  );
  const seasonalOffsets = [januaryOffset, julyOffset].filter(
    (offset): offset is number => typeof offset === "number"
  );
  const standardOffsetMinutes =
    seasonalOffsets.length > 0
      ? Math.min(...seasonalOffsets)
      : currentOffsetMinutes;

  return {
    offset: currentOffsetMinutes / 60,
    isDST:
      seasonalOffsets.length > 1 &&
      seasonalOffsets.some((offset) => offset !== currentOffsetMinutes) &&
      currentOffsetMinutes > standardOffsetMinutes,
    currentTime: formatTimeInZone(value, timeZone),
  };
}

function getTimeZoneOffsetMinutes(timeZone: string, value: Date): number | null {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = formatter.formatToParts(value);
    const values = new Map(
      parts
        .filter(({ type }) => type !== "literal")
        .map(({ type, value: partValue }) => [type, partValue])
    );
    const timestamp = Date.UTC(
      Number(values.get("year")),
      Number(values.get("month")) - 1,
      Number(values.get("day")),
      Number(values.get("hour")),
      Number(values.get("minute")),
      Number(values.get("second"))
    );

    return Math.round((timestamp - value.getTime()) / 60_000);
  } catch {
    return null;
  }
}

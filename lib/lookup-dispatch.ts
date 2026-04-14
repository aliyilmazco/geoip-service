import { NextRequest } from "next/server";

import { analyzeIpTarget } from "@/lib/ip-lookup";
import { buildLookupError } from "@/lib/lookup-response";
import { classifyLookupTarget } from "@/lib/lookup-target";
import type { LookupResult } from "@/lib/lookup-types";
import {
  createLookupExecutionContext,
  type LookupExecutionContext,
} from "@/lib/request-utils";
import { analyzeWebsiteTarget } from "@/lib/website-analysis";

export async function dispatchLookupTarget(
  request: NextRequest,
  rawTarget: string,
  context: LookupExecutionContext = createLookupExecutionContext(request)
): Promise<{ status: number; body: LookupResult }> {
  const target = rawTarget.trim();
  const targetType = classifyLookupTarget(target);

  if (targetType === "ip") {
    return analyzeIpTarget(request, target, context);
  }

  if (targetType === "website") {
    return analyzeWebsiteTarget(request, target, context);
  }

  return {
    status: 400,
    body: buildLookupError({
      context,
      lookupType: "website",
      query: target,
      normalizedTarget: target,
      error: "Enter a valid IP address, domain, or URL.",
      details: {
        code: "INVALID_TARGET",
        reason: "Could not classify the target type",
        explanation:
          "The provided value must be in IPv4/IPv6, domain, or HTTP/HTTPS URL format.",
        recommendations: [
          "Use a value such as 8.8.8.8 for an IP lookup",
          "Use example.com or https://example.com for a website lookup",
        ],
      },
    }),
  };
}

export function reconstructLookupTarget(segments: string[]): string {
  if (segments.length === 0) {
    return "";
  }

  const [first, ...rest] = segments;
  const normalizedFirstSegment = normalizeSchemeSegment(first);

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:$/.test(normalizedFirstSegment)) {
    return `${normalizedFirstSegment}//${rest.join("/")}`;
  }

  return [normalizedFirstSegment, ...rest].join("/");
}

function normalizeSchemeSegment(segment: string) {
  try {
    const decoded = decodeURIComponent(segment);
    return /^[a-zA-Z][a-zA-Z0-9+.-]*:$/.test(decoded) ? decoded : segment;
  } catch {
    return segment;
  }
}

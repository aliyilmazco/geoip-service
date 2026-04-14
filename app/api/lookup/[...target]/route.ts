import { NextRequest } from "next/server";

import {
  dispatchLookupTarget,
  reconstructLookupTarget,
} from "@/lib/lookup-dispatch";
import { persistLookupObservation } from "@/lib/lookup-log-store";
import { buildLookupError } from "@/lib/lookup-response";
import { logEvent } from "@/lib/logger";
import { createLookupExecutionContext } from "@/lib/request-utils";
import {
  attachRateLimitToBody,
  createApiResponse,
  enforceRateLimit,
} from "@/lib/security";

export const runtime = "nodejs";

/**
 * @swagger
 * /api/lookup/{target}:
 *   get:
 *     tags:
 *       - Unified Lookup
 *     summary: Analyze an IP, domain or full URL target
 *     description: Compatibility route that accepts manual path targets and auto-detects whether the value is an IP or website.
 *     parameters:
 *       - in: path
 *         name: target
 *         required: true
 *         schema:
 *           type: string
 *         description: Target path, e.g. `8.8.8.8`, `example.com`, or `https://example.com`
 *     responses:
 *       200:
 *         description: Successful lookup
 *       400:
 *         description: Invalid target
 *       429:
 *         description: Too many requests
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ target: string[] }> }
) {
  const context = createLookupExecutionContext(request);
  let reconstructedTarget = "";

  try {
    const { target } = await params;
    reconstructedTarget = reconstructLookupTarget(target);
    const lookupRateLimit = enforceRateLimit(request, {
      subject: "lookup",
      target: reconstructedTarget,
    });

    if (!lookupRateLimit.allowed) {
      await persistLookupObservation({
        context,
        routeKind: "path",
        rawTarget: reconstructedTarget,
        httpStatus: lookupRateLimit.response.status,
        responseBody: await lookupRateLimit.response.clone().json(),
      });

      return lookupRateLimit.response;
    }

    const result = await dispatchLookupTarget(request, reconstructedTarget, context);
    const responseBody = attachRateLimitToBody(result.body, lookupRateLimit.rateLimit);

    await persistLookupObservation({
      context,
      routeKind: "path",
      rawTarget: reconstructedTarget,
      httpStatus: result.status,
      responseBody,
    });

    return createApiResponse(
      responseBody,
      { status: result.status, headers: lookupRateLimit.headers }
    );
  } catch (error) {
    logEvent("error", "lookup.path_route_failed", {
      requestId: context.requestId,
      message: error instanceof Error ? error.message : String(error),
    });

    const errorBody = buildLookupError({
      context,
      lookupType: "website",
      query: reconstructedTarget,
      error: "Could not resolve the lookup target",
      details: {
        code: "LOOKUP_ROUTE_FAILED",
        reason: "Unexpected route failure",
        explanation: "The lookup route could not be processed safely.",
        recommendations: [
          "Retry the request",
          "Inspect server logs using the request ID if the failure continues",
        ],
        retryable: true,
      },
    });

    if (reconstructedTarget) {
      await persistLookupObservation({
        context,
        routeKind: "path",
        rawTarget: reconstructedTarget,
        httpStatus: 500,
        responseBody: errorBody,
      });
    }

    return createApiResponse(
      errorBody,
      { status: 500 }
    );
  }
}

import { NextRequest } from "next/server";

import { analyzeCurrentIpRequest } from "@/lib/ip-lookup";
import { persistLookupObservation } from "@/lib/lookup-log-store";
import { dispatchLookupTarget } from "@/lib/lookup-dispatch";
import { logEvent } from "@/lib/logger";
import { buildLookupError } from "@/lib/lookup-response";
import { createLookupExecutionContext } from "@/lib/request-utils";
import {
  attachRateLimitToBody,
  createApiResponse,
  enforceRateLimit,
} from "@/lib/security";

export const runtime = "nodejs";

/**
 * @swagger
 * /api/lookup:
 *   get:
 *     tags:
 *       - Unified Lookup
 *     summary: Analyze current IP or a provided target
 *     description: Returns the current client IP analysis by default. If `target` query parameter is provided, the API auto-detects IP vs website/domain and analyzes accordingly.
 *     parameters:
 *       - in: query
 *         name: target
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional IP, domain or URL target such as `8.8.8.8`, `example.com`, or `https://example.com`
 *     responses:
 *       200:
 *         description: Successful lookup
 *       429:
 *         description: Too many requests
 *       500:
 *         description: Server error
 */

export async function GET(request: NextRequest) {
  const context = createLookupExecutionContext(request);
  const target = request.nextUrl.searchParams.get("target")?.trim();
  const lookupRateLimit = enforceRateLimit(request, {
    subject: "lookup",
    target: target || undefined,
  });

  try {
    if (!lookupRateLimit.allowed) {
      if (target) {
        await persistLookupObservation({
          context,
          routeKind: "query",
          rawTarget: target,
          httpStatus: lookupRateLimit.response.status,
          responseBody: await lookupRateLimit.response.clone().json(),
        });
      }

      return lookupRateLimit.response;
    }

    if (target) {
      const result = await dispatchLookupTarget(request, target, context);
      const responseBody = attachRateLimitToBody(
        result.body,
        lookupRateLimit.rateLimit
      );

      await persistLookupObservation({
        context,
        routeKind: "query",
        rawTarget: target,
        httpStatus: result.status,
        responseBody,
      });

      return createApiResponse(
        responseBody,
        { status: result.status, headers: lookupRateLimit.headers }
      );
    }

    const result = await analyzeCurrentIpRequest(request, context);
    return createApiResponse(
      attachRateLimitToBody(result.body, lookupRateLimit.rateLimit),
      { status: result.status, headers: lookupRateLimit.headers }
    );
  } catch (error) {
    logEvent("error", "lookup.route_failed", {
      requestId: context.requestId,
      message: error instanceof Error ? error.message : String(error),
      target,
    });

    const errorBody = attachRateLimitToBody(
      buildLookupError({
        context,
        lookupType: "ip",
        query: target || "",
        ip: "",
        error: "Server error",
        details: {
          code: "LOOKUP_FAILED",
          reason: "Unexpected server error",
          explanation: "The lookup could not be completed safely.",
          recommendations: [
            "Retry the request",
            "Inspect server logs using the request ID if the failure continues",
          ],
          retryable: true,
        },
      }),
      lookupRateLimit.rateLimit
    );

    if (target) {
      await persistLookupObservation({
        context,
        routeKind: "query",
        rawTarget: target,
        httpStatus: 500,
        responseBody: errorBody,
      });
    }

    return createApiResponse(
      errorBody,
      { status: 500, headers: lookupRateLimit.headers }
    );
  }
}

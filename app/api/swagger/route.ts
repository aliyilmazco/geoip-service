import { swaggerSpec } from "../../../lib/swagger";
import {
  createApiResponse,
  enforceRateLimit,
} from "@/lib/security";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const rateLimit = enforceRateLimit(request, { subject: "swagger" });
  if (!rateLimit.allowed) {
    return rateLimit.response;
  }

  return createApiResponse(swaggerSpec, { headers: rateLimit.headers });
}

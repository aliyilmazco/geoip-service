import crypto from "node:crypto";
import { isIP } from "node:net";

import { NextRequest } from "next/server";

import type { RequestInfo } from "@/lib/lookup-types";

const TRUST_PROXY_HEADERS = process.env.TRUST_PROXY_HEADERS === "true";

export interface LookupExecutionContext {
  clientIp: string;
  requestId: string;
  timestamp: string;
  userAgent: string;
}

export function getClientIp(request: NextRequest): string {
  const platformIp = readCandidateIp((request as NextRequest & { ip?: string }).ip);

  if (platformIp) {
    return platformIp;
  }

  if (!TRUST_PROXY_HEADERS) {
    return "127.0.0.1";
  }

  const cloudflareIp = readCandidateIp(request.headers.get("cf-connecting-ip"));
  if (cloudflareIp) {
    return cloudflareIp;
  }

  const forwardedChain = request.headers.get("x-forwarded-for");
  if (forwardedChain) {
    const forwardedIp = forwardedChain
      .split(",")
      .map((part) => readCandidateIp(part))
      .find((candidate): candidate is string => Boolean(candidate));

    if (forwardedIp) {
      return forwardedIp;
    }
  }

  return readCandidateIp(request.headers.get("x-real-ip")) || "127.0.0.1";
}

function getRequestId(request: NextRequest) {
  return (
    request.headers.get("x-request-id") ||
    request.headers.get("x-correlation-id") ||
    crypto.randomUUID()
  );
}

export function createLookupExecutionContext(
  request: NextRequest
): LookupExecutionContext {
  return {
    clientIp: getClientIp(request),
    requestId: getRequestId(request),
    timestamp: new Date().toISOString(),
    userAgent: request.headers.get("user-agent") || "",
  };
}

export function buildRequestInfo(
  request: NextRequest,
  context: LookupExecutionContext
): RequestInfo {
  return {
    timestamp: context.timestamp,
    userAgent: context.userAgent || undefined,
    method: request.method,
    url: request.url,
    headers: {
      host: request.headers.get("host") || undefined,
      accept: request.headers.get("accept") || undefined,
      contentType: request.headers.get("content-type") || undefined,
      requestId: context.requestId,
    },
  };
}

function readCandidateIp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const candidate = value.trim().replace(/^\[/, "").replace(/\]$/, "");
  return isIP(candidate) ? candidate : null;
}

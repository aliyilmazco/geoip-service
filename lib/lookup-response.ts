import type {
  LookupErrorDetails,
  LookupErrorResponse,
  LookupResponseBase,
  LookupType,
  PartialLookupData,
} from "@/lib/lookup-types";
import type { LookupExecutionContext } from "@/lib/request-utils";

type LookupBaseInput = {
  context: LookupExecutionContext;
  ip?: string;
  lookupType: LookupType;
  normalizedTarget?: string;
  query: string;
  warnings?: Array<string | undefined>;
};

type LookupErrorInput = LookupBaseInput & {
  details: LookupErrorDetails;
  error: string;
  partialData?: PartialLookupData;
};

export function mergeWarnings(values: Array<string | undefined>) {
  const warnings = Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))
  );

  return warnings.length > 0 ? warnings : undefined;
}

export function buildLookupBase(input: LookupBaseInput): LookupResponseBase {
  return {
    status: "ok",
    lookupType: input.lookupType,
    query: input.query,
    normalizedTarget: input.normalizedTarget,
    requestId: input.context.requestId,
    timestamp: input.context.timestamp,
    warnings: mergeWarnings(input.warnings || []),
    ip: input.ip || "",
  };
}

export function buildLookupError(input: LookupErrorInput): LookupErrorResponse {
  return {
    ...buildLookupBase(input),
    status: "error",
    error: input.error,
    details: input.details,
    partialData: input.partialData,
  };
}

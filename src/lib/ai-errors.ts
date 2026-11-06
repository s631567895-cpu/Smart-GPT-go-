// Client-safe AI error classification + fallback-chain helpers.
// Shared by Smart Chat, the AI Generator and unit tests. No server-only imports.

/** Fallback happens ONLY on these (quota, rate limit, temporary failures). */
export const RETRYABLE_AI_CODES: readonly string[] = [
  "rate_limited",
  "operation_failed",
  "network_error",
  "timeout",
  "unknown",
];

/**
 * Map any thrown error (GatewayError or generic) to a stable error code.
 * Fatal codes: configuration_error, authentication_error, permission_denied,
 * payment_required, request_rejected, invalid_response, cancelled.
 */
export function aiErrorCode(error: unknown): string {
  if (!error) return "unknown";
  if (typeof error === "object") {
    const e = error as { code?: unknown; name?: unknown; message?: unknown };
    if (typeof e.code === "string" && e.code) return e.code;
    const name = typeof e.name === "string" ? e.name : "";
    if (name === "RateLimitError") return "rate_limited";
    if (name === "PaymentRequiredError") return "payment_required";
    if (name === "PermissionDeniedError") return "permission_denied";
    if (name === "AuthenticationError") return "authentication_error";
    if (name === "ConfigurationError") return "configuration_error";
    if (name === "TimeoutError") return "timeout";
    if (name === "NetworkError") return "network_error";
    if (name === "OperationFailedError") return "operation_failed";
    if (name === "CancelledError") return "cancelled";
    if (name === "RequestRejectedError") return "request_rejected";
    if (name === "InvalidResponseError") return "invalid_response";
    const msg = typeof e.message === "string" ? e.message : "";
    if (/rate.?limit|429|too many/i.test(msg)) return "rate_limited";
    if (/timeout|timed out/i.test(msg)) return "timeout";
    if (/401|unauthor/i.test(msg)) return "authentication_error";
    if (/403|forbidden|permission/i.test(msg)) return "permission_denied";
    if (/402|credit/i.test(msg)) return "payment_required";
    if (/network|fetch/i.test(msg)) return "network_error";
  }
  return "unknown";
}

export function isRetryableAiError(error: unknown): boolean {
  return RETRYABLE_AI_CODES.includes(aiErrorCode(error));
}

/** One honest, user-facing sentence per failure kind. */
export function describeAiError(error: unknown): string {
  switch (aiErrorCode(error)) {
    case "payment_required":
      return "AI usage credits are finished for now. Please try again later.";
    case "permission_denied":
      return "Access to this AI model was denied, so the request was stopped — not retried on another provider.";
    case "authentication_error":
      return "AI authentication failed. Please sign in again — the request was not retried.";
    case "configuration_error":
      return "AI is not configured yet. Please try again in a moment.";
    case "rate_limited":
      return "This model is busy (rate limit hit).";
    case "invalid_response":
    case "request_rejected":
      return "The AI returned an invalid response. Please rephrase and try again.";
    case "cancelled":
      return "The request was cancelled.";
    default:
      return "AI could not complete this request. Please try again.";
  }
}

/** Shown only after every model in the chain failed with a retryable error. */
export const AI_EXHAUSTED_MESSAGE =
  "All available AI models are busy or at their limit right now. Please try again in a few minutes.";

/**
 * Build the fallback order: the chosen model first, then the rest.
 * "auto" (or an unknown id) returns the full list in its default order.
 */
export function buildModelChain(chosen: string | undefined, models: readonly string[]): string[] {
  const list = models.filter((m, i) => models.indexOf(m) === i);
  if (!chosen || chosen === "auto" || !list.includes(chosen)) return [...list];
  return [chosen, ...list.filter((m) => m !== chosen)];
}

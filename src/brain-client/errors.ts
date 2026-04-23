import type { ErrorEnvelope } from "./types.js";

export class BrainClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly requestId: string;
  constructor(status: number, code: string, message: string, requestId = "") {
    super(message);
    this.name = "BrainClientError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export class BrainAuthError extends BrainClientError {
  constructor(code: string, message: string, requestId = "") {
    super(401, code, message, requestId);
    this.name = "BrainAuthError";
  }
}

export class BrainNotFoundError extends BrainClientError {
  constructor(code: string, message: string, requestId = "") {
    super(404, code, message, requestId);
    this.name = "BrainNotFoundError";
  }
}

export class BrainRateLimitError extends BrainClientError {
  public readonly retryAfterMs: number;
  constructor(code: string, message: string, requestId = "", retryAfterMs = 1000) {
    super(429, code, message, requestId);
    this.name = "BrainRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class BrainServerError extends BrainClientError {
  constructor(status: number, code: string, message: string, requestId = "") {
    super(status, code, message, requestId);
    this.name = "BrainServerError";
  }
}

export class BrainNetworkError extends BrainClientError {
  constructor(message: string) {
    super(0, "BRAIN_NETWORK_ERROR", message, "");
    this.name = "BrainNetworkError";
  }
}

export function fromEnvelope(status: number, body: ErrorEnvelope): BrainClientError {
  const { code, message, request_id } = body.error;
  if (status === 401 || status === 403) return new BrainAuthError(code, message, request_id);
  if (status === 404) return new BrainNotFoundError(code, message, request_id);
  if (status === 429) return new BrainRateLimitError(code, message, request_id);
  if (status >= 500) return new BrainServerError(status, code, message, request_id);
  return new BrainClientError(status, code, message, request_id);
}

import { describe, it, expect } from "vitest";
import {
  BrainClientError,
  BrainAuthError,
  BrainNotFoundError,
  BrainRateLimitError,
  BrainServerError,
  BrainNetworkError,
  fromEnvelope,
} from "#src/brain-client/errors.js";

describe("brain-client errors", () => {
  it("fromEnvelope picks subclass by HTTP status", () => {
    const env = { error: { code: "X", message: "x", request_id: "r" } };
    expect(fromEnvelope(401, env)).toBeInstanceOf(BrainAuthError);
    expect(fromEnvelope(403, env)).toBeInstanceOf(BrainAuthError);
    expect(fromEnvelope(404, env)).toBeInstanceOf(BrainNotFoundError);
    expect(fromEnvelope(429, env)).toBeInstanceOf(BrainRateLimitError);
    expect(fromEnvelope(500, env)).toBeInstanceOf(BrainServerError);
    expect(fromEnvelope(502, env)).toBeInstanceOf(BrainServerError);
    expect(fromEnvelope(400, env)).toBeInstanceOf(BrainClientError);
  });

  it("carries code + request_id + status", () => {
    const e = fromEnvelope(502, {
      error: { code: "VAULT_EMBED_FAILED", message: "m", request_id: "abc" },
    });
    expect(e.code).toBe("VAULT_EMBED_FAILED");
    expect(e.requestId).toBe("abc");
    expect(e.status).toBe(502);
  });

  it("BrainNetworkError has no status", () => {
    const e = new BrainNetworkError("ECONNREFUSED");
    expect(e.status).toBe(0);
    expect(e.code).toBe("BRAIN_NETWORK_ERROR");
    expect(e).toBeInstanceOf(BrainClientError);
  });

  it("BrainRateLimitError exposes retryAfterMs", () => {
    const e = new BrainRateLimitError("R", "msg", "r", 5000);
    expect(e.retryAfterMs).toBe(5000);
  });
});

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { brainFetch } from "#src/brain-client/http.js";
import {
  BrainAuthError,
  BrainNetworkError,
  BrainRateLimitError,
} from "#src/brain-client/errors.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe("brainFetch", () => {
  it("sends Authorization: Bearer <token>", async () => {
    let seen: string | null = null;
    server.use(
      http.get("http://brain.test/healthz", ({ request }) => {
        seen = request.headers.get("Authorization");
        return HttpResponse.json({ status: "ok", checks: {}, version: "0" });
      }),
    );
    await brainFetch({ url: "http://brain.test", token: "tok" }, "GET", "/healthz");
    expect(seen).toBe("Bearer tok");
  });

  it("returns parsed JSON on 200", async () => {
    server.use(
      http.get("http://brain.test/hot", () =>
        HttpResponse.json({ body: "hi", updated_at: "2026-04-23" }),
      ),
    );
    const r = await brainFetch<{ body: string }>(
      { url: "http://brain.test", token: "t" },
      "GET",
      "/hot",
    );
    expect(r.body).toBe("hi");
  });

  it("throws BrainAuthError on 401", async () => {
    server.use(
      http.post("http://brain.test/notes", () =>
        HttpResponse.json(
          { error: { code: "AUTH", message: "no", request_id: "r1" } },
          { status: 401 },
        ),
      ),
    );
    await expect(
      brainFetch({ url: "http://brain.test", token: "bad" }, "POST", "/notes", {}),
    ).rejects.toBeInstanceOf(BrainAuthError);
  });

  it("retries 5xx up to 3 times with backoff", async () => {
    let calls = 0;
    server.use(
      http.get("http://brain.test/healthz", () => {
        calls++;
        if (calls < 3) {
          return HttpResponse.json(
            { error: { code: "X", message: "x", request_id: "" } },
            { status: 500 },
          );
        }
        return HttpResponse.json({ status: "ok", checks: {}, version: "0" });
      }),
    );
    const r = await brainFetch<{ status: string }>(
      { url: "http://brain.test", token: "t", retryBaseMs: 1 },
      "GET",
      "/healthz",
    );
    expect(calls).toBe(3);
    expect(r.status).toBe("ok");
  });

  it("does NOT retry 4xx", async () => {
    let calls = 0;
    server.use(
      http.post("http://brain.test/notes", () => {
        calls++;
        return HttpResponse.json(
          {
            error: {
              code: "INVALID_NOTE_KIND",
              message: "k",
              request_id: "r",
            },
          },
          { status: 400 },
        );
      }),
    );
    await expect(
      brainFetch({ url: "http://brain.test", token: "t" }, "POST", "/notes", {}),
    ).rejects.toThrow();
    expect(calls).toBe(1);
  });

  it("throws BrainNetworkError when host unreachable", async () => {
    await expect(
      brainFetch(
        { url: "http://127.0.0.1:1", token: "t", retryBaseMs: 1, maxRetries: 0 },
        "GET",
        "/healthz",
      ),
    ).rejects.toBeInstanceOf(BrainNetworkError);
  });

  it("honors Retry-After header on 429", async () => {
    server.use(
      http.post("http://brain.test/notes", () =>
        HttpResponse.json(
          { error: { code: "R", message: "r", request_id: "x" } },
          { status: 429, headers: { "Retry-After": "2" } },
        ),
      ),
    );
    try {
      await brainFetch(
        { url: "http://brain.test", token: "t", retryBaseMs: 1, maxRetries: 0 },
        "POST",
        "/notes",
        {},
      );
    } catch (e) {
      expect(e).toBeInstanceOf(BrainRateLimitError);
      expect((e as BrainRateLimitError).retryAfterMs).toBe(2000);
      return;
    }
    throw new Error("expected throw");
  });
});

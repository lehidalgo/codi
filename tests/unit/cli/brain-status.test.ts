import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { brainStatusHandler } from "#src/cli/brain.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe("brainStatusHandler", () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "codi-brain-cli-"));
    process.env.BRAIN_URL = "http://brain.test";
    process.env.BRAIN_BEARER_TOKEN = "tok";
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
    delete process.env.BRAIN_URL;
    delete process.env.BRAIN_BEARER_TOKEN;
  });

  it("reports green when /healthz returns ok", async () => {
    server.use(
      http.get("http://brain.test/healthz", () =>
        HttpResponse.json({
          status: "ok",
          checks: { memgraph: "ok", qdrant: "ok" },
          version: "0.1.0",
        }),
      ),
    );
    const r = await brainStatusHandler({ projectRoot: tmp });
    expect(r.success).toBe(true);
    expect(r.data.status).toBe("ok");
    expect(r.data.auth).toBe("configured");
  });

  it("reports unconfigured when no token set", async () => {
    delete process.env.BRAIN_BEARER_TOKEN;
    const r = await brainStatusHandler({ projectRoot: tmp });
    expect(r.success).toBe(false);
    expect(r.data.auth).toBe("not-configured");
  });

  it("reports network error as failure", async () => {
    process.env.BRAIN_URL = "http://127.0.0.1:1";
    const r = await brainStatusHandler({ projectRoot: tmp });
    expect(r.success).toBe(false);
    expect(r.data.error).toContain("network");
  });
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const SKIP = process.env.VITEST_SKIP_E2E === "1";
const runSuite = SKIP ? describe.skip : describe;

runSuite("Week 2B E2E scenario (requires brain running)", () => {
  let tmp: string;
  let token: string;
  let available = false;

  beforeAll(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "brain-2b-e2e-"));
    const probe = await fetch("http://127.0.0.1:8000/healthz").catch(() => null);
    if (!probe || !probe.ok) {
      return; // available stays false; tests guard on it
    }
    try {
      const brainEnv = await fs.readFile(
        path.join(os.homedir(), "projects/codi-brain/.env"),
        "utf-8",
      );
      const match = brainEnv.match(/^BRAIN_BEARER_TOKEN=(.+)$/m);
      if (!match) return;
      token = match[1].trim();
      available = true;
    } catch {
      // no codi-brain/.env on this machine — skip
    }
  });

  afterAll(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("captures a CODI-DECISION marker end-to-end via the Stop hook", async () => {
    if (!available) return;

    const { buildBrainStopScript } = await import("#src/core/hooks/brain-hooks.js");

    // Set up a fake project layout so __dirname inside the hook resolves to
    // PROJECT_ROOT = <tmp>/.codi/.. = <tmp>.
    const hooksDir = path.join(tmp, ".codi", "hooks");
    await fs.mkdir(hooksDir, { recursive: true });
    const hookPath = path.join(hooksDir, "stop.cjs");
    await fs.writeFile(hookPath, buildBrainStopScript());
    await fs.symlink(path.resolve("node_modules"), path.join(tmp, "node_modules"));

    const sessionId = `e2e-${Date.now()}`;
    const titleUniq = `Use Gemini for E2E ${sessionId}`;
    const uniqueTag = `e2e-${sessionId}`;
    const marker = `<CODI-DECISION@v1>${JSON.stringify({
      title: titleUniq,
      reason: "cheapest",
      tags: [uniqueTag, "llm"],
    })}</CODI-DECISION@v1>`;
    const payload = JSON.stringify({
      session_id: sessionId,
      transcript: `user: let us use gemini\nagent: agreed ${marker}`,
    });

    const result = spawnSync(process.execPath, [hookPath], {
      input: payload,
      env: {
        ...process.env,
        BRAIN_URL: "http://127.0.0.1:8000",
        BRAIN_BEARER_TOKEN: token,
      },
      encoding: "utf-8",
    });
    expect(result.status).toBe(0);

    // Give the brain a beat to index.
    await new Promise((r) => setTimeout(r, 1200));

    // Verify via tag-filter (deterministic — vector similarity on opaque
    // session IDs is not reliable for this assertion).
    const res = await fetch(
      `http://127.0.0.1:8000/notes/search?tag=${encodeURIComponent(uniqueTag)}&limit=5`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const body = (await res.json()) as {
      results: Array<{ title: string }>;
    };
    expect(body.results.some((h) => h.title.includes(sessionId))).toBe(true);
  });

  it("SessionStart hook emits additionalContext JSON", async () => {
    if (!available) return;

    const { buildBrainSessionStartScript } = await import("#src/core/hooks/brain-hooks.js");
    const hooksDir = path.join(tmp, ".codi", "hooks");
    await fs.mkdir(hooksDir, { recursive: true });
    const hookPath = path.join(hooksDir, "session-start.cjs");
    await fs.writeFile(hookPath, buildBrainSessionStartScript());

    const result = spawnSync(process.execPath, [hookPath], {
      input: JSON.stringify({}),
      env: {
        ...process.env,
        BRAIN_URL: "http://127.0.0.1:8000",
        BRAIN_BEARER_TOKEN: token,
      },
      encoding: "utf-8",
    });
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout) as { additionalContext: string };
    expect(typeof out.additionalContext).toBe("string");
  });
});

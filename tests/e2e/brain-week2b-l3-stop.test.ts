/**
 * End-to-end L3 (opt-in Gemini extraction) via the real Stop hook script.
 *
 * Runs the generated stop.cjs with BRAIN_AUTO_EXTRACT=true + a real Gemini
 * key, asserts:
 *   - Stop hook exits cleanly
 *   - Redaction log lands in .codi/brain-logs/
 *   - An auto-extracted note with the L3 marker tag lands in the brain
 *   - Dedup: when the transcript has a DECISION marker whose title matches
 *     what Gemini would extract, only the L1 marker is posted (L3 skips).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { buildBrainStopScript } from "#src/core/hooks/brain-hooks.js";

const SKIP = process.env.VITEST_SKIP_E2E === "1" || process.env.VITEST_SKIP_GEMINI === "1";

async function loadGeminiKey(): Promise<string | null> {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const fallback = path.join(os.homedir(), "projects/code-graph-rag/.env");
  try {
    const text = await fs.readFile(fallback, "utf-8");
    const m = text.match(/^ORCHESTRATOR_API_KEY=(AIza[A-Za-z0-9_-]+)$/m);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function loadBrainToken(): Promise<string | null> {
  const envPath = path.join(os.homedir(), "projects/codi-brain/.env");
  try {
    const text = await fs.readFile(envPath, "utf-8");
    const m = text.match(/^BRAIN_BEARER_TOKEN=(.+)$/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

const runSuite = SKIP ? describe.skip : describe;

runSuite("L3 Stop hook end-to-end (real Gemini + live brain)", () => {
  let tmp: string;
  let hookPath: string;
  let baseEnv: NodeJS.ProcessEnv;
  let token: string;
  let available = false;

  beforeAll(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "codi-l3-stop-"));
    const probe = await fetch("http://127.0.0.1:8000/healthz").catch(() => null);
    if (!probe || !probe.ok) return;
    const brainToken = await loadBrainToken();
    if (!brainToken) return;
    token = brainToken;
    const geminiKey = await loadGeminiKey();
    if (!geminiKey) return;

    const hooksDir = path.join(tmp, ".codi", "hooks");
    await fs.mkdir(hooksDir, { recursive: true });
    hookPath = path.join(hooksDir, "stop.cjs");
    await fs.writeFile(hookPath, buildBrainStopScript());
    await fs.symlink(path.resolve("node_modules"), path.join(tmp, "node_modules"));

    baseEnv = {
      ...process.env,
      BRAIN_URL: "http://127.0.0.1:8000",
      BRAIN_BEARER_TOKEN: token,
      BRAIN_AUTO_EXTRACT: "true",
      GEMINI_API_KEY: geminiKey,
      HOME: os.homedir(),
    };
    available = true;
  });

  afterAll(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("L3 extraction posts an auto-extracted note + writes redaction log", async () => {
    if (!available) return;
    const sid = `l3-e2e-${Date.now()}`;
    // Transcript with a clear implicit decision and no L1 marker — forces L3 to do work.
    const transcript = `
User: Do we want bearer tokens or API keys for the admin panel?
Agent: API keys are simpler but bearer tokens let us rotate and revoke per-session, which is what your security team needed.
User: Right. Let's standardize on bearer tokens for the admin panel, rotated every 24h.
Agent: Agreed. I'll update the auth middleware.
`;

    const res = spawnSync(process.execPath, [hookPath], {
      input: JSON.stringify({ session_id: sid, transcript }),
      env: baseEnv,
      encoding: "utf-8",
      timeout: 60_000,
    });
    if (res.status !== 0) {
      console.log("stderr:", res.stderr);
    }
    expect(res.status).toBe(0);

    // Redaction log should exist with at least one entry for this session.
    const logPath = path.join(tmp, ".codi", "brain-logs", `redaction-${sid}.jsonl`);
    const logExists = await fs
      .stat(logPath)
      .then(() => true)
      .catch(() => false);
    expect(logExists).toBe(true);

    // Wait for brain indexing.
    await new Promise((r) => setTimeout(r, 1500));

    // Search by the session-fingerprint tag the Stop hook adds to L3 notes.
    const autoTag = `auto-extract-${sid}`;
    const search = await fetch(
      `http://127.0.0.1:8000/notes/search?tag=${encodeURIComponent(autoTag)}&limit=5`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const hits = (await search.json()) as {
      results: Array<{ title: string; tags: string[] }>;
    };
    console.log(
      "L3-extracted notes for session:",
      hits.results.map((h) => h.title),
    );
    expect(hits.results.length).toBeGreaterThanOrEqual(1);
    // Every hit should carry both the auto-extracted marker and the session fingerprint.
    for (const h of hits.results) {
      expect(h.tags).toContain("auto-extracted");
      expect(h.tags).toContain(autoTag);
    }
  }, 90_000);

  it("dedup: L1 marker present → L3 candidate for the same title is skipped", async () => {
    if (!available) return;
    const sid = `l3-dedup-${Date.now()}`;
    const l1Tag = `l1-${sid}`;
    // Same decision appears twice — once as an explicit L1 marker (which L1
    // posts with tag l1-<sid>), once implicit in the dialogue. L3 should
    // recognize the overlap and skip the candidate (no auto-extract-<sid>
    // duplicate for the same title).
    const explicitTitle = `Chose bearer tokens for admin panel ${sid}`;
    const transcript = `
User: Bearer tokens vs API keys — what's the call?
Agent: Bearer tokens. They rotate cleanly.
<CODI-DECISION@v1>
{"title": "${explicitTitle}", "reason": "bearer tokens rotate per session", "tags": ["${l1Tag}"]}
</CODI-DECISION@v1>
User: Great — update the middleware.
`;

    const res = spawnSync(process.execPath, [hookPath], {
      input: JSON.stringify({ session_id: sid, transcript }),
      env: baseEnv,
      encoding: "utf-8",
      timeout: 60_000,
    });
    expect(res.status).toBe(0);

    await new Promise((r) => setTimeout(r, 1500));

    // L1 note should be present (tagged l1-<sid>).
    const l1Search = await fetch(
      `http://127.0.0.1:8000/notes/search?tag=${encodeURIComponent(l1Tag)}&limit=5`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const l1Hits = (await l1Search.json()) as {
      results: Array<{ title: string }>;
    };
    expect(l1Hits.results.some((h) => h.title === explicitTitle)).toBe(true);

    // L3 should NOT have written a duplicate under auto-extract-<sid> for the
    // same title. (Other unrelated L3 candidates with different titles are
    // fine — we only assert the explicit title didn't get double-written.)
    const l3Search = await fetch(
      `http://127.0.0.1:8000/notes/search?tag=${encodeURIComponent(`auto-extract-${sid}`)}&limit=10`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const l3Hits = (await l3Search.json()) as {
      results: Array<{ title: string }>;
    };
    console.log(
      "L3 titles this session:",
      l3Hits.results.map((h) => h.title),
    );
    const l3Titles = l3Hits.results.map((h) => h.title.toLowerCase().trim().replace(/\s+/g, " "));
    const explicitNorm = explicitTitle.toLowerCase().trim().replace(/\s+/g, " ");
    expect(l3Titles).not.toContain(explicitNorm);
  }, 90_000);
});

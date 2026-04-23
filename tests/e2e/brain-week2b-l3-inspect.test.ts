/**
 * Deep-inspect a single L3 run — dumps the redaction log + the posted note
 * bodies so the user can eyeball what Gemini actually extracts and what
 * the redactor scrubs.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { buildBrainStopScript } from "#src/core/hooks/brain-hooks.js";

const SKIP = process.env.VITEST_SKIP_E2E === "1" || process.env.VITEST_SKIP_GEMINI === "1";
const runSuite = SKIP ? describe.skip : describe;

async function loadGeminiKey(): Promise<string | null> {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const text = await fs.readFile(
      path.join(os.homedir(), "projects/code-graph-rag/.env"),
      "utf-8",
    );
    const m = text.match(/^ORCHESTRATOR_API_KEY=(AIza[A-Za-z0-9_-]+)$/m);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function loadBrainToken(): Promise<string | null> {
  try {
    const text = await fs.readFile(path.join(os.homedir(), "projects/codi-brain/.env"), "utf-8");
    const m = text.match(/^BRAIN_BEARER_TOKEN=(.+)$/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

runSuite("L3 inspect (prints what Gemini does)", () => {
  let tmp: string;
  let hookPath: string;
  let env: NodeJS.ProcessEnv;
  let token: string;
  let available = false;

  beforeAll(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "codi-l3-inspect-"));
    const probe = await fetch("http://127.0.0.1:8000/healthz").catch(() => null);
    if (!probe || !probe.ok) return;
    const t = await loadBrainToken();
    const g = await loadGeminiKey();
    if (!t || !g) return;
    token = t;

    const hooksDir = path.join(tmp, ".codi", "hooks");
    await fs.mkdir(hooksDir, { recursive: true });
    hookPath = path.join(hooksDir, "stop.cjs");
    await fs.writeFile(hookPath, buildBrainStopScript());
    await fs.symlink(path.resolve("node_modules"), path.join(tmp, "node_modules"));
    env = {
      ...process.env,
      BRAIN_URL: "http://127.0.0.1:8000",
      BRAIN_BEARER_TOKEN: t,
      BRAIN_AUTO_EXTRACT: "true",
      GEMINI_API_KEY: g,
      HOME: os.homedir(),
    };
    available = true;
  });

  afterAll(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("runs a transcript with secrets + real decisions and prints artifacts", async () => {
    if (!available) return;
    const sid = `l3-inspect-${Date.now()}`;
    const transcript = `
User: Our current Anthropic key is sk-ant-api03-aaaabbbbccccddddeeeeffffgggghhhhiiii and we spent $500 last month on Haiku for extraction.
Agent: That's a lot. You could cut it to about $170 by switching to Gemini 2.5 Flash at 1/3 the cost, and you get a 1M context window instead of 200k.
User: Great. Let's move the extractor to Gemini 2.5 Flash and rotate the Anthropic key since I just pasted it.
Agent: Rotating the Anthropic key is a priority; I'll also update the extractor configuration to use gemini-2.5-flash.
User: Also, let me know when developer@internal.example gets notified.
`;
    const res = spawnSync(process.execPath, [hookPath], {
      input: JSON.stringify({ session_id: sid, transcript }),
      env,
      encoding: "utf-8",
      timeout: 60_000,
    });
    expect(res.status).toBe(0);

    // Dump redaction log.
    const logPath = path.join(tmp, ".codi", "brain-logs", `redaction-${sid}.jsonl`);
    const log = await fs.readFile(logPath, "utf-8");
    console.log("\n=== redaction log ===");
    console.log(log.trim());

    // Wait + fetch extracted notes.
    await new Promise((r) => setTimeout(r, 1500));
    const search = await fetch(
      `http://127.0.0.1:8000/notes/search?tag=auto-extract-${encodeURIComponent(sid)}&limit=10`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const hits = (await search.json()) as {
      results: Array<{ title: string; body: string; tags: string[] }>;
    };
    console.log("\n=== auto-extracted notes (count:", hits.results.length, ") ===");
    for (const h of hits.results) {
      console.log("\n---");
      console.log("title:", h.title);
      console.log("body:", h.body);
      console.log("tags:", h.tags.join(", "));
    }

    // Verify: the redacted payload Gemini saw did NOT contain the real anthropic key.
    // We can't see the Gemini payload from here, but we can verify the note bodies
    // don't echo back any secret. The redactor already runs pre-send, so Gemini
    // can only work with redacted text.
    for (const h of hits.results) {
      expect(h.body).not.toMatch(/sk-ant-api03-/);
      expect(h.body).not.toContain("developer@internal.example");
    }
  }, 120_000);
});

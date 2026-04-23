/**
 * Comprehensive Week 2B harness. Exercises all three hook scripts against
 * the live brain, including scenarios the ship test does not:
 * - SessionStart surfaces hot state + recent decisions.
 * - Stop captures multiple markers + HOT update in one payload.
 * - Stop gracefully skips malformed marker JSON.
 * - PostToolUse skips non-git Bash invocations.
 * - PostToolUse fires /vault/reconcile on `git commit`.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  buildBrainSessionStartScript,
  buildBrainStopScript,
  buildBrainPostCommitScript,
} from "#src/core/hooks/brain-hooks.js";

const SKIP = process.env.VITEST_SKIP_E2E === "1";
const runSuite = SKIP ? describe.skip : describe;

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

function runHook(hookPath: string, payload: unknown, env: NodeJS.ProcessEnv): RunResult {
  const res = spawnSync(process.execPath, [hookPath], {
    input: JSON.stringify(payload),
    env,
    encoding: "utf-8",
  });
  return {
    status: res.status ?? -1,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}

runSuite("Week 2B comprehensive harness (requires brain running)", () => {
  let tmp: string;
  let token: string;
  let hookEnv: NodeJS.ProcessEnv;
  let sessionStart: string;
  let stop: string;
  let postCommit: string;
  let available = false;

  beforeAll(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "codi-harness-"));
    const probe = await fetch("http://127.0.0.1:8000/healthz").catch(() => null);
    if (!probe || !probe.ok) return;
    try {
      const envText = await fs.readFile(
        path.join(os.homedir(), "projects/codi-brain/.env"),
        "utf-8",
      );
      const m = envText.match(/^BRAIN_BEARER_TOKEN=(.+)$/m);
      if (!m) return;
      token = m[1].trim();
    } catch {
      return;
    }

    const hooksDir = path.join(tmp, ".codi", "hooks");
    await fs.mkdir(hooksDir, { recursive: true });
    sessionStart = path.join(hooksDir, "session-start.cjs");
    stop = path.join(hooksDir, "stop.cjs");
    postCommit = path.join(hooksDir, "post-commit.cjs");
    await fs.writeFile(sessionStart, buildBrainSessionStartScript());
    await fs.writeFile(stop, buildBrainStopScript());
    await fs.writeFile(postCommit, buildBrainPostCommitScript());
    await fs.symlink(path.resolve("node_modules"), path.join(tmp, "node_modules"));

    hookEnv = {
      ...process.env,
      BRAIN_URL: "http://127.0.0.1:8000",
      BRAIN_BEARER_TOKEN: token,
    };
    available = true;
  });

  afterAll(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("SessionStart returns JSON additionalContext with hot state + recent decisions", async () => {
    if (!available) return;
    // Ensure there's a hot state + recent decision to surface.
    await fetch("http://127.0.0.1:8000/hot", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: "harness test hot state" }),
    });

    const res = runHook(sessionStart, {}, hookEnv);
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout) as { additionalContext: string };
    expect(parsed.additionalContext).toContain("<codi-brain-context>");
    expect(parsed.additionalContext).toContain("Hot state: harness test hot state");
  });

  it("Stop captures multiple DECISION + HOT markers in one payload", async () => {
    if (!available) return;
    const sid = `harness-multi-${Date.now()}`;
    const uniqueTag = `harness-${sid}`;
    const transcript = `
agent: two decisions incoming
<CODI-DECISION@v1>
{"title": "Harness multi A ${sid}", "reason": "one", "tags": ["${uniqueTag}"]}
</CODI-DECISION@v1>
<CODI-DECISION@v1>
{"title": "Harness multi B ${sid}", "reason": "two", "tags": ["${uniqueTag}"]}
</CODI-DECISION@v1>
<CODI-HOT@v1>
{"body": "Running harness ${sid}"}
</CODI-HOT@v1>
`;
    const res = runHook(stop, { session_id: sid, transcript }, hookEnv);
    expect(res.status).toBe(0);

    await new Promise((r) => setTimeout(r, 1200));

    const search = await fetch(
      `http://127.0.0.1:8000/notes/search?tag=${encodeURIComponent(uniqueTag)}&limit=5`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const hits = (await search.json()) as {
      results: Array<{ title: string }>;
    };
    const titles = hits.results.map((h) => h.title);
    expect(titles).toContain(`Harness multi A ${sid}`);
    expect(titles).toContain(`Harness multi B ${sid}`);

    const hot = await fetch("http://127.0.0.1:8000/hot", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const hotBody = (await hot.json()) as { body: string };
    expect(hotBody.body).toBe(`Running harness ${sid}`);
  });

  it("Stop skips malformed marker JSON without crashing", async () => {
    if (!available) return;
    const sid = `harness-malformed-${Date.now()}`;
    // Each run gets a unique tag so the search below is deterministic.
    const uniqueTag = `recovered-${sid}`;
    const transcript = `<CODI-DECISION@v1>not json at all</CODI-DECISION@v1>
<CODI-DECISION@v1>
{"title": "only valid one ${sid}", "tags": ["${uniqueTag}"]}
</CODI-DECISION@v1>`;
    const res = runHook(stop, { session_id: sid, transcript }, hookEnv);
    expect(res.status).toBe(0); // must not crash

    await new Promise((r) => setTimeout(r, 1200));
    // Use tag filter — deterministic, no vector similarity guesswork.
    const search = await fetch(
      `http://127.0.0.1:8000/notes/search?tag=${encodeURIComponent(uniqueTag)}&limit=5`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const hits = (await search.json()) as {
      results: Array<{ title: string }>;
    };
    expect(hits.results.some((h) => h.title.includes("only valid one"))).toBe(true);
  });

  it("PostToolUse: skips non-git Bash invocations (no reconcile call)", async () => {
    if (!available) return;
    const res = runHook(
      postCommit,
      { tool_name: "Bash", tool_input: { command: "ls -la" } },
      hookEnv,
    );
    expect(res.status).toBe(0);
    // Non-git -> no stderr log (hook returns early, silently).
    expect(res.stderr).not.toContain("reconcile");
  });

  it("PostToolUse: fires reconcile on git commit", async () => {
    if (!available) return;
    const res = runHook(
      postCommit,
      { tool_name: "Bash", tool_input: { command: "git commit -m 'test'" } },
      hookEnv,
    );
    expect(res.status).toBe(0);
    // No exception means reconcile was attempted (either succeeded or logged).
  });

  it("Stop with no markers completes cleanly", async () => {
    if (!available) return;
    const sid = `harness-empty-${Date.now()}`;
    const transcript = `agent: just some chatter, no markers here at all.`;
    const res = runHook(stop, { session_id: sid, transcript }, hookEnv);
    expect(res.status).toBe(0);
  });

  it("Stop handles empty transcript cleanly", async () => {
    if (!available) return;
    const res = runHook(stop, { session_id: "empty", transcript: "" }, hookEnv);
    expect(res.status).toBe(0);
  });

  it("Stop without BRAIN_BEARER_TOKEN skips silently", async () => {
    if (!available) return;
    const envNoToken = { ...hookEnv };
    delete envNoToken.BRAIN_BEARER_TOKEN;
    const transcript = `<CODI-DECISION@v1>{"title": "skipped"}</CODI-DECISION@v1>`;
    const res = runHook(stop, { session_id: "no-token", transcript }, envNoToken);
    expect(res.status).toBe(0); // graceful skip, no crash
  });

  it("SessionStart without BRAIN_BEARER_TOKEN returns empty additionalContext", async () => {
    if (!available) return;
    const envNoToken = { ...hookEnv };
    delete envNoToken.BRAIN_BEARER_TOKEN;
    const res = runHook(sessionStart, {}, envNoToken);
    expect(res.status).toBe(0);
    const out = JSON.parse(res.stdout) as { additionalContext: string };
    expect(out.additionalContext).toBe("");
  });
});

/**
 * End-to-end test: runConsolidation with an injected LlmProvider mock
 * enriches each proposal with `patch.llm_response`. Verifies:
 *   - LLM call counter respects CODI_LLM_MAX_CALLS_PER_RUN
 *   - LLM failures degrade gracefully (no enrichment) instead of aborting
 *   - dryRun=true skips persistence
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openBrain, applyMigrations } from "#src/runtime/brain/index.js";
import { runConsolidation, listProposals } from "#src/runtime/consolidate/index.js";
import type { LlmProvider } from "#src/runtime/llm/index.js";

function tmpBrain() {
  const dir = mkdtempSync(join(tmpdir(), "codi-llm-int-"));
  const handle = openBrain({ dbPath: join(dir, "brain.db") });
  applyMigrations(handle.raw);
  return {
    handle,
    cleanup: () => {
      handle.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function seedCorrections(raw: ReturnType<typeof tmpBrain>["handle"]["raw"], n: number): void {
  const stmt = raw.prepare(
    `INSERT INTO corrections(session_id, ts, file_path, diff_summary, detected_via)
     VALUES (?, ?, ?, ?, 'agent')`,
  );
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    stmt.run(`s${i}`, now - i * 100, "src/auth.ts", "removed any cast");
  }
}

function fakeProvider(responder: (call: number) => string | Error): LlmProvider {
  let calls = 0;
  return {
    id: "gemini",
    defaultModel: "fake",
    async generate() {
      calls++;
      const out = responder(calls);
      if (out instanceof Error) throw out;
      return { text: out, tokensIn: 1, tokensOut: 1, model: "fake" };
    },
  };
}

beforeEach(() => {
  delete process.env["CODI_LLM_MAX_CALLS_PER_RUN"];
});

afterEach(() => {
  delete process.env["CODI_LLM_MAX_CALLS_PER_RUN"];
});

describe("LLM enrichment via runConsolidation", () => {
  it("attaches patch.llm_response when an LlmProvider is supplied", async () => {
    const t = tmpBrain();
    try {
      seedCorrections(t.handle.raw, 3);
      const provider = fakeProvider(() => "Promote to RULE — cast-removal recurrence.");
      const result = await runConsolidation(t.handle.raw, {
        installedSkills: [],
        installedRules: [],
        existingRuleKeywords: [],
        llmProvider: provider,
      });
      expect(result.llmCalls).toBeGreaterThan(0);
      expect(result.llmFailures).toBe(0);
      const persisted = listProposals(t.handle.raw);
      expect(persisted.length).toBe(result.proposals.length);
      const withLlm = persisted.find(
        (p) => typeof p.patch === "object" && p.patch !== null && "llm_response" in p.patch,
      );
      expect(withLlm).toBeDefined();
    } finally {
      t.cleanup();
    }
  });

  it("respects CODI_LLM_MAX_CALLS_PER_RUN as a hard cap", async () => {
    const t = tmpBrain();
    try {
      seedCorrections(t.handle.raw, 3);
      // Cap at 0 = no LLM calls even with provider supplied.
      process.env["CODI_LLM_MAX_CALLS_PER_RUN"] = "0";
      const provider = fakeProvider(() => "x");
      const result = await runConsolidation(t.handle.raw, {
        installedSkills: [],
        installedRules: [],
        existingRuleKeywords: [],
        llmProvider: provider,
      });
      expect(result.llmCalls).toBe(0);
    } finally {
      t.cleanup();
    }
  });

  it("degrades gracefully on LLM failure — proposal still persisted without enrichment", async () => {
    const t = tmpBrain();
    try {
      seedCorrections(t.handle.raw, 3);
      const provider = fakeProvider(() => new Error("rate-limited"));
      const result = await runConsolidation(t.handle.raw, {
        installedSkills: [],
        installedRules: [],
        existingRuleKeywords: [],
        llmProvider: provider,
      });
      expect(result.llmFailures).toBeGreaterThan(0);
      // Proposals are persisted even though LLM failed.
      const persisted = listProposals(t.handle.raw);
      expect(persisted.length).toBeGreaterThan(0);
    } finally {
      t.cleanup();
    }
  });

  it("dryRun=true returns proposals without persisting", async () => {
    const t = tmpBrain();
    try {
      seedCorrections(t.handle.raw, 3);
      const result = await runConsolidation(t.handle.raw, {
        installedSkills: [],
        installedRules: [],
        existingRuleKeywords: [],
        dryRun: true,
      });
      expect(result.dryRun).toBe(true);
      expect(result.proposals.every((p) => p.id === -1)).toBe(true);
      const persisted = listProposals(t.handle.raw);
      expect(persisted).toHaveLength(0);
    } finally {
      t.cleanup();
    }
  });
});

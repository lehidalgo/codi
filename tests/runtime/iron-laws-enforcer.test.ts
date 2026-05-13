/**
 * Iron Laws 4-8 runtime enforcement (Item 3).
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openBrain } from "#src/runtime/brain/db.js";
import { applyMigrations } from "#src/runtime/brain/migrate.js";
import {
  readGateState,
  isPhaseApproval,
  shouldRecommendPull,
  decideGitCommand,
  buildOutputModeBlock,
  buildIronLawsBlock,
} from "#src/runtime/iron-laws-enforcer.js";

function tmpBrain() {
  const dir = mkdtempSync(join(tmpdir(), "codi-il-"));
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

describe("Iron Law 4 — HARD GATES need 'ok'", () => {
  it("readGateState returns null when no workflow is active", () => {
    const t = tmpBrain();
    try {
      expect(readGateState(t.handle.raw)).toBeNull();
    } finally {
      t.cleanup();
    }
  });

  it("readGateState surfaces an in-progress workflow", () => {
    const t = tmpBrain();
    try {
      t.handle.raw
        .prepare(
          `INSERT INTO workflow_runs(workflow_id, project_id, type, current_phase, status, started_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run("wf-1", "p1", "feature", "execute", "pending_approval", Date.now());
      const state = readGateState(t.handle.raw);
      expect(state).not.toBeNull();
      expect(state!.workflowId).toBe("wf-1");
      expect(state!.status).toBe("pending_approval");
    } finally {
      t.cleanup();
    }
  });

  it.each([
    ["ok", true],
    ["OK", true],
    ["Ok", true],
    ["okay", false],
    ["okie", false],
    ["yeah", false],
    ["looks good", false],
    ["sure", false],
    ["yes", false],
    ["please go", false],
  ])("isPhaseApproval(%s) === %s", (input, expected) => {
    expect(isPhaseApproval(input)).toBe(expected);
  });

  it("ignores 'ok' inside fenced code blocks", () => {
    const prompt = "Here is an example:\n```bash\necho ok\n```\nplease continue";
    expect(isPhaseApproval(prompt)).toBe(false);
  });
});

describe("Iron Law 5 — Pull before patch", () => {
  const now = 10_000;

  it("recommends a pull when last read is > 60s old AND tool mutates", () => {
    expect(
      shouldRecommendPull({ lastBrainReadTs: now - 90_000, nowTs: now, toolName: "Edit" }),
    ).toBe(true);
  });

  it("does not recommend for read-only tools", () => {
    expect(shouldRecommendPull({ lastBrainReadTs: 0, nowTs: now, toolName: "Read" })).toBe(false);
  });

  it("does not recommend when read is fresh", () => {
    expect(
      shouldRecommendPull({ lastBrainReadTs: now - 5_000, nowTs: now, toolName: "Write" }),
    ).toBe(false);
  });
});

describe("Iron Law 7 — Never commit without approval", () => {
  it("blocks `git commit` when no approval token is in recent prompts", () => {
    const d = decideGitCommand({
      bashCommand: "git commit -m 'wip'",
      recentPrompts: ["fix this bug", "rerun the tests"],
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain("Iron Law 7");
  });

  it("allows `git commit` when 'ok' appears in a recent prompt", () => {
    const d = decideGitCommand({
      bashCommand: "git commit -m 'feat: x'",
      recentPrompts: ["ok"],
    });
    expect(d.allowed).toBe(true);
  });

  it("blocks `git push --force`", () => {
    const d = decideGitCommand({
      bashCommand: "git push --force origin main",
      recentPrompts: [""],
    });
    expect(d.allowed).toBe(false);
  });

  it("ignores non-mutating git commands", () => {
    const d = decideGitCommand({
      bashCommand: "git status",
      recentPrompts: [],
    });
    expect(d.allowed).toBe(true);
  });

  it("matches the 'ok' approval token case-insensitively", () => {
    for (const token of ["ok", "OK", "Ok"]) {
      const d = decideGitCommand({
        bashCommand: "git commit -m 'x'",
        recentPrompts: [token],
      });
      expect(d.allowed).toBe(true);
    }
  });
});

describe("Iron Law 8 — Output mode", () => {
  it("emits the caveman block when mode is caveman", () => {
    const text = buildOutputModeBlock("caveman");
    expect(text).toContain("<output-mode>caveman</output-mode>");
    expect(text).toContain("Iron Law 8");
  });

  it("emits empty when mode is normal", () => {
    expect(buildOutputModeBlock("normal")).toBe("");
  });
});

describe("buildIronLawsBlock aggregation", () => {
  it("returns empty when no law has anything to say (mode=normal, no gate)", () => {
    expect(buildIronLawsBlock({ outputMode: "normal", gateState: null })).toBe("");
  });

  it("includes the gate block when a phase transition is pending", () => {
    const block = buildIronLawsBlock({
      outputMode: "caveman",
      gateState: {
        workflowId: "wf-1",
        currentPhase: "execute",
        status: "pending_approval",
        pendingProposalCount: 0,
      },
    });
    expect(block).toContain("<output-mode>caveman</output-mode>");
    expect(block).toContain("<hard-gate>");
    expect(block).toContain("Iron Law 4");
  });
});

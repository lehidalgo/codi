/**
 * Agent auto-memory ingestion tests.
 *
 * The PostToolUse hook now mirrors Claude Code's per-project memory
 * writes (under ~/.claude/projects/<slug>/memory/*.md) into the
 * `captures` table — full markdown body preserved, frontmatter type
 * mapped onto the canonical Iron Law 9 capture vocabulary, dedup keyed
 * by (turn_id, claude-memory://path:hash).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBrain, type BrainHandle } from "#src/runtime/brain/db.js";
import { applyMigrations } from "#src/runtime/brain/migrate.js";
import { ensureSession, openTurn, recordPrompt } from "#src/runtime/capture/session.js";
import {
  ingestAgentMemory,
  isClaudeMemoryWrite,
  mapMemoryTypeToCaptureType,
  parseMemoryFrontmatter,
} from "#src/runtime/capture/agent-memory.js";
import { processPostToolUse } from "#src/runtime/capture/tool-hook.js";

let tmp: string;
let handle: BrainHandle;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "codi-agent-memory-"));
  handle = openBrain({ dbPath: join(tmp, "brain.db") });
  applyMigrations(handle.raw);
});

afterEach(() => {
  handle.close();
  rmSync(tmp, { recursive: true, force: true });
});

function seedTurn(): { sessionId: string; promptId: number; turnId: number } {
  ensureSession(handle.raw, {
    sessionId: "s",
    projectId: "p",
    agentType: "claude-code",
    workingDir: tmp,
  });
  const p = recordPrompt(handle.raw, { sessionId: "s", text: "any prompt" });
  const turnId = openTurn(handle.raw, {
    sessionId: "s",
    promptId: p.promptId,
    turnNo: p.turnNo,
  });
  return { sessionId: "s", promptId: p.promptId, turnId };
}

describe("isClaudeMemoryWrite", () => {
  it("matches Write to ~/.claude/projects/<slug>/memory/*.md", () => {
    expect(
      isClaudeMemoryWrite(
        "Write",
        "/Users/x/.claude/projects/-private-tmp-codi-live-test/memory/feedback_no_overengineering.md",
      ),
    ).toBe(true);
  });

  it("rejects MEMORY.md (the index file)", () => {
    expect(isClaudeMemoryWrite("Write", "/Users/x/.claude/projects/foo/memory/MEMORY.md")).toBe(
      false,
    );
  });

  it("rejects non-Write tools", () => {
    expect(isClaudeMemoryWrite("Read", "/Users/x/.claude/projects/foo/memory/bar.md")).toBe(false);
    expect(isClaudeMemoryWrite("Bash", "/Users/x/.claude/projects/foo/memory/bar.md")).toBe(false);
  });

  it("rejects writes outside the memory dir", () => {
    expect(isClaudeMemoryWrite("Write", "/Users/x/code/feature.ts")).toBe(false);
    expect(isClaudeMemoryWrite("Write", "/Users/x/.claude/projects/foo/notes/scratch.md")).toBe(
      false,
    );
  });

  it("rejects non-string file_path", () => {
    expect(isClaudeMemoryWrite("Write", undefined)).toBe(false);
    expect(isClaudeMemoryWrite("Write", 123)).toBe(false);
  });
});

describe("parseMemoryFrontmatter", () => {
  it("parses the canonical Claude Code memory shape", () => {
    const md = `---
name: No over-engineering
description: User dislikes over-engineering — keep solutions minimal and scoped
type: feedback
originSessionId: a3b717aa-3bcb-4067-8037-7bb4a572e3c9
---

Do not over-engineer. Keep changes minimal, scoped to the request.

**Why:** User stated explicitly.
`;
    const out = parseMemoryFrontmatter(md);
    expect(out.name).toBe("No over-engineering");
    expect(out.description).toContain("over-engineering");
    expect(out.type).toBe("feedback");
    expect(out.originSessionId).toBe("a3b717aa-3bcb-4067-8037-7bb4a572e3c9");
    expect(out.body).toContain("Do not over-engineer");
    expect(out.body).toContain("**Why:**");
  });

  it("falls back to body=full content on missing frontmatter", () => {
    const md = "Just a plain markdown file.\nSecond line.";
    const out = parseMemoryFrontmatter(md);
    expect(out.body).toBe(md);
    expect(out.type).toBeUndefined();
  });

  it("handles unterminated frontmatter as plain content", () => {
    const md = "---\nname: foo\nbody without close";
    const out = parseMemoryFrontmatter(md);
    expect(out.body).toBe(md);
  });

  it("strips quoted values from frontmatter", () => {
    const md = `---\nname: "Quoted name"\ntype: 'feedback'\n---\nbody`;
    const out = parseMemoryFrontmatter(md);
    expect(out.name).toBe("Quoted name");
    expect(out.type).toBe("feedback");
  });
});

describe("mapMemoryTypeToCaptureType", () => {
  it.each([
    ["feedback", "FEEDBACK"],
    ["FEEDBACK", "FEEDBACK"],
    ["user", "PREFERENCE"],
    ["project", "OBSERVATION"],
    ["reference", "OBSERVATION"],
    ["unknown", "OBSERVATION"],
    [undefined, "OBSERVATION"],
  ])("maps %s → %s", (input, expected) => {
    expect(mapMemoryTypeToCaptureType(input as string | undefined)).toBe(expected);
  });
});

describe("ingestAgentMemory", () => {
  it("ingests a feedback memory write losslessly", () => {
    const { sessionId, promptId, turnId } = seedTurn();
    const fullContent = `---
name: No over-engineering
description: User dislikes over-engineering
type: feedback
originSessionId: a3b717aa
---

Do not over-engineer.

**Why:** User stated explicitly.
**How to apply:** Solve exactly what was asked.
`;
    const result = ingestAgentMemory(handle.raw, {
      sessionId,
      promptId,
      turnId,
      toolName: "Write",
      toolInput: {
        file_path: "/Users/x/.claude/projects/-tmp-test/memory/feedback_no_overengineering.md",
        content: fullContent,
      },
    });
    expect(result.ingested).toBe(true);
    expect(result.captureId).toBeGreaterThan(0);

    const row = handle.raw
      .prepare(`SELECT type, content, raw_marker, file_paths FROM captures WHERE capture_id = ?`)
      .get(result.captureId!) as {
      type: string;
      content: string;
      raw_marker: string;
      file_paths: string;
    };
    expect(row.type).toBe("FEEDBACK");
    expect(row.content).toBe(fullContent); // lossless: full markdown preserved
    expect(row.raw_marker).toMatch(/^claude-code-memory:\/\/.*:[a-f0-9]{16}$/);
    expect(JSON.parse(row.file_paths)).toEqual([
      "/Users/x/.claude/projects/-tmp-test/memory/feedback_no_overengineering.md",
    ]);
  });

  it("dedupes identical writes within the same turn", () => {
    const { sessionId, promptId, turnId } = seedTurn();
    const args = {
      sessionId,
      promptId,
      turnId,
      toolName: "Write",
      toolInput: {
        file_path: "/Users/x/.claude/projects/p/memory/foo.md",
        content: "---\ntype: feedback\n---\nbody",
      },
    } as const;
    const r1 = ingestAgentMemory(handle.raw, args);
    const r2 = ingestAgentMemory(handle.raw, args);
    expect(r1.ingested).toBe(true);
    expect(r2.ingested).toBe(false);
    expect(r2.captureId).toBe(r1.captureId);

    const count = handle.raw.prepare(`SELECT COUNT(*) AS c FROM captures`).get() as { c: number };
    expect(count.c).toBe(1);
  });

  it("creates a new capture when memory content evolves (memory rewrite)", () => {
    const { sessionId, promptId, turnId } = seedTurn();
    const filePath = "/Users/x/.claude/projects/p/memory/evolving.md";
    const r1 = ingestAgentMemory(handle.raw, {
      sessionId,
      promptId,
      turnId,
      toolName: "Write",
      toolInput: { file_path: filePath, content: "---\ntype: user\n---\nv1" },
    });
    const r2 = ingestAgentMemory(handle.raw, {
      sessionId,
      promptId,
      turnId,
      toolName: "Write",
      toolInput: { file_path: filePath, content: "---\ntype: user\n---\nv2 evolved" },
    });
    expect(r1.ingested).toBe(true);
    expect(r2.ingested).toBe(true);
    expect(r2.captureId).not.toBe(r1.captureId);

    const count = handle.raw.prepare(`SELECT COUNT(*) AS c FROM captures`).get() as { c: number };
    expect(count.c).toBe(2);
  });

  it("skips non-memory writes", () => {
    const { sessionId, promptId, turnId } = seedTurn();
    expect(
      ingestAgentMemory(handle.raw, {
        sessionId,
        promptId,
        turnId,
        toolName: "Write",
        toolInput: { file_path: "/tmp/random.md", content: "hello" },
      }).ingested,
    ).toBe(false);
  });

  it("skips MEMORY.md (the index)", () => {
    const { sessionId, promptId, turnId } = seedTurn();
    expect(
      ingestAgentMemory(handle.raw, {
        sessionId,
        promptId,
        turnId,
        toolName: "Write",
        toolInput: {
          file_path: "/Users/x/.claude/projects/p/memory/MEMORY.md",
          content: "- index entry",
        },
      }).ingested,
    ).toBe(false);
  });

  it("skips Edit tool calls (non-lossless on memory)", () => {
    const { sessionId, promptId, turnId } = seedTurn();
    expect(
      ingestAgentMemory(handle.raw, {
        sessionId,
        promptId,
        turnId,
        toolName: "Edit",
        toolInput: {
          file_path: "/Users/x/.claude/projects/p/memory/foo.md",
          old_string: "x",
          new_string: "y",
        },
      }).ingested,
    ).toBe(false);
  });
});

describe("Graceful degradation for unsupported agents", () => {
  it("SUPPORTED_AGENT_TYPES is locked to claude-code + codex", async () => {
    const { SUPPORTED_AGENT_TYPES } = await import("#src/runtime/capture/agent-memory.js");
    expect([...SUPPORTED_AGENT_TYPES].sort()).toEqual(["claude-code", "codex"]);
  });

  it.each(["gemini", "cursor", "windsurf", "copilot", "copilot-cli", "unknown"])(
    "ingestAgentMemory no-ops cleanly for unsupported agent_type=%s",
    (agentType) => {
      const { sessionId, promptId, turnId } = seedTurn();
      const result = ingestAgentMemory(handle.raw, {
        sessionId,
        promptId,
        turnId,
        agentType,
        toolName: "Write",
        toolInput: {
          // Even if the path matches Claude's layout exactly, an unsupported
          // agent_type must NOT trigger ingestion — graceful degradation.
          file_path: "/Users/x/.claude/projects/p/memory/foo.md",
          content: "---\ntype: feedback\n---\nbody",
        },
      });
      expect(result.ingested).toBe(false);
      expect(result.skippedReason).toContain("unsupported agent_type");
      const count = handle.raw.prepare(`SELECT COUNT(*) AS c FROM captures`).get() as { c: number };
      expect(count.c).toBe(0);
    },
  );

  it("isSupportedAgentType helper accepts only the closed set", async () => {
    const { isSupportedAgentType } = await import("#src/runtime/capture/agent-memory.js");
    expect(isSupportedAgentType("claude-code")).toBe(true);
    expect(isSupportedAgentType("codex")).toBe(true);
    expect(isSupportedAgentType("gemini")).toBe(false);
    expect(isSupportedAgentType("cursor")).toBe(false);
    expect(isSupportedAgentType(undefined)).toBe(false);
    expect(isSupportedAgentType("")).toBe(false);
  });

  it("resolveMemoryProvider returns null for unsupported agentType even when path matches", async () => {
    const { resolveMemoryProvider } = await import("#src/runtime/capture/agent-memory.js");
    expect(
      resolveMemoryProvider("Write", "/Users/x/.claude/projects/p/memory/foo.md", "gemini"),
    ).toBe(null);
    expect(resolveMemoryProvider("Write", "/Users/x/.codex/memories/foo.md", "cursor")).toBe(null);
  });

  it("ingestMemoryFile (used by retroactive scan) refuses unsupported agentType", async () => {
    const { ingestMemoryFile } = await import("#src/runtime/capture/agent-memory.js");
    const result = ingestMemoryFile(handle.raw, {
      sessionId: "s",
      turnId: 1,
      promptId: 1,
      agentType: "gemini",
      filePath: "/Users/x/.gemini/GEMINI.md",
      content: "anything",
    });
    expect(result.ingested).toBe(false);
    expect(result.skippedReason).toContain("unsupported agent_type");
  });
});

describe("Codex provider", () => {
  it("matches Codex memory writes under ~/.codex/memories/", async () => {
    const { codexProvider, resolveMemoryProvider } =
      await import("#src/runtime/capture/agent-memory.js");
    expect(
      codexProvider.isMemoryWrite(
        "Write",
        "/Users/x/.codex/memories/feedback_no_overengineering.md",
      ),
    ).toBe(true);
    expect(codexProvider.isMemoryWrite("Write", "/Users/x/.codex/memories/profile.json")).toBe(
      true,
    );
    expect(codexProvider.isMemoryWrite("Read", "/Users/x/.codex/memories/foo.md")).toBe(false);
    expect(codexProvider.isMemoryWrite("Write", "/Users/x/.codex/skills/foo/SKILL.md")).toBe(false);

    expect(
      resolveMemoryProvider("Write", "/Users/x/.codex/memories/foo.md", "codex")?.agentType,
    ).toBe("codex");
  });

  it("ingests a Codex memory write with codex- prefix on raw_marker", () => {
    const { sessionId, promptId, turnId } = seedTurn();
    const result = ingestAgentMemory(handle.raw, {
      sessionId,
      promptId,
      turnId,
      toolName: "Write",
      agentType: "codex",
      toolInput: {
        file_path: "/Users/x/.codex/memories/feedback_xyz.md",
        content: "---\ntype: feedback\n---\ncodex memory body",
      },
    });
    expect(result.ingested).toBe(true);
    expect(result.providerAgentType).toBe("codex");

    const row = handle.raw
      .prepare(`SELECT raw_marker, type FROM captures WHERE capture_id = ?`)
      .get(result.captureId!) as { raw_marker: string; type: string };
    expect(row.raw_marker).toMatch(/^codex-memory:\/\/.*:[a-f0-9]{16}$/);
    expect(row.type).toBe("FEEDBACK");
  });

  it("agent-aware dispatch picks the right provider when both could match", async () => {
    const { resolveMemoryProvider } = await import("#src/runtime/capture/agent-memory.js");
    // Path that ONLY Claude provider matches
    expect(
      resolveMemoryProvider("Write", "/Users/x/.claude/projects/proj/memory/foo.md", "claude-code")
        ?.agentType,
    ).toBe("claude-code");

    // Without agentType hint, the loop still finds Claude
    expect(
      resolveMemoryProvider("Write", "/Users/x/.claude/projects/proj/memory/foo.md")?.agentType,
    ).toBe("claude-code");

    // No path match → null
    expect(resolveMemoryProvider("Write", "/tmp/random.md", "claude-code")).toBe(null);
  });
});

describe("processPostToolUse — ingests memory writes alongside tool_calls", () => {
  it("a single Write to a memory file produces both a tool_calls row AND a capture", () => {
    ensureSession(handle.raw, {
      sessionId: "s",
      projectId: "p",
      agentType: "claude-code",
      workingDir: tmp,
    });
    const p = recordPrompt(handle.raw, { sessionId: "s", text: "remember X" });
    openTurn(handle.raw, { sessionId: "s", promptId: p.promptId, turnNo: p.turnNo });

    const result = processPostToolUse(handle, {
      sessionId: "s",
      cwd: tmp,
      toolName: "Write",
      toolInput: {
        file_path: "/Users/x/.claude/projects/-tmp-test/memory/feedback_no_overengineering.md",
        content: "---\ntype: feedback\nname: No over-engineering\n---\nbody",
      },
      toolResponse: { success: true },
    });

    expect(result.status).toBe("ok");
    expect(result.memoryCaptured).toBe(true);
    expect(result.memoryCaptureId).toBeGreaterThan(0);

    const counts = handle.raw
      .prepare(
        `SELECT (SELECT COUNT(*) FROM tool_calls) AS tools,
                (SELECT COUNT(*) FROM captures)   AS captures`,
      )
      .get() as { tools: number; captures: number };
    expect(counts.tools).toBe(1);
    expect(counts.captures).toBe(1);
  });
});

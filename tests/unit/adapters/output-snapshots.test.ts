/**
 * Adapter output semantic-assertions.
 *
 * CORE-034 — replaced the opaque `.toMatchSnapshot()` of the entire
 * instruction file (~50 LOC per adapter, 291 LOC total .snap) with
 * per-adapter semantic checks that document WHAT each adapter must
 * emit. Adapter-specific quirks (Skill Routing table, RESTRICTIONS
 * block, inline rule/skill content) are encoded as data in
 * `ADAPTER_EXPECTATIONS` so adding a new adapter means one new entry,
 * not 50 new lines of golden text.
 *
 * The full byte-equal snapshot approach masked any minor change in
 * boilerplate text behind a sea of test updates. The semantic version
 * fails only when the intended contract changes.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { claudeCodeAdapter } from "#src/adapters/claude-code.js";
import { cursorAdapter } from "#src/adapters/cursor.js";
import { codexAdapter } from "#src/adapters/codex.js";
import { windsurfAdapter } from "#src/adapters/windsurf.js";
import { clineAdapter } from "#src/adapters/cline.js";
import { copilotAdapter } from "#src/adapters/copilot.js";
import { createMockConfig } from "./mock-config.js";
import { PROJECT_NAME, MANIFEST_FILENAME } from "#src/constants.js";
import type { AgentAdapter } from "#src/types/agent.js";

const adapters: AgentAdapter[] = [
  claudeCodeAdapter,
  cursorAdapter,
  codexAdapter,
  windsurfAdapter,
  clineAdapter,
  copilotAdapter,
];

/**
 * Per-adapter expectations for the instruction file content emitted
 * from the mock config below. Captures the adapter-specific shape:
 *   - `restrictions`     — emits `RESTRICTIONS (ENFORCED)` block.
 *   - `skillRouting`     — embeds the `Skill Routing` table.
 *   - `inlineRule`       — embeds the rule content inline.
 *   - `inlineSkill`      — embeds the skill content inline.
 *
 * Adding a new adapter means appending one entry here, not 50 lines
 * of golden text.
 */
const ADAPTER_EXPECTATIONS: Record<
  string,
  {
    restrictions: boolean;
    skillRouting: boolean;
    inlineRule: boolean;
    inlineSkill: boolean;
  }
> = {
  "claude-code": { restrictions: false, skillRouting: false, inlineRule: false, inlineSkill: false },
  cursor: { restrictions: false, skillRouting: true, inlineRule: false, inlineSkill: false },
  codex: { restrictions: false, skillRouting: true, inlineRule: true, inlineSkill: false },
  windsurf: { restrictions: true, skillRouting: true, inlineRule: true, inlineSkill: true },
  cline: { restrictions: true, skillRouting: true, inlineRule: true, inlineSkill: true },
  copilot: { restrictions: true, skillRouting: true, inlineRule: true, inlineSkill: true },
};

describe("adapter instruction-file semantic shape (CORE-034)", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(
      tmpdir(),
      `${PROJECT_NAME}-snap-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  const config = createMockConfig({
    rules: [
      {
        name: "Code Style",
        description: "Enforce consistent code style",
        content: "Use 2-space indentation and single quotes.",
        priority: "high",
        alwaysApply: true,
        managedBy: PROJECT_NAME,
      },
    ],
    skills: [
      {
        name: "review",
        description: "Code review skill",
        content: "Review all code changes for quality.",
        priority: "high",
        alwaysApply: true,
        managedBy: PROJECT_NAME,
      },
    ],
    flags: {
      allow_force_push: {
        value: false,
        mode: "enforced",
        source: MANIFEST_FILENAME,
        locked: false,
      },
      allow_shell_commands: {
        value: true,
        mode: "enforced",
        source: MANIFEST_FILENAME,
        locked: false,
      },
    },
  });

  for (const adapter of adapters) {
    describe(`${adapter.id}`, () => {
      it("emits the canonical instruction-file shape", async () => {
        const files = await adapter.generate(config, { projectRoot: tmpDir });
        expect(files.length).toBeGreaterThan(0);
        const mainFile = files.find((f) => f.path === adapter.paths.instructionFile);
        expect(mainFile, `${adapter.id} must emit ${adapter.paths.instructionFile}`).toBeDefined();
        const content = mainFile!.content;
        const expectations = ADAPTER_EXPECTATIONS[adapter.id];
        expect(expectations, `add ${adapter.id} to ADAPTER_EXPECTATIONS`).toBeDefined();

        // ─── Common sections every adapter emits ─────────────────────
        expect(content).toContain("## Project Overview");
        expect(content).toContain("**Project:** test-project");
        expect(content).toContain("**Managed by:**");

        // Permission flags from the mock config.
        expect(content).toContain("Shell commands are allowed.");
        expect(content).toContain("Do NOT use force push");

        // Workflow boilerplate (5 stable subsections — modelled in
        // src/templates/sections/workflow.md).
        expect(content).toContain("## Workflow");
        expect(content).toContain("### Before Writing Code");
        expect(content).toContain("### Self-Evaluation Checklist");
        expect(content).toContain("### Commit Discipline");

        // Development Notes block summarising flag effects.
        expect(content).toContain("## Development Notes");
        expect(content).toContain("- Force push is not allowed");

        // Generated header marker (every adapter ends with this).
        expect(content).toContain("<!-- Generated by Codi");

        // ─── Adapter-specific shape switches ─────────────────────────
        if (expectations!.restrictions) {
          expect(content).toContain("## RESTRICTIONS (ENFORCED)");
          expect(content).toMatch(/BLOCKED:\s*git push --force/);
        } else {
          expect(content).not.toContain("## RESTRICTIONS (ENFORCED)");
        }

        if (expectations!.skillRouting) {
          expect(content).toContain("## Skill Routing");
          expect(content).toContain("| Skill | When to use |");
          expect(content).toContain("| review | Code review skill |");
        } else {
          expect(content).not.toContain("## Skill Routing");
        }

        if (expectations!.inlineRule) {
          // Rule content embedded directly in the instruction file.
          expect(content).toContain("Use 2-space indentation and single quotes.");
        } else {
          expect(content).not.toContain("Use 2-space indentation and single quotes.");
        }

        if (expectations!.inlineSkill) {
          expect(content).toContain("# Skill: review");
          expect(content).toContain("Review all code changes for quality.");
        } else {
          expect(content).not.toContain("# Skill: review");
        }
      });
    });
  }
});

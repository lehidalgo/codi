import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validateArtifacts } from "#src/runtime/brain/validate-artifacts.js";
import type { WorkflowDefinitionShape } from "#src/runtime/brain/seed-workflows.js";
import {
  CHAIN_BLOCK_BEGIN,
  CHAIN_BLOCK_END,
  renderChainSection,
} from "#src/runtime/brain/render-chains.js";

function tmpRoot(): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "codi-validate-"));
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function writeSkill(root: string, slug: string, frontmatter: string): void {
  const dir = join(root, slug);
  mkdirSync(dir, { recursive: true });
  const body = `import { PROJECT_NAME } from "#src/constants.js";\n\nexport const template = \`---\n${frontmatter}\n---\n\n# ${slug}\n\`;\n`;
  writeFileSync(join(dir, "template.ts"), body);
}

function writePhaseRef(root: string, workflowDir: string, phase: string, body: string): string {
  const dir = join(root, workflowDir, "references");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `phase-${phase}.md`);
  writeFileSync(path, body);
  return path;
}

function workflow(
  id: string,
  chains: Record<
    string,
    readonly { skill: string; role: "required" | "alt-entry" | "optional"; hint?: string }[]
  >,
): WorkflowDefinitionShape {
  const phases: Record<
    string,
    {
      gates: string[];
      next: string[];
      chains?: readonly {
        skill: string;
        role: "required" | "alt-entry" | "optional";
        hint?: string;
      }[];
    }
  > = {};
  for (const [name, c] of Object.entries(chains)) {
    phases[name] = { gates: [], next: [], chains: c };
  }
  return {
    id,
    name: id,
    description: "test",
    version: 2,
    phases,
  };
}

describe("validateArtifacts — Check #2 internal consistency", () => {
  it("passes when internal: true also has disable-model-invocation: true", () => {
    const t = tmpRoot();
    try {
      writeSkill(
        t.root,
        "evidence-gathering",
        "name: {{name}}\ndescription: x\nuser-invocable: true\ndisable-model-invocation: true\ninternal: true\nversion: 1",
      );
      const r = validateArtifacts({ skillsRoot: t.root, workflows: [] });
      expect(r.errors).toEqual([]);
    } finally {
      t.cleanup();
    }
  });

  it("flags internal: true skill with disable-model-invocation: false as error", () => {
    const t = tmpRoot();
    try {
      writeSkill(
        t.root,
        "broken-skill",
        "name: {{name}}\ndescription: x\nuser-invocable: true\ndisable-model-invocation: false\ninternal: true\nversion: 1",
      );
      const r = validateArtifacts({ skillsRoot: t.root, workflows: [] });
      const errs = r.errors.filter((e) => e.check === 2);
      expect(errs).toHaveLength(1);
      expect(errs[0].message).toContain("broken-skill");
      expect(errs[0].message).toContain("disable-model-invocation");
    } finally {
      t.cleanup();
    }
  });

  it("ignores skills without internal field", () => {
    const t = tmpRoot();
    try {
      writeSkill(
        t.root,
        "regular-skill",
        "name: {{name}}\ndescription: x\nuser-invocable: true\ndisable-model-invocation: false\nversion: 1",
      );
      const r = validateArtifacts({ skillsRoot: t.root, workflows: [] });
      expect(r.errors.filter((e) => e.check === 2)).toEqual([]);
    } finally {
      t.cleanup();
    }
  });
});

describe("validateArtifacts — Check #4 chain skill existence", () => {
  it("passes when every chain skill exists in catalog", () => {
    const t = tmpRoot();
    try {
      writeSkill(t.root, "discover", "name: {{name}}\nversion: 1");
      writeSkill(t.root, "step-documenter", "name: {{name}}\nversion: 1");
      const wf = workflow("feature", {
        intent: [
          { skill: "discover", role: "required" },
          { skill: "step-documenter", role: "optional", hint: "h" },
        ],
      });
      const r = validateArtifacts({ skillsRoot: t.root, workflows: [wf] });
      expect(r.errors.filter((e) => e.check === 4)).toEqual([]);
    } finally {
      t.cleanup();
    }
  });

  it("flags unknown skill in chain as error with workflow.phase location", () => {
    const t = tmpRoot();
    try {
      writeSkill(t.root, "discover", "name: {{name}}\nversion: 1");
      const wf = workflow("feature", {
        intent: [
          { skill: "discover", role: "required" },
          { skill: "ghost-skill", role: "optional", hint: "h" },
        ],
      });
      const r = validateArtifacts({ skillsRoot: t.root, workflows: [wf] });
      const errs = r.errors.filter((e) => e.check === 4);
      expect(errs).toHaveLength(1);
      expect(errs[0].message).toContain("ghost-skill");
      expect(errs[0].location).toBe("feature.intent");
    } finally {
      t.cleanup();
    }
  });

  it("reports multiple unknown skills across workflows", () => {
    const t = tmpRoot();
    try {
      const wfs = [
        workflow("feature", {
          intent: [{ skill: "missing-a", role: "required" }],
        }),
        workflow("bug-fix", {
          reproduce: [{ skill: "missing-b", role: "required" }],
        }),
      ];
      const r = validateArtifacts({ skillsRoot: t.root, workflows: wfs });
      const errs = r.errors.filter((e) => e.check === 4);
      expect(errs).toHaveLength(2);
      expect(errs.map((e) => e.location).sort()).toEqual(["bug-fix.reproduce", "feature.intent"]);
    } finally {
      t.cleanup();
    }
  });
});

describe("validateArtifacts — Check #7 phase-ref drift", () => {
  it("passes when phase-ref auto-generated block matches yaml", () => {
    const t = tmpRoot();
    try {
      writeSkill(t.root, "discover", "name: {{name}}\nversion: 1");
      const chains = [{ skill: "discover", role: "required" as const }];
      const expected = renderChainSection(chains);
      writePhaseRef(
        t.root,
        "feature-workflow",
        "intent",
        `# Phase: intent\n\n${expected}\n\nProse.\n`,
      );
      const wf = workflow("feature", { intent: chains });
      const r = validateArtifacts({ skillsRoot: t.root, workflows: [wf] });
      expect(r.errors.filter((e) => e.check === 7)).toEqual([]);
    } finally {
      t.cleanup();
    }
  });

  it("flags drift inside auto-generated block as error", () => {
    const t = tmpRoot();
    try {
      writeSkill(t.root, "discover", "name: {{name}}\nversion: 1");
      writeSkill(t.root, "old", "name: {{name}}\nversion: 1");
      const stale = renderChainSection([{ skill: "old", role: "required" }]);
      writePhaseRef(t.root, "feature-workflow", "intent", `# Phase: intent\n\n${stale}\n`);
      const wf = workflow("feature", {
        intent: [{ skill: "discover", role: "required" }],
      });
      const r = validateArtifacts({ skillsRoot: t.root, workflows: [wf] });
      const errs = r.errors.filter((e) => e.check === 7);
      expect(errs).toHaveLength(1);
      expect(errs[0].message).toContain("drift");
    } finally {
      t.cleanup();
    }
  });

  it("flags missing markers as warning, missing md as warning", () => {
    const t = tmpRoot();
    try {
      writeSkill(t.root, "discover", "name: {{name}}\nversion: 1");
      // Phase ref exists but lacks markers
      writePhaseRef(t.root, "feature-workflow", "intent", `# Phase: intent\n\nNo markers.\n`);
      // Phase ref does not exist for plan
      const wf = workflow("feature", {
        intent: [{ skill: "discover", role: "required" }],
        plan: [{ skill: "discover", role: "required" }],
      });
      const r = validateArtifacts({ skillsRoot: t.root, workflows: [wf] });
      const warns = r.warnings.filter((w) => w.check === 7);
      expect(warns.length).toBeGreaterThanOrEqual(2);
      expect(warns.some((w) => w.message.includes("BEGIN/END"))).toBe(true);
      expect(warns.some((w) => w.message.includes("no phase-*.md"))).toBe(true);
    } finally {
      t.cleanup();
    }
  });
});

describe("validateArtifacts — report shape", () => {
  it("returns checksRun listing the implemented checks", () => {
    const t = tmpRoot();
    try {
      const r = validateArtifacts({ skillsRoot: t.root, workflows: [] });
      expect(r.checksRun).toEqual([2, 4, 5, 7, 10]);
    } finally {
      t.cleanup();
    }
  });

  it("returns empty errors and warnings on a clean fixture", () => {
    const t = tmpRoot();
    try {
      const r = validateArtifacts({ skillsRoot: t.root, workflows: [] });
      expect(r.errors).toEqual([]);
      expect(r.warnings).toEqual([]);
    } finally {
      t.cleanup();
    }
  });
});

describe("validateArtifacts — Check #6 version bump on content change", () => {
  function tmpGitRepo(): { root: string; cleanup: () => void } | null {
    try {
      const root = mkdtempSync(join(tmpdir(), "codi-validate-git-"));
      execFileSync("git", ["init", "--quiet"], { cwd: root, stdio: "ignore" });
      execFileSync("git", ["config", "user.email", "test@test"], { cwd: root, stdio: "ignore" });
      execFileSync("git", ["config", "user.name", "test"], { cwd: root, stdio: "ignore" });
      execFileSync("git", ["config", "commit.gpgsign", "false"], { cwd: root, stdio: "ignore" });
      return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
    } catch {
      return null;
    }
  }

  function commit(root: string, message: string): void {
    execFileSync("git", ["add", "-A"], { cwd: root, stdio: "ignore" });
    execFileSync("git", ["commit", "--quiet", "-m", message, "--no-verify"], {
      cwd: root,
      stdio: "ignore",
    });
  }

  it("flags content change without version bump as error", () => {
    const t = tmpGitRepo();
    if (t === null) return;
    try {
      const skillsRoot = join(t.root, "src", "templates", "skills");
      writeSkill(skillsRoot, "x", "name: {{name}}\ndescription: original\nversion: 1");
      commit(t.root, "initial");
      const path = join(skillsRoot, "x", "template.ts");
      const original = readFileSync(path, "utf8");
      writeFileSync(
        path,
        original.replace("description: original", "description: changed-meaningfully"),
      );
      const r = validateArtifacts({ skillsRoot, workflows: [], repoRoot: t.root });
      const errs = r.errors.filter((e) => e.check === 6);
      expect(errs).toHaveLength(1);
      expect(errs[0].message).toContain("bump it");
      expect(errs[0].message).toContain("'x'");
    } finally {
      t.cleanup();
    }
  });

  it("passes when content changed AND version bumped", () => {
    const t = tmpGitRepo();
    if (t === null) return;
    try {
      const skillsRoot = join(t.root, "src", "templates", "skills");
      writeSkill(skillsRoot, "y", "name: {{name}}\ndescription: original\nversion: 5");
      commit(t.root, "initial");
      const path = join(skillsRoot, "y", "template.ts");
      const original = readFileSync(path, "utf8");
      writeFileSync(
        path,
        original
          .replace("description: original", "description: changed")
          .replace("version: 5", "version: 6"),
      );
      const r = validateArtifacts({ skillsRoot, workflows: [], repoRoot: t.root });
      expect(r.errors.filter((e) => e.check === 6)).toEqual([]);
    } finally {
      t.cleanup();
    }
  });

  it("passes when only whitespace/comments changed (normalized hash equal)", () => {
    const t = tmpGitRepo();
    if (t === null) return;
    try {
      const skillsRoot = join(t.root, "src", "templates", "skills");
      writeSkill(skillsRoot, "z", "name: {{name}}\ndescription: original\nversion: 1");
      commit(t.root, "initial");
      const path = join(skillsRoot, "z", "template.ts");
      const original = readFileSync(path, "utf8");
      writeFileSync(path, `// reformatted\n\n${original.replace(/\n/g, "\n\n")}`);
      const r = validateArtifacts({ skillsRoot, workflows: [], repoRoot: t.root });
      expect(r.errors.filter((e) => e.check === 6)).toEqual([]);
    } finally {
      t.cleanup();
    }
  });

  it("skips new skills with no HEAD version", () => {
    const t = tmpGitRepo();
    if (t === null) return;
    try {
      const skillsRoot = join(t.root, "src", "templates", "skills");
      writeSkill(skillsRoot, "_unrelated", "name: {{name}}\nversion: 1");
      commit(t.root, "init");
      writeSkill(skillsRoot, "brand-new", "name: {{name}}\nversion: 1");
      const r = validateArtifacts({ skillsRoot, workflows: [], repoRoot: t.root });
      const newSkillErrs = r.errors.filter((e) => e.check === 6 && e.message.includes("brand-new"));
      expect(newSkillErrs).toEqual([]);
    } finally {
      t.cleanup();
    }
  });

  it("does not run check #6 when repoRoot is omitted", () => {
    const t = tmpRoot();
    try {
      writeSkill(t.root, "any", "name: {{name}}\nversion: 1");
      const r = validateArtifacts({ skillsRoot: t.root, workflows: [] });
      expect(r.checksRun).not.toContain(6);
      expect(r.errors.filter((e) => e.check === 6)).toEqual([]);
    } finally {
      t.cleanup();
    }
  });

  it("includes check 6 in checksRun when repoRoot is provided", () => {
    const t = tmpGitRepo();
    if (t === null) return;
    try {
      const skillsRoot = join(t.root, "src", "templates", "skills");
      writeSkill(skillsRoot, "x", "name: {{name}}\nversion: 1");
      commit(t.root, "initial");
      const r = validateArtifacts({ skillsRoot, workflows: [], repoRoot: t.root });
      expect(r.checksRun).toContain(6);
    } finally {
      t.cleanup();
    }
  });
});

describe("validateArtifacts — repository smoke run", () => {
  it("runs cleanly against the real repo (no errors)", async () => {
    const { readBuiltinDefinitions } = await import("#src/runtime/brain/seed-workflows.js");
    const { resolve } = await import("node:path");
    const { unwrap } = await import("./_brain-helper.js");
    const skillsRoot = resolve(process.cwd(), "src", "templates", "skills");
    const workflows = unwrap(readBuiltinDefinitions());
    const r = validateArtifacts({ skillsRoot, workflows, repoRoot: process.cwd() });
    if (r.errors.length > 0) {
      console.error(r.errors);
    }
    expect(r.errors).toEqual([]);
  });
});

// Mark CHAIN_BLOCK_BEGIN / CHAIN_BLOCK_END as referenced so unused-import
// linters don't complain — the tests pull rendered blocks via renderChainSection
// rather than building markers by hand, but the constants are part of the
// public renderer API and worth importing alongside.
void CHAIN_BLOCK_BEGIN;
void CHAIN_BLOCK_END;

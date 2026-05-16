/**
 * CORE-024 — smoke tests for `scripts/guard-meta-skill-isolation.mjs`.
 *
 * Verifies the guard:
 *   - flags imports from #src/{core,cli,runtime,utils,adapters} inside
 *     `src/templates/skills/<codi-*|dev-*>/**`
 *   - ignores skills outside the meta namespace
 *   - allows #src/constants.js, #src/types/**, sibling skills, relative
 *     imports, third-party packages, Node built-ins
 *   - passes the real repository (regression sentinel)
 */
import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const execFileAsync = promisify(execFile);
const SCRIPT = resolve(process.cwd(), "scripts/guard-meta-skill-isolation.mjs");

interface RunResult {
  stdout: string;
  stderr: string;
  code: number;
}

async function runGuard(cwd: string): Promise<RunResult> {
  try {
    const { stdout, stderr } = await execFileAsync("node", [SCRIPT], { cwd });
    return { stdout, stderr, code: 0 };
  } catch (err) {
    const e = err as { stdout: string; stderr: string; code: number };
    return { stdout: e.stdout, stderr: e.stderr, code: e.code };
  }
}

function setupRepo(files: Array<{ path: string; content: string }>): string {
  const root = mkdtempSync(join(tmpdir(), "codi-guard-meta-"));
  for (const { path: rel, content } of files) {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

describe("guard-meta-skill-isolation (CORE-024)", () => {
  it("passes when no meta-skills exist", async () => {
    const root = setupRepo([]);
    try {
      // We need the skills dir to exist for the guard to read it.
      mkdirSync(join(root, "src/templates/skills"), { recursive: true });
      const r = await runGuard(root);
      expect(r.code).toBe(0);
      expect(r.stdout).toContain("0 meta-skill(s)");
      expect(r.stdout).toContain("Pass.");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when a codi-* skill imports from #src/core", async () => {
    const root = setupRepo([
      {
        path: "src/templates/skills/codi-bad/template.ts",
        content: 'import { Logger } from "#src/core/output/logger.js";\nexport const template = "x";\n',
      },
    ]);
    try {
      const r = await runGuard(root);
      expect(r.code).toBe(1);
      expect(r.stderr).toContain("codi-bad/template.ts");
      expect(r.stderr).toContain("banned root: #src/core");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when a dev-* skill imports from #src/cli", async () => {
    const root = setupRepo([
      {
        path: "src/templates/skills/dev-bad/index.ts",
        content: 'import { initFromOptions } from "#src/cli/shared.js";\nexport {};\n',
      },
    ]);
    try {
      const r = await runGuard(root);
      expect(r.code).toBe(1);
      expect(r.stderr).toContain("banned root: #src/cli");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on imports from #src/runtime, #src/utils, #src/adapters", async () => {
    const root = setupRepo([
      {
        path: "src/templates/skills/dev-multi/a.ts",
        content: 'import { foo } from "#src/runtime/types.js";\nexport {};\n',
      },
      {
        path: "src/templates/skills/dev-multi/b.ts",
        content: 'import { bar } from "#src/utils/paths.js";\nexport {};\n',
      },
      {
        path: "src/templates/skills/dev-multi/c.ts",
        content: 'import { baz } from "#src/adapters/index.js";\nexport {};\n',
      },
    ]);
    try {
      const r = await runGuard(root);
      expect(r.code).toBe(1);
      expect(r.stderr).toContain("#src/runtime");
      expect(r.stderr).toContain("#src/utils");
      expect(r.stderr).toContain("#src/adapters");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows #src/constants.js (pure data)", async () => {
    const root = setupRepo([
      {
        path: "src/templates/skills/codi-good/template.ts",
        content: 'import { PROJECT_NAME } from "#src/constants.js";\nexport const t = PROJECT_NAME;\n',
      },
    ]);
    try {
      const r = await runGuard(root);
      expect(r.code).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows #src/types/** (pure type definitions)", async () => {
    const root = setupRepo([
      {
        path: "src/templates/skills/dev-good/index.ts",
        content: 'import type { Logger } from "#src/types/logger.js";\nexport type L = Logger;\n',
      },
    ]);
    try {
      const r = await runGuard(root);
      expect(r.code).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows sibling skill imports (#src/templates/skills/**)", async () => {
    const root = setupRepo([
      {
        path: "src/templates/skills/codi-a/template.ts",
        content:
          'import { staticDir } from "#src/templates/skills/codi-b/index.js";\nexport const x = staticDir;\n',
      },
    ]);
    try {
      const r = await runGuard(root);
      expect(r.code).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows relative imports inside the skill", async () => {
    const root = setupRepo([
      {
        path: "src/templates/skills/dev-tree/template.ts",
        content: 'import { x } from "./helpers.js";\nexport const t = x;\n',
      },
    ]);
    try {
      const r = await runGuard(root);
      expect(r.code).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ignores skills outside the meta namespace (no codi-/dev- prefix)", async () => {
    const root = setupRepo([
      {
        path: "src/templates/skills/feature-workflow/template.ts",
        content: 'import { Logger } from "#src/core/output/logger.js";\nexport const t = Logger;\n',
      },
    ]);
    try {
      const r = await runGuard(root);
      expect(r.code).toBe(0);
      expect(r.stdout).toContain("0 meta-skill(s)");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ignores .test.ts and .d.ts files inside meta-skills", async () => {
    const root = setupRepo([
      {
        path: "src/templates/skills/codi-tested/something.test.ts",
        content: 'import { Logger } from "#src/core/output/logger.js";\nexport const t = Logger;\n',
      },
      {
        path: "src/templates/skills/codi-tested/types.d.ts",
        content: 'import { Logger } from "#src/core/output/logger.js";\nexport type T = Logger;\n',
      },
    ]);
    try {
      const r = await runGuard(root);
      expect(r.code).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("passes the real repository (regression sentinel)", async () => {
    const r = await runGuard(process.cwd());
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/\d+ meta-skill\(s\) \(codi-\* \+ dev-\*\)/);
    expect(r.stdout).toContain("Pass.");
  });
});

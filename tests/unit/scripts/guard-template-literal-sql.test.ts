/**
 * CORE-023 — smoke tests for `scripts/guard-template-literal-sql.mjs`.
 *
 * The guard scans `src/runtime/**` + `src/core/**` for
 * `.prepare(`...${...}`)` / `.exec(`...${...}`)` patterns. Tests
 * verify it: fails on offenders, passes when clean, honours
 * `codi-sql-allow:` markers (same line + up to 5 lines above), and
 * passes the real repository.
 */
import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const execFileAsync = promisify(execFile);
const SCRIPT = resolve(process.cwd(), "scripts/guard-template-literal-sql.mjs");

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
  const root = mkdtempSync(join(tmpdir(), "codi-guard-sql-"));
  for (const { path: rel, content } of files) {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

describe("guard-template-literal-sql (CORE-023)", () => {
  it("fails when .prepare interpolates a variable", async () => {
    const root = setupRepo([
      {
        path: "src/runtime/bad.ts",
        content: "const x = raw.prepare(`SELECT * FROM t WHERE id = ${userId}`).get();\n",
      },
    ]);
    try {
      const r = await runGuard(root);
      expect(r.code).toBe(1);
      expect(r.stderr).toContain("src/runtime/bad.ts");
      expect(r.stderr).toContain("line 1");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when .exec interpolates a variable", async () => {
    const root = setupRepo([
      {
        path: "src/core/bad.ts",
        content: "raw.exec(`DROP TABLE ${name}`);\n",
      },
    ]);
    try {
      const r = await runGuard(root);
      expect(r.code).toBe(1);
      expect(r.stderr).toContain("src/core/bad.ts");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("passes when prepare uses bind parameters (no interpolation)", async () => {
    const root = setupRepo([
      {
        path: "src/runtime/good.ts",
        content: "raw.prepare(`SELECT * FROM t WHERE id = ?`).get(userId);\n",
      },
    ]);
    try {
      const r = await runGuard(root);
      expect(r.code).toBe(0);
      expect(r.stdout).toContain("— pass.");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("passes when prepare uses a plain string (no backticks)", async () => {
    const root = setupRepo([
      {
        path: "src/runtime/plain.ts",
        content: 'raw.prepare("SELECT MAX(v) FROM _codi_schema_version").get();\n',
      },
    ]);
    try {
      const r = await runGuard(root);
      expect(r.code).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("honours same-line `codi-sql-allow:` marker", async () => {
    const root = setupRepo([
      {
        path: "src/runtime/allowed.ts",
        content:
          "raw.prepare(`PRAGMA table_info(${table})`).all(); // codi-sql-allow: PRAGMA cannot bind identifiers\n",
      },
    ]);
    try {
      const r = await runGuard(root);
      expect(r.code).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("honours `codi-sql-allow:` marker on the line above (single-line comment)", async () => {
    const root = setupRepo([
      {
        path: "src/runtime/allowed.ts",
        content:
          "// codi-sql-allow: hardcoded migration step input\n" +
          "raw.prepare(`PRAGMA table_info(${table})`).all();\n",
      },
    ]);
    try {
      const r = await runGuard(root);
      expect(r.code).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("honours `codi-sql-allow:` marker up to 5 lines above (multi-line comment)", async () => {
    const root = setupRepo([
      {
        path: "src/runtime/allowed.ts",
        content:
          "// codi-sql-allow: this column list is built from hardcoded\n" +
          "// `column = ?` fragments — only the VALUES are user-supplied\n" +
          "// and they use `?` placeholders, not interpolation.\n" +
          "raw.prepare(`UPDATE t SET ${cols.join(\",\")} WHERE id = ?`).run(...params);\n",
      },
    ]);
    try {
      const r = await runGuard(root);
      expect(r.code).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects offender when allow-marker is too far above (>5 lines)", async () => {
    const root = setupRepo([
      {
        path: "src/runtime/bad.ts",
        content:
          "// codi-sql-allow: stale comment 7 lines above\n" +
          "// line 2\n" +
          "// line 3\n" +
          "// line 4\n" +
          "// line 5\n" +
          "// line 6\n" +
          "// line 7\n" +
          "raw.prepare(`PRAGMA table_info(${table})`).all();\n",
      },
    ]);
    try {
      const r = await runGuard(root);
      expect(r.code).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ignores files outside src/runtime + src/core", async () => {
    const root = setupRepo([
      {
        path: "src/cli/bad.ts",
        content: "raw.prepare(`SELECT * FROM t WHERE id = ${userId}`);\n",
      },
      {
        path: "src/utils/bad.ts",
        content: "raw.prepare(`SELECT * FROM t WHERE id = ${userId}`);\n",
      },
    ]);
    try {
      const r = await runGuard(root);
      expect(r.code).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ignores .test.ts and .d.ts files", async () => {
    const root = setupRepo([
      {
        path: "src/runtime/something.test.ts",
        content: "raw.prepare(`SELECT * FROM t WHERE id = ${userId}`);\n",
      },
      {
        path: "src/runtime/types.d.ts",
        content: "raw.prepare(`SELECT * FROM t WHERE id = ${userId}`);\n",
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
    expect(r.stdout).toContain("— pass.");
  });
});

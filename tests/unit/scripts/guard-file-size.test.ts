/**
 * CORE-022 — smoke tests for `scripts/guard-file-size.mjs`.
 *
 * The guard is advisory (always exits 0) so we test its OUTPUT
 * contract: prints a `pass` line when every file is under the
 * threshold, and prints a sorted advisory list when any file is over.
 */
import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const execFileAsync = promisify(execFile);
const SCRIPT = resolve(process.cwd(), "scripts/guard-file-size.mjs");

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

function setupRepo(files: Array<{ path: string; lines: number }>): string {
  const root = mkdtempSync(join(tmpdir(), "codi-guard-fs-"));
  for (const { path: rel, lines } of files) {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, "x\n".repeat(lines));
  }
  return root;
}

describe("guard-file-size (CORE-022)", () => {
  it("always exits 0 — advisory guard never blocks", async () => {
    const root = setupRepo([{ path: "src/cli/huge.ts", lines: 2000 }]);
    try {
      const r = await runGuard(root);
      expect(r.code).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prints `pass` when every file is under the threshold", async () => {
    const root = setupRepo([
      { path: "src/cli/tiny.ts", lines: 50 },
      { path: "src/core/under.ts", lines: 699 },
    ]);
    try {
      const r = await runGuard(root);
      expect(r.stdout).toContain("no advisory hits");
      expect(r.stdout).toContain("— pass.");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("warns on files over 700 LOC and reports their line count", async () => {
    const root = setupRepo([
      { path: "src/cli/big.ts", lines: 800 },
      { path: "src/core/medium.ts", lines: 750 },
      { path: "src/cli/small.ts", lines: 100 },
    ]);
    try {
      const r = await runGuard(root);
      expect(r.stderr).toContain("2 file(s) over 700 LOC");
      expect(r.stderr).toContain("src/cli/big.ts: 800 LOC");
      expect(r.stderr).toContain("src/core/medium.ts: 750 LOC");
      expect(r.stderr).not.toContain("src/cli/small.ts");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("flags files over 1200 LOC with STRONG tag", async () => {
    const root = setupRepo([{ path: "src/cli/giant.ts", lines: 1500 }]);
    try {
      const r = await runGuard(root);
      expect(r.stderr).toContain("src/cli/giant.ts: 1500 LOC — STRONG");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("sorts offenders descending by line count", async () => {
    const root = setupRepo([
      { path: "src/cli/medium.ts", lines: 800 },
      { path: "src/cli/huge.ts", lines: 1500 },
      { path: "src/cli/large.ts", lines: 1000 },
    ]);
    try {
      const r = await runGuard(root);
      const hugeIdx = r.stderr.indexOf("huge.ts");
      const largeIdx = r.stderr.indexOf("large.ts");
      const mediumIdx = r.stderr.indexOf("medium.ts");
      expect(hugeIdx).toBeLessThan(largeIdx);
      expect(largeIdx).toBeLessThan(mediumIdx);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ignores .d.ts and .test.ts files", async () => {
    const root = setupRepo([
      { path: "src/cli/types.d.ts", lines: 2000 },
      { path: "src/cli/something.test.ts", lines: 2000 },
      { path: "src/cli/real.ts", lines: 100 },
    ]);
    try {
      const r = await runGuard(root);
      expect(r.stdout).toContain("— pass.");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ignores files outside src/cli and src/core (e.g. src/utils, scripts)", async () => {
    const root = setupRepo([
      { path: "src/utils/big.ts", lines: 2000 },
      { path: "scripts/something.mjs", lines: 2000 },
      { path: "src/cli/under.ts", lines: 100 },
    ]);
    try {
      const r = await runGuard(root);
      expect(r.stdout).toContain("— pass.");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("real-repo run: completes successfully (advisory, never fails)", async () => {
    const r = await runGuard(process.cwd());
    expect(r.code).toBe(0);
    expect(r.stdout + r.stderr).toContain("[guard-file-size]");
  });
});

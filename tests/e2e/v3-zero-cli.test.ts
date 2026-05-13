/**
 * v3 zero closure end-to-end CLI suite.
 *
 * Spawns the **built** binary (`dist/cli.js`) so we test the same artifact
 * users get from npm install. Each scenario uses an isolated tmp dir +
 * brain DB via CODI_BRAIN_DB so no global state leaks.
 *
 * The runtime e2e suite (`v3-zero-runtime.test.ts`) covers the orchestrators
 * in-process. This suite covers the CLI surface plus the dist asset
 * packaging contract.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";

// CLI tests spawn `node dist/cli.js` subprocesses; under heavy vitest
// parallelism the spawn cost dominates and an occasional run can take >10s.
// Bump per-suite timeout and allow one retry for the macOS CI flake.
const SUITE_TIMEOUT = 60_000;
const SUITE_RETRY = 2;

const REPO = process.cwd();
const CLI = join(REPO, "dist", "cli.js");

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
  json: Record<string, unknown> | null;
}

function ensureBuilt(): void {
  if (!existsSync(CLI)) {
    execFileSync("pnpm", ["build"], { cwd: REPO, stdio: "inherit" });
  }
  if (!existsSync(CLI)) throw new Error(`dist/cli.js missing at ${CLI}`);
}

function cli(args: string[], cwd: string, env: Record<string, string> = {}): CliResult {
  try {
    const stdout = execFileSync("node", [CLI, ...args, "--json"], {
      cwd,
      encoding: "utf-8",
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let json: Record<string, unknown> | null = null;
    try {
      json = JSON.parse(stdout) as Record<string, unknown>;
    } catch {
      json = null;
    }
    return { code: 0, stdout, stderr: "", json };
  } catch (err) {
    const e = err as {
      status?: number;
      stdout?: Buffer | string;
      stderr?: Buffer | string;
    };
    const stdout = typeof e.stdout === "string" ? e.stdout : (e.stdout?.toString() ?? "");
    const stderr = typeof e.stderr === "string" ? e.stderr : (e.stderr?.toString() ?? "");
    let json: Record<string, unknown> | null = null;
    try {
      json = JSON.parse(stdout) as Record<string, unknown>;
    } catch {
      json = null;
    }
    return { code: e.status ?? -1, stdout, stderr, json };
  }
}

let dir: string;
let brain: string;

beforeAll(() => {
  ensureBuilt();
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "codi-e2e-cli-"));
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs", "CONTEXT.md"), "# C\n", "utf-8");
  brain = join(dir, "brain.db");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// ─── S7 — `codi workflow` CLI surface ───────────────────────────────────────

describe(
  "S7 — codi workflow CLI happy path",
  { timeout: SUITE_TIMEOUT, retry: SUITE_RETRY },
  () => {
    it("run + status + scope propose+approve + transition + abandon", () => {
      let r = cli(["workflow", "run", "feature", "Build dark mode"], dir, { CODI_BRAIN_DB: brain });
      expect(r.code).toBe(0);
      expect(r.json?.success).toBe(true);
      expect((r.json?.data as Record<string, unknown>)?.workflowId as string).toMatch(
        /^feat-build-dark-mode-\d{8}/,
      );

      r = cli(["workflow", "status"], dir, { CODI_BRAIN_DB: brain });
      expect(r.code).toBe(0);
      const state = (r.json?.data as Record<string, unknown>)?.state as Record<string, unknown>;
      expect(state?.current_phase).toBe("intent");

      r = cli(
        ["workflow", "scope", "propose", "--file", "src/theme.ts", "--reason", "main switch"],
        dir,
        { CODI_BRAIN_DB: brain },
      );
      expect(r.code).toBe(0);
      expect(r.json?.success).toBe(true);

      r = cli(["workflow", "scope", "approve"], dir, { CODI_BRAIN_DB: brain });
      expect(r.code).toBe(0);
      expect(r.json?.success).toBe(true);

      r = cli(["workflow", "transition", "--to", "plan"], dir, { CODI_BRAIN_DB: brain });
      expect(r.code).toBe(0);
      r = cli(["workflow", "transition", "--approve"], dir, { CODI_BRAIN_DB: brain });
      expect(r.code).toBe(0);
      const tdata = (r.json?.data as Record<string, unknown>) ?? {};
      expect(tdata["fromPhase"]).toBe("intent");
      expect(tdata["toPhase"]).toBe("plan");

      r = cli(["workflow", "abandon", "--reason", "qa cleanup"], dir, { CODI_BRAIN_DB: brain });
      expect(r.code).toBe(0);
      expect(r.json?.success).toBe(true);

      r = cli(["workflow", "status"], dir, { CODI_BRAIN_DB: brain });
      const after = r.json?.data as Record<string, unknown>;
      expect(after?.active).toBe(false);
    });

    it("stats reports counts after a completed workflow", () => {
      cli(["workflow", "run", "feature", "Stats sample"], dir, { CODI_BRAIN_DB: brain });
      cli(["workflow", "abandon", "--reason", "stats sample"], dir, { CODI_BRAIN_DB: brain });

      const r = cli(["workflow", "stats"], dir, { CODI_BRAIN_DB: brain });
      expect(r.code).toBe(0);
      const data = r.json?.data as Record<string, unknown>;
      const durations = data?.durations as Record<string, unknown>;
      expect((durations?.workflowCount as number) >= 1).toBe(true);
    });

    it("recover after manual pointer clear restores the active workflow", () => {
      const initial = cli(["workflow", "run", "feature", "Recover me"], dir, {
        CODI_BRAIN_DB: brain,
      });
      const wId = (initial.json?.data as Record<string, unknown>)?.workflowId as string;

      // Manually clear the active-id pointer in the runtime_state row.
      const db = new Database(brain);
      try {
        db.prepare(`UPDATE runtime_state SET value = '{}' WHERE key = 'session'`).run();
      } finally {
        db.close();
      }

      const r = cli(["workflow", "recover"], dir, { CODI_BRAIN_DB: brain });
      expect(r.code).toBe(0);
      const data = r.json?.data as Record<string, unknown>;
      expect(data?.recovered).toBe(true);
      expect(data?.workflowId).toBe(wId);
    });
  },
);

describe(
  "S7 — codi workflow CLI error cases",
  { timeout: SUITE_TIMEOUT, retry: SUITE_RETRY },
  () => {
    it("rejects unknown workflow type with a clear message", () => {
      const r = cli(["workflow", "run", "ghost-type", "task"], dir, { CODI_BRAIN_DB: brain });
      expect(r.code).not.toBe(0);
      const data = r.json?.data as Record<string, unknown>;
      expect((data?.message as string) ?? "").toMatch(/unknown workflow type/i);
    });

    it("transition without any flag fails with mutually-exclusive guidance", () => {
      cli(["workflow", "run", "feature", "Trans"], dir, { CODI_BRAIN_DB: brain });
      const r = cli(["workflow", "transition"], dir, { CODI_BRAIN_DB: brain });
      expect(r.code).not.toBe(0);
      const data = r.json?.data as Record<string, unknown>;
      expect((data?.message as string) ?? "").toMatch(/--to.*--approve.*--reject/);
    });

    it("transition with bad phase reports the valid set", () => {
      cli(["workflow", "run", "feature", "Trans"], dir, { CODI_BRAIN_DB: brain });
      const r = cli(["workflow", "transition", "--to", "ghost-phase"], dir, {
        CODI_BRAIN_DB: brain,
      });
      expect(r.code).not.toBe(0);
      const data = r.json?.data as Record<string, unknown>;
      expect((data?.message as string) ?? "").toMatch(/unknown phase/i);
    });

    it("scope reject without --reason fails", () => {
      cli(["workflow", "run", "feature", "S"], dir, { CODI_BRAIN_DB: brain });
      cli(["workflow", "scope", "propose", "--file", "src/x.ts", "--reason", "x"], dir, {
        CODI_BRAIN_DB: brain,
      });
      // Commander surfaces missing required option as an error to stderr.
      const r = cli(["workflow", "scope", "reject"], dir, { CODI_BRAIN_DB: brain });
      expect(r.code).not.toBe(0);
    });
  },
);

// ─── S11 — Cross-feature full lifecycle via CLI ─────────────────────────────

describe(
  "S11 — full lifecycle through the built CLI",
  { timeout: SUITE_TIMEOUT, retry: SUITE_RETRY },
  () => {
    it("run → scope propose+approve → transition every phase → done", () => {
      const r1 = cli(["workflow", "run", "feature", "Full lifecycle"], dir, {
        CODI_BRAIN_DB: brain,
      });
      expect(r1.code).toBe(0);

      expect(
        cli(["workflow", "scope", "propose", "--file", "src/feature.ts", "--reason", "main"], dir, {
          CODI_BRAIN_DB: brain,
        }).code,
      ).toBe(0);
      expect(cli(["workflow", "scope", "approve"], dir, { CODI_BRAIN_DB: brain }).code).toBe(0);

      for (const phase of ["plan", "decompose", "execute", "verify", "done"]) {
        const propose = cli(["workflow", "transition", "--to", phase], dir, {
          CODI_BRAIN_DB: brain,
        });
        expect(propose.code).toBe(0);
        const approve = cli(["workflow", "transition", "--approve"], dir, {
          CODI_BRAIN_DB: brain,
        });
        expect(approve.code).toBe(0);
      }

      const status = cli(["workflow", "status"], dir, { CODI_BRAIN_DB: brain });
      const state = (status.json?.data as Record<string, unknown>)?.state as Record<
        string,
        unknown
      >;
      expect(state?.current_phase).toBe("done");
      expect(state?.status).toBe("completed");
    });
  },
);

// ─── S12 — Dist asset packaging contract ────────────────────────────────────

describe("S12 — dist/ asset bundling", { timeout: SUITE_TIMEOUT }, () => {
  it("ships JSON schemas next to the bundled chunk", () => {
    expect(existsSync(join(REPO, "dist", "schemas", "runtime", "manifest-event.schema.json"))).toBe(
      true,
    );
    expect(existsSync(join(REPO, "dist", "schemas", "runtime", "gate-result.schema.json"))).toBe(
      true,
    );
  });

  it("ships all 5 workflow definitions", () => {
    const expected = [
      "feature.yaml",
      "bug-fix.yaml",
      "refactor.yaml",
      "migration.yaml",
      "project.yaml",
    ];
    for (const f of expected) {
      expect(existsSync(join(REPO, "dist", "templates", "workflows", f))).toBe(true);
    }
  });
});

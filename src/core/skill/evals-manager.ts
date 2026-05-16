import fs from "node:fs/promises";
import path from "node:path";
import { ok, err } from "#src/types/result.js";
import type { Result } from "#src/types/result.js";
import { EvalsDataSchema } from "#src/schemas/evals.js";
import type { EvalsData } from "#src/schemas/evals.js";
import { createError } from "../output/errors.js";
import { EVALS_FILENAME } from "#src/constants.js";

function evalsPath(skillDir: string): string {
  return path.join(skillDir, "evals", EVALS_FILENAME);
}

export async function readEvals(skillDir: string): Promise<Result<EvalsData>> {
  const filePath = evalsPath(skillDir);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = EvalsDataSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return err([
        createError("E_FEEDBACK_INVALID", {
          reason: `Invalid evals format: ${parsed.error.message}`,
        }),
      ]);
    }
    return ok(parsed.data);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") {
      const skillName = path.basename(skillDir);
      return ok({ skillName, cases: [] });
    }
    return err([
      createError("E_FEEDBACK_NOT_FOUND", {
        path: filePath,
      }),
    ]);
  }
}

/**
 * Write the canonical `evals/evals.json` for a skill.
 *
 * ISSUE-080: kept as an in-process helper for test seeding. Eval-run
 * persistence in production now flows through brain.db's `eval_runs`
 * table (see ISSUE-050 + the `codi brain record-eval-run` subcommand).
 * Direct file writes only matter when seeding fixtures or hand-editing
 * an eval suite during skill development.
 */
export async function writeEvals(skillDir: string, data: EvalsData): Promise<Result<void>> {
  const filePath = evalsPath(skillDir);
  const dir = path.dirname(filePath);
  const tmpPath = `${filePath}.tmp.${Date.now()}`;

  try {
    await fs.mkdir(dir, { recursive: true });
    const withTimestamp = { ...data, lastUpdated: new Date().toISOString() };
    await fs.writeFile(tmpPath, JSON.stringify(withTimestamp, null, 2), "utf-8");
    await fs.rename(tmpPath, filePath);
    return ok(undefined);
  } catch (cause) {
    await fs.unlink(tmpPath).catch(() => {});
    return err([
      createError("E_FEEDBACK_WRITE_FAILED", {
        reason: (cause as Error).message,
      }),
    ]);
  }
}

// ISSUE-080 — `updateEvalResult` removed. Pass/fail flips now flow through
// brain.db `eval_runs` (ISSUE-050) instead of mutating the per-skill JSON.

export async function getEvalsSummary(
  skillDir: string,
): Promise<Result<{ total: number; passed: number; failed: number }>> {
  const readResult = await readEvals(skillDir);
  if (!readResult.ok) return readResult;

  const cases = readResult.data.cases;
  const total = cases.length;
  const passed = cases.filter((c) => c.passed === true).length;
  const failed = cases.filter((c) => c.passed === false).length;

  return ok({ total, passed, failed });
}

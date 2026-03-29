import fs from "node:fs/promises";
import path from "node:path";
import { ok, err } from "../../types/result.js";
import type { Result } from "../../types/result.js";
import { EvalsDataSchema } from "../../schemas/evals.js";
import type { EvalsData } from "../../schemas/evals.js";
import { createError } from "../output/errors.js";
import { EVALS_FILENAME } from "../../constants.js";

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

export async function writeEvals(
  skillDir: string,
  data: EvalsData,
): Promise<Result<void>> {
  const filePath = evalsPath(skillDir);
  const dir = path.dirname(filePath);
  const tmpPath = `${filePath}.tmp.${Date.now()}`;

  try {
    await fs.mkdir(dir, { recursive: true });
    const withTimestamp = { ...data, lastUpdated: new Date().toISOString() };
    await fs.writeFile(
      tmpPath,
      JSON.stringify(withTimestamp, null, 2),
      "utf-8",
    );
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

export async function updateEvalResult(
  skillDir: string,
  evalId: string,
  passed: boolean,
): Promise<Result<void>> {
  const readResult = await readEvals(skillDir);
  if (!readResult.ok) return readResult;

  const data = readResult.data;
  const evalCase = data.cases.find((c) => c.id === evalId);
  if (!evalCase) {
    return err([
      createError("E_FEEDBACK_NOT_FOUND", {
        path: `eval case "${evalId}" in ${skillDir}`,
      }),
    ]);
  }

  evalCase.passed = passed;
  evalCase.lastRunAt = new Date().toISOString();
  return writeEvals(skillDir, data);
}

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

import fs from "node:fs/promises";
import path from "node:path";
import { ok, err } from "../../types/result.js";
import type { Result } from "../../types/result.js";
import { FeedbackEntrySchema } from "../../schemas/feedback.js";
import type { FeedbackEntry } from "../../schemas/feedback.js";
import { createError } from "../output/errors.js";
import { Logger } from "../output/logger.js";
import {
  FEEDBACK_DIR,
  MAX_FEEDBACK_AGE_DAYS,
  MAX_FEEDBACK_ENTRIES,
} from "#src/constants.js";

function feedbackDir(configDir: string): string {
  return path.join(configDir, FEEDBACK_DIR);
}

export async function readAllFeedback(
  configDir: string,
): Promise<Result<FeedbackEntry[]>> {
  const dir = feedbackDir(configDir);
  const log = Logger.getInstance();

  let files: string[];
  try {
    const entries = await fs.readdir(dir);
    files = entries.filter((f) => f.endsWith(".json")).sort();
  } catch {
    return ok([]);
  }

  const results: FeedbackEntry[] = [];
  for (const file of files) {
    try {
      const raw = await fs.readFile(path.join(dir, file), "utf-8");
      const parsed = FeedbackEntrySchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        results.push(parsed.data);
      } else {
        log.warn(`Skipping invalid feedback file: ${file}`);
      }
    } catch {
      log.warn(`Skipping unreadable feedback file: ${file}`);
    }
  }

  return ok(results);
}

export async function readFeedbackForSkill(
  configDir: string,
  skillName: string,
): Promise<Result<FeedbackEntry[]>> {
  const allResult = await readAllFeedback(configDir);
  if (!allResult.ok) return allResult;
  return ok(allResult.data.filter((e) => e.skillName === skillName));
}

export async function writeFeedback(
  configDir: string,
  entry: FeedbackEntry,
): Promise<Result<string>> {
  const dir = feedbackDir(configDir);

  const parsed = FeedbackEntrySchema.safeParse(entry);
  if (!parsed.success) {
    return err([
      createError("E_FEEDBACK_INVALID", {
        reason: parsed.error.message,
      }),
    ]);
  }

  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (cause) {
    return err([
      createError("E_FEEDBACK_WRITE_FAILED", {
        reason: `Cannot create feedback directory: ${(cause as Error).message}`,
      }),
    ]);
  }

  const ts = entry.timestamp.replace(/[:.]/g, "-");
  const filename = `${ts}-${entry.skillName}.json`;
  const filePath = path.join(dir, filename);
  const tmpPath = `${filePath}.tmp.${Date.now()}`;

  try {
    await fs.writeFile(tmpPath, JSON.stringify(parsed.data, null, 2), "utf-8");
    await fs.rename(tmpPath, filePath);
    return ok(filePath);
  } catch (cause) {
    await fs.unlink(tmpPath).catch(() => {});
    return err([
      createError("E_FEEDBACK_WRITE_FAILED", {
        reason: (cause as Error).message,
      }),
    ]);
  }
}

export async function pruneFeedback(
  configDir: string,
  maxAgeDays: number = MAX_FEEDBACK_AGE_DAYS,
): Promise<Result<number>> {
  const allResult = await readAllFeedback(configDir);
  if (!allResult.ok) return allResult;

  const dir = feedbackDir(configDir);
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let pruned = 0;

  let files: string[];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    return ok(0);
  }

  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed = FeedbackEntrySchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        const entryTime = new Date(parsed.data.timestamp).getTime();
        if (entryTime < cutoff) {
          await fs.unlink(filePath);
          pruned++;
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  // Enforce MAX_FEEDBACK_ENTRIES per skill
  const remaining = await readAllFeedback(configDir);
  if (remaining.ok) {
    const bySkill = new Map<string, FeedbackEntry[]>();
    for (const e of remaining.data) {
      const list = bySkill.get(e.skillName) ?? [];
      list.push(e);
      bySkill.set(e.skillName, list);
    }

    for (const [, entries] of bySkill) {
      if (entries.length > MAX_FEEDBACK_ENTRIES) {
        const sorted = entries.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
        const toRemove = sorted.slice(0, sorted.length - MAX_FEEDBACK_ENTRIES);
        for (const e of toRemove) {
          const ts = e.timestamp.replace(/[:.]/g, "-");
          const filename = `${ts}-${e.skillName}.json`;
          try {
            await fs.unlink(path.join(dir, filename));
            pruned++;
          } catch {
            // Best-effort
          }
        }
      }
    }
  }

  return ok(pruned);
}

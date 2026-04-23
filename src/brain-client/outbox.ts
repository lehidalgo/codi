import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export interface OutboxEntry {
  method: "POST" | "PUT" | "DELETE";
  path: string;
  body: unknown;
  sessionId: string;
  createdAt?: string;
}

export interface FlushResult {
  drained: number;
  failed: number;
  quarantined: number;
}

export type FlushOne = (entry: OutboxEntry) => Promise<{ ok: boolean; retryable?: boolean }>;

function outboxDir(projectRoot: string): string {
  return path.join(projectRoot, ".codi", "brain-outbox");
}
function quarantineDir(projectRoot: string): string {
  return path.join(outboxDir(projectRoot), "quarantine");
}

export async function writeToOutbox(projectRoot: string, entry: OutboxEntry): Promise<string> {
  const dir = outboxDir(projectRoot);
  await fs.mkdir(dir, { recursive: true });
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString("hex");
  const file = path.join(dir, `${ts}_${entry.sessionId}_${rand}.json`);
  const payload = { ...entry, createdAt: new Date(ts).toISOString() };
  await fs.writeFile(file, JSON.stringify(payload), { flag: "wx" });
  return file;
}

export async function drainOutbox(projectRoot: string, flushOne: FlushOne): Promise<FlushResult> {
  const dir = outboxDir(projectRoot);
  let files: string[];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
      return { drained: 0, failed: 0, quarantined: 0 };
    throw e;
  }

  let drained = 0;
  let failed = 0;
  let quarantined = 0;

  for (const f of files) {
    const full = path.join(dir, f);
    let entry: OutboxEntry;
    try {
      entry = JSON.parse(await fs.readFile(full, "utf-8")) as OutboxEntry;
    } catch {
      const qDir = quarantineDir(projectRoot);
      await fs.mkdir(qDir, { recursive: true });
      await fs.rename(full, path.join(qDir, f));
      quarantined++;
      continue;
    }

    try {
      const result = await flushOne(entry);
      if (result.ok) {
        await fs.unlink(full);
        drained++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { drained, failed, quarantined };
}

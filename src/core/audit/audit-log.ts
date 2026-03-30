import fs from "node:fs/promises";
import path from "node:path";
import { AUDIT_FILENAME } from "#src/constants.js";

export interface AuditEntry {
  type: "generate" | "update" | "clean" | "init";
  timestamp: string;
  details: Record<string, unknown>;
}

export async function writeAuditEntry(
  configDir: string,
  entry: AuditEntry,
): Promise<void> {
  const auditPath = path.join(configDir, AUDIT_FILENAME);
  const line = JSON.stringify(entry) + "\n";
  await fs.appendFile(auditPath, line, "utf-8");
}

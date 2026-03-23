import fs from 'node:fs/promises';
import path from 'node:path';

export interface AuditEntry {
  type: 'generate' | 'update' | 'clean' | 'init';
  timestamp: string;
  details: Record<string, unknown>;
}

export async function writeAuditEntry(
  codiDir: string,
  entry: AuditEntry,
): Promise<void> {
  const auditPath = path.join(codiDir, 'audit.jsonl');
  const line = JSON.stringify(entry) + '\n';
  await fs.appendFile(auditPath, line, 'utf-8');
}

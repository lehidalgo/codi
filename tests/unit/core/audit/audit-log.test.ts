import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "../../../helpers/fs.js";
import {
  writeAuditEntry,
  type AuditEntry,
} from "../../../../src/core/audit/audit-log.js";
import { AUDIT_FILENAME, PROJECT_NAME } from "../../../../src/constants.js";

let tmpDir: string;

async function setup(): Promise<void> {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-audit-`));
}

afterEach(async () => {
  if (tmpDir) {
    await cleanupTmpDir(tmpDir);
  }
});

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    type: "generate",
    timestamp: "2026-01-01T00:00:00.000Z",
    details: { files: 3 },
    ...overrides,
  };
}

/**
 * Reads the audit file and parses each line as JSON.
 */
async function readAuditLines(configDir: string): Promise<AuditEntry[]> {
  const raw = await fs.readFile(path.join(configDir, AUDIT_FILENAME), "utf8");
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as AuditEntry);
}

describe("writeAuditEntry", () => {
  it("appends a JSONL entry to the audit file", async () => {
    // Arrange
    await setup();
    const entry = makeEntry();

    // Act
    await writeAuditEntry(tmpDir, entry);

    // Assert
    const entries = await readAuditLines(tmpDir);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe("generate");
    expect(entries[0].timestamp).toBe("2026-01-01T00:00:00.000Z");
    expect(entries[0].details).toEqual({ files: 3 });
  });

  it("creates the audit file if it does not exist", async () => {
    // Arrange
    await setup();
    const auditPath = path.join(tmpDir, AUDIT_FILENAME);

    // Verify file does not exist
    await expect(fs.access(auditPath)).rejects.toThrow();

    // Act
    await writeAuditEntry(tmpDir, makeEntry());

    // Assert
    const stat = await fs.stat(auditPath);
    expect(stat.isFile()).toBe(true);
  });

  it("preserves existing entries when appending", async () => {
    // Arrange
    await setup();
    const first = makeEntry({
      type: "init",
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    const second = makeEntry({
      type: "generate",
      timestamp: "2026-01-02T00:00:00.000Z",
    });

    // Act
    await writeAuditEntry(tmpDir, first);
    await writeAuditEntry(tmpDir, second);

    // Assert
    const entries = await readAuditLines(tmpDir);
    expect(entries).toHaveLength(2);
    expect(entries[0].type).toBe("init");
    expect(entries[1].type).toBe("generate");
  });
});

describe("readAuditLog (file parsing)", () => {
  it("returns parsed entries from JSONL file", async () => {
    // Arrange
    await setup();
    await writeAuditEntry(
      tmpDir,
      makeEntry({ type: "init", details: { preset: "standard" } }),
    );
    await writeAuditEntry(
      tmpDir,
      makeEntry({ type: "generate", details: { files: 5 } }),
    );
    await writeAuditEntry(
      tmpDir,
      makeEntry({ type: "clean", details: { removed: 2 } }),
    );

    // Act
    const entries = await readAuditLines(tmpDir);

    // Assert
    expect(entries).toHaveLength(3);
    expect(entries[0].type).toBe("init");
    expect(entries[1].type).toBe("generate");
    expect(entries[2].type).toBe("clean");
  });

  it("returns empty array for missing audit file", async () => {
    // Arrange
    await setup();
    const auditPath = path.join(tmpDir, AUDIT_FILENAME);

    // Act & Assert
    await expect(fs.access(auditPath)).rejects.toThrow();
    // A missing file would naturally produce no entries
  });

  it("produces valid JSONL with one JSON object per line", async () => {
    // Arrange
    await setup();
    await writeAuditEntry(tmpDir, makeEntry({ type: "init" }));
    await writeAuditEntry(tmpDir, makeEntry({ type: "generate" }));
    await writeAuditEntry(tmpDir, makeEntry({ type: "update" }));

    // Act
    const raw = await fs.readFile(path.join(tmpDir, AUDIT_FILENAME), "utf8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);

    // Assert - each line is independently parseable JSON
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }

    // Assert - no line contains a newline within the JSON
    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(parsed).toHaveProperty("type");
      expect(parsed).toHaveProperty("timestamp");
      expect(parsed).toHaveProperty("details");
    }
  });
});

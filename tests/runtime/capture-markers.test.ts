/**
 * Capture markers parser + persistence (Sprint 3).
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openBrain, applyMigrations } from "#src/runtime/brain/index.js";
import {
  parseMarkers,
  persistMarkers,
  CAPTURE_TYPES,
  isValidCaptureType,
} from "#src/runtime/capture/index.js";

function tmpBrain() {
  const dir = mkdtempSync(join(tmpdir(), "codi-capture-"));
  const handle = openBrain({ dbPath: join(dir, "brain.db") });
  applyMigrations(handle.raw);
  return {
    handle,
    cleanup: () => {
      handle.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

describe("parseMarkers", () => {
  it("extracts a single marker", () => {
    const out = parseMarkers('OK |RULE: "always commit at end of session"|');
    expect(out).toHaveLength(1);
    expect(out[0]!.type).toBe("RULE");
    expect(out[0]!.content).toBe("always commit at end of session");
  });

  it("extracts multiple markers preserving order", () => {
    const out = parseMarkers('foo |DECISION: "use SQLite"| bar |PREFERENCE: "no worktrees"|');
    expect(out.map((m) => m.type)).toEqual(["DECISION", "PREFERENCE"]);
    expect(out.map((m) => m.content)).toEqual(["use SQLite", "no worktrees"]);
  });

  it("ignores markers with unknown types", () => {
    const out = parseMarkers('|HIGHLIGHT: "not a real type"|');
    expect(out).toEqual([]);
  });

  it("ignores malformed markers (missing quote, missing colon)", () => {
    expect(parseMarkers("|RULE: missing quotes|")).toEqual([]);
    expect(parseMarkers('|RULE "no colon"|')).toEqual([]);
    expect(parseMarkers('|RULE: "no closing pipe"')).toEqual([]);
  });

  it("handles every canonical type in CAPTURE_TYPES", () => {
    for (const t of CAPTURE_TYPES) {
      const out = parseMarkers(`|${t}: "x"|`);
      expect(out, `type ${t} did not parse`).toHaveLength(1);
      expect(out[0]!.type).toBe(t);
    }
  });

  it('unescapes embedded \\" inside the content', () => {
    const out = parseMarkers('|INSIGHT: "user said \\"yes\\" twice"|');
    expect(out[0]!.content).toBe('user said "yes" twice');
  });

  it("isValidCaptureType narrows correctly", () => {
    expect(isValidCaptureType("RULE")).toBe(true);
    expect(isValidCaptureType("rule")).toBe(false); // case-sensitive
    expect(isValidCaptureType("XYZ")).toBe(false);
  });
});

describe("persistMarkers", () => {
  it("inserts each parsed marker into captures", () => {
    const t = tmpBrain();
    try {
      const markers = parseMarkers(
        '|DECISION: "ship sqlite first"| |INSIGHT: "ajv interop is painful"|',
      );
      const result = persistMarkers(
        t.handle.raw,
        {
          sessionId: "s1",
          promptId: 1,
          turnId: 1,
        },
        markers,
      );
      expect(result.inserted).toBe(2);
      expect(result.skippedDuplicates).toBe(0);

      const rows = t.handle.raw
        .prepare("SELECT type, content FROM captures ORDER BY capture_id")
        .all() as { type: string; content: string }[];
      expect(rows).toEqual([
        { type: "DECISION", content: "ship sqlite first" },
        { type: "INSIGHT", content: "ajv interop is painful" },
      ]);
    } finally {
      t.cleanup();
    }
  });

  it("is idempotent for the same (turn_id, raw_marker)", () => {
    const t = tmpBrain();
    try {
      const markers = parseMarkers('|RULE: "commit at end of session"|');
      const ctx = { sessionId: "s1", promptId: 1, turnId: 7 };
      const first = persistMarkers(t.handle.raw, ctx, markers);
      const second = persistMarkers(t.handle.raw, ctx, markers);
      expect(first.inserted).toBe(1);
      expect(second.inserted).toBe(0);
      expect(second.skippedDuplicates).toBe(1);

      const total = (
        t.handle.raw.prepare("SELECT COUNT(*) as c FROM captures").get() as { c: number }
      ).c;
      expect(total).toBe(1);
    } finally {
      t.cleanup();
    }
  });

  it("attaches file_paths as JSON when supplied", () => {
    const t = tmpBrain();
    try {
      const markers = parseMarkers('|FEEDBACK: "lint config drifted"|');
      persistMarkers(
        t.handle.raw,
        { sessionId: "s1", promptId: 1, turnId: 1, filePaths: ["a.ts", "b.ts"] },
        markers,
      );
      const row = t.handle.raw
        .prepare("SELECT file_paths FROM captures WHERE turn_id = 1")
        .get() as { file_paths: string };
      expect(JSON.parse(row.file_paths)).toEqual(["a.ts", "b.ts"]);
    } finally {
      t.cleanup();
    }
  });

  it("captures_fts trigger indexes new content for full-text search", () => {
    const t = tmpBrain();
    try {
      const markers = parseMarkers('|INSIGHT: "drizzle-kit does not generate fts5"|');
      persistMarkers(t.handle.raw, { sessionId: "s1", promptId: 1, turnId: 1 }, markers);
      const hits = t.handle.raw
        .prepare("SELECT rowid FROM captures_fts WHERE captures_fts MATCH 'drizzle'")
        .all() as { rowid: number }[];
      expect(hits.length).toBe(1);
    } finally {
      t.cleanup();
    }
  });
});

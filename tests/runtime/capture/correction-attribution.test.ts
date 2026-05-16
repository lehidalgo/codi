/**
 * ISSUE-049 — write-time correction attribution.
 *
 * Verifies that when a CORRECTION marker is persisted via `persistMarkers`,
 * a row is also inserted into `corrections` with `linked_artifacts`
 * populated from `artifacts_used` at the exact (session_id, turn_id) the
 * correction was captured.
 *
 * This drives the real code path: open brain → apply migrations
 * (including v12 ALTER TABLE corrections ADD linked_artifacts) → record
 * artifact usage → persist a CORRECTION marker → assert row content.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBrain } from "#src/runtime/brain/db.js";
import { applyMigrations } from "#src/runtime/brain/migrate.js";
import { persistMarkers } from "#src/runtime/capture/persist.js";
import {
  ensureProject,
  ensureSession,
  recordArtifactUsage,
  recordPrompt,
  openTurn,
} from "#src/runtime/capture/session.js";

describe("ISSUE-049 — corrections link to active artifacts at write-time", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "codi-corr-link-"));
    dbPath = join(tmpDir, "brain.db");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function setupSession(handle: ReturnType<typeof openBrain>): {
    sessionId: string;
    turnId: number;
    promptId: number;
  } {
    const raw = handle.raw;
    ensureProject(raw, { projectId: "p1", cwd: tmpDir });
    ensureSession(raw, {
      sessionId: "session-1",
      projectId: "p1",
      agentType: "claude-code",
      workingDir: tmpDir,
    });
    const p = recordPrompt(raw, { sessionId: "session-1", text: "user prompt" });
    const turnId = openTurn(raw, {
      sessionId: "session-1",
      promptId: p.promptId,
      turnNo: p.turnNo,
    });
    return { sessionId: "session-1", turnId, promptId: p.promptId };
  }

  it("CORRECTION marker writes a corrections row linking to active artifacts", () => {
    const handle = openBrain({ dbPath });
    applyMigrations(handle.raw);
    try {
      const { sessionId, turnId, promptId } = setupSession(handle);

      // Snapshot of artifacts active in this turn
      recordArtifactUsage(handle.raw, {
        sessionId,
        turnId,
        artifactType: "skill",
        artifactName: "codi-commit",
        event: "invoked",
      });
      recordArtifactUsage(handle.raw, {
        sessionId,
        turnId,
        artifactType: "rule",
        artifactName: "codi-typescript",
        event: "invoked",
      });

      persistMarkers(handle.raw, { sessionId, turnId, promptId }, [
        {
          type: "CORRECTION",
          content: "use pnpm not npm",
          rawMarker: '|CORRECTION: "use pnpm not npm"|',
          offset: 0,
        },
      ]);

      const row = handle.raw
        .prepare(`SELECT * FROM corrections WHERE session_id = ?`)
        .get(sessionId) as
        | {
            diff_summary: string;
            source_turn_id: number;
            detected_via: string;
            linked_artifacts: string;
          }
        | undefined;
      expect(row).toBeDefined();
      expect(row!.diff_summary).toBe("use pnpm not npm");
      expect(row!.source_turn_id).toBe(turnId);
      expect(row!.detected_via).toBe("iron-law-9-marker");
      const linked = JSON.parse(row!.linked_artifacts) as string[];
      expect(linked.sort()).toEqual(["codi-commit", "codi-typescript"]);
    } finally {
      handle.close();
    }
  });

  it("non-CORRECTION markers do NOT produce corrections rows", () => {
    const handle = openBrain({ dbPath });
    applyMigrations(handle.raw);
    try {
      const { sessionId, turnId, promptId } = setupSession(handle);
      persistMarkers(handle.raw, { sessionId, turnId, promptId }, [
        {
          type: "OBSERVATION",
          content: "agent noted something",
          rawMarker: '|OBSERVATION: "agent noted something"|',
          offset: 0,
        },
      ]);
      const count = handle.raw.prepare(`SELECT COUNT(*) AS n FROM corrections`).get() as {
        n: number;
      };
      expect(count.n).toBe(0);
    } finally {
      handle.close();
    }
  });

  it("CORRECTION with no active artifacts records linked_artifacts as NULL", () => {
    const handle = openBrain({ dbPath });
    applyMigrations(handle.raw);
    try {
      const { sessionId, turnId, promptId } = setupSession(handle);
      persistMarkers(handle.raw, { sessionId, turnId, promptId }, [
        {
          type: "CORRECTION",
          content: "no skill was invoked this turn",
          rawMarker: '|CORRECTION: "no skill was invoked this turn"|',
          offset: 0,
        },
      ]);
      const row = handle.raw
        .prepare(`SELECT linked_artifacts FROM corrections WHERE session_id = ?`)
        .get(sessionId) as { linked_artifacts: string | null };
      expect(row.linked_artifacts).toBeNull();
    } finally {
      handle.close();
    }
  });
});

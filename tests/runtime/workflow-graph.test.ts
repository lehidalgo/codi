/**
 * Phase graph enforcement (F4 of v3 zero closure).
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openBrain, applyMigrations, seedWorkflowDefinitions } from "#src/runtime/brain/index.js";
import {
  loadDefinition,
  nextPhases,
  gatesForPhase,
  assertLegalTransition,
  UnknownWorkflowTypeError,
  IllegalPhaseTransitionError,
} from "#src/runtime/workflow-graph.js";

function tmpSeededBrain() {
  const dir = mkdtempSync(join(tmpdir(), "codi-graph-"));
  const handle = openBrain({ dbPath: join(dir, "brain.db") });
  applyMigrations(handle.raw);
  seedWorkflowDefinitions(handle.raw);
  return {
    handle,
    cleanup: () => {
      handle.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

describe("loadDefinition", () => {
  it("returns the seeded feature workflow definition", () => {
    const t = tmpSeededBrain();
    try {
      const d = loadDefinition(t.handle.raw, "feature");
      expect(d.id).toBe("feature");
      expect(d.phases.intent).toBeDefined();
      expect(d.phases.done).toBeDefined();
    } finally {
      t.cleanup();
    }
  });

  it("throws UnknownWorkflowTypeError for unknown id", () => {
    const t = tmpSeededBrain();
    try {
      expect(() => loadDefinition(t.handle.raw, "nonexistent")).toThrow(UnknownWorkflowTypeError);
    } finally {
      t.cleanup();
    }
  });
});

describe("nextPhases", () => {
  it("returns the legal next phases for feature.intent", () => {
    const t = tmpSeededBrain();
    try {
      expect(nextPhases(t.handle.raw, "feature", "intent").sort()).toEqual(["abandoned", "plan"]);
    } finally {
      t.cleanup();
    }
  });

  it("returns empty array for terminal phases", () => {
    const t = tmpSeededBrain();
    try {
      expect(nextPhases(t.handle.raw, "feature", "done")).toEqual([]);
      expect(nextPhases(t.handle.raw, "feature", "abandoned")).toEqual([]);
    } finally {
      t.cleanup();
    }
  });
});

describe("gatesForPhase", () => {
  it("returns gates declared in the YAML", () => {
    const t = tmpSeededBrain();
    try {
      expect(gatesForPhase(t.handle.raw, "feature", "intent")).toContain("task_described");
      expect(gatesForPhase(t.handle.raw, "feature", "verify")).toContain("validation_passes");
    } finally {
      t.cleanup();
    }
  });

  it("returns empty for phases without gates", () => {
    const t = tmpSeededBrain();
    try {
      expect(gatesForPhase(t.handle.raw, "feature", "decompose")).toEqual([]);
    } finally {
      t.cleanup();
    }
  });
});

describe("assertLegalTransition", () => {
  it("permits legal feature transitions", () => {
    const t = tmpSeededBrain();
    try {
      assertLegalTransition(t.handle.raw, "feature", "intent", "plan");
      assertLegalTransition(t.handle.raw, "feature", "plan", "decompose");
      assertLegalTransition(t.handle.raw, "feature", "verify", "done");
    } finally {
      t.cleanup();
    }
  });

  it("rejects illegal feature transitions", () => {
    const t = tmpSeededBrain();
    try {
      // bug-fix-style phase doesn't exist in feature graph
      expect(() => assertLegalTransition(t.handle.raw, "feature", "intent", "reproduce")).toThrow(
        IllegalPhaseTransitionError,
      );
      // skip from intent straight to done
      expect(() => assertLegalTransition(t.handle.raw, "feature", "intent", "done")).toThrow(
        IllegalPhaseTransitionError,
      );
    } finally {
      t.cleanup();
    }
  });

  it("isolates each workflow type's phase set", () => {
    const t = tmpSeededBrain();
    try {
      // bug-fix has reproduce but feature doesn't
      assertLegalTransition(t.handle.raw, "bug-fix", "intent", "reproduce");
      expect(() => assertLegalTransition(t.handle.raw, "feature", "intent", "reproduce")).toThrow(
        IllegalPhaseTransitionError,
      );

      // migration has data-validation but feature doesn't
      assertLegalTransition(t.handle.raw, "migration", "execute", "data-validation");
      expect(() =>
        assertLegalTransition(t.handle.raw, "feature", "execute", "data-validation"),
      ).toThrow(IllegalPhaseTransitionError);
    } finally {
      t.cleanup();
    }
  });

  it("error message lists allowed next phases", () => {
    const t = tmpSeededBrain();
    try {
      try {
        assertLegalTransition(t.handle.raw, "feature", "intent", "done");
      } catch (e) {
        expect(e).toBeInstanceOf(IllegalPhaseTransitionError);
        expect((e as Error).message).toContain("intent → done");
        expect((e as Error).message).toContain("Allowed next phases:");
      }
    } finally {
      t.cleanup();
    }
  });
});

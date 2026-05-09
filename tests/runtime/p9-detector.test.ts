/**
 * F10 — P9 detector tests.
 *
 * P9 turns OBSERVATION captures naming an installed artifact into
 * OPTIMIZE_EXISTING_ARTIFACT proposals once the per-artifact reference
 * count crosses the evidence threshold.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBrain, applyMigrations, type BrainHandle } from "#src/runtime/brain/index.js";
import { p9ArtifactObservation } from "#src/runtime/consolidate/patterns.js";
import { ensureSession, recordPrompt, openTurn } from "#src/runtime/capture/session.js";
import { persistMarkers } from "#src/runtime/capture/persist.js";

let tmp: string;
let handle: BrainHandle;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "codi-p9-"));
  handle = openBrain({ dbPath: join(tmp, "brain.db") });
  applyMigrations(handle.raw);
});

afterEach(() => {
  handle.close();
  rmSync(tmp, { recursive: true, force: true });
});

function seedSession(): { sessionId: string; turnId: number; promptId: number } {
  const sessionId = "s";
  ensureSession(handle.raw, {
    sessionId,
    projectId: "p",
    agentType: "claude-code",
    workingDir: tmp,
  });
  const p = recordPrompt(handle.raw, { sessionId, text: "x" });
  const turnId = openTurn(handle.raw, { sessionId, promptId: p.promptId, turnNo: p.turnNo });
  return { sessionId, turnId, promptId: p.promptId };
}

function addObservation(sessionId: string, promptId: number, turnId: number, text: string): void {
  persistMarkers(handle.raw, { sessionId, promptId, turnId }, [
    { type: "OBSERVATION", content: text, rawMarker: `|OBSERVATION: "${text}"|`, offset: 0 },
  ]);
}

describe("p9ArtifactObservation", () => {
  it("returns no proposals when the catalog is empty", () => {
    const proposals = p9ArtifactObservation.detect(handle.raw, { installedArtifacts: [] });
    expect(proposals).toEqual([]);
  });

  it("returns no proposals when no OBSERVATION captures exist", () => {
    const proposals = p9ArtifactObservation.detect(handle.raw, {
      installedArtifacts: [{ name: "codi-commit", kind: "skill" }],
    });
    expect(proposals).toEqual([]);
  });

  it("ignores observations referencing artifacts not in the catalog", () => {
    const { sessionId, promptId, turnId } = seedSession();
    addObservation(sessionId, promptId, turnId, "ghost-skill missing-step");
    addObservation(sessionId, promptId, turnId, "ghost-skill outdated-rule");
    addObservation(sessionId, promptId, turnId, "ghost-skill missing-example");
    const proposals = p9ArtifactObservation.detect(handle.raw, {
      installedArtifacts: [{ name: "codi-commit", kind: "skill" }],
      minEvidence: 3,
    });
    expect(proposals).toEqual([]);
  });

  it("emits one proposal when ≥minEvidence observations name the same artifact", () => {
    const { sessionId, promptId, turnId } = seedSession();
    addObservation(
      sessionId,
      promptId,
      turnId,
      "codi-commit trigger-miss when user typed /codi-commit",
    );
    addObservation(sessionId, promptId, turnId, "codi-commit missing-step before staging files");
    addObservation(
      sessionId,
      promptId,
      turnId,
      "codi-commit outdated-rule conventional commits format",
    );
    const proposals = p9ArtifactObservation.detect(handle.raw, {
      installedArtifacts: [{ name: "codi-commit", kind: "skill" }],
      minEvidence: 3,
    });
    expect(proposals).toHaveLength(1);
    const p = proposals[0]!;
    expect(p.patternCode).toBe("P9");
    expect(p.proposalType).toBe("OPTIMIZE_EXISTING_ARTIFACT");
    expect(p.artifactKind).toBe("skill");
    expect(p.artifactName).toBe("codi-commit");
    expect(p.evidence).toHaveLength(3);
    expect(p.evidence[0]?.source).toBe("captures");
  });

  it("does not emit a proposal below minEvidence", () => {
    const { sessionId, promptId, turnId } = seedSession();
    addObservation(sessionId, promptId, turnId, "codi-commit trigger-miss A");
    addObservation(sessionId, promptId, turnId, "codi-commit trigger-miss B");
    const proposals = p9ArtifactObservation.detect(handle.raw, {
      installedArtifacts: [{ name: "codi-commit", kind: "skill" }],
      minEvidence: 3,
    });
    expect(proposals).toEqual([]);
  });

  it("matches case-insensitively", () => {
    const { sessionId, promptId, turnId } = seedSession();
    addObservation(sessionId, promptId, turnId, "CODI-COMMIT outdated 1");
    addObservation(sessionId, promptId, turnId, "Codi-Commit outdated 2");
    addObservation(sessionId, promptId, turnId, "codi-commit outdated 3");
    const proposals = p9ArtifactObservation.detect(handle.raw, {
      installedArtifacts: [{ name: "codi-commit", kind: "skill" }],
      minEvidence: 3,
    });
    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.evidence).toHaveLength(3);
  });

  it("groups by artifact when multiple are referenced across captures", () => {
    const { sessionId, promptId, turnId } = seedSession();
    addObservation(sessionId, promptId, turnId, "codi-commit trigger-miss 1");
    addObservation(sessionId, promptId, turnId, "codi-commit trigger-miss 2");
    addObservation(sessionId, promptId, turnId, "codi-commit trigger-miss 3");
    addObservation(sessionId, promptId, turnId, "codi-testing outdated 1");
    addObservation(sessionId, promptId, turnId, "codi-testing outdated 2");
    addObservation(sessionId, promptId, turnId, "codi-testing outdated 3");
    const proposals = p9ArtifactObservation.detect(handle.raw, {
      installedArtifacts: [
        { name: "codi-commit", kind: "skill" },
        { name: "codi-testing", kind: "rule" },
      ],
      minEvidence: 3,
    });
    expect(proposals).toHaveLength(2);
    const names = proposals.map((p) => p.artifactName).sort();
    expect(names).toEqual(["codi-commit", "codi-testing"]);
    const commit = proposals.find((p) => p.artifactName === "codi-commit");
    const testing = proposals.find((p) => p.artifactName === "codi-testing");
    expect(commit?.artifactKind).toBe("skill");
    expect(testing?.artifactKind).toBe("rule");
  });

  it("orders proposals by evidence count (highest first)", () => {
    const { sessionId, promptId, turnId } = seedSession();
    for (let i = 0; i < 3; i += 1) addObservation(sessionId, promptId, turnId, `codi-a ${i}`);
    for (let i = 0; i < 5; i += 1) addObservation(sessionId, promptId, turnId, `codi-b ${i}`);
    const proposals = p9ArtifactObservation.detect(handle.raw, {
      installedArtifacts: [
        { name: "codi-a", kind: "skill" },
        { name: "codi-b", kind: "skill" },
      ],
      minEvidence: 3,
    });
    expect(proposals).toHaveLength(2);
    expect(proposals[0]?.artifactName).toBe("codi-b");
    expect(proposals[0]?.evidence).toHaveLength(5);
    expect(proposals[1]?.artifactName).toBe("codi-a");
  });

  it("respects sinceTs window — older captures are excluded", () => {
    const { sessionId, promptId, turnId } = seedSession();
    // Insert 2 fresh + 2 stale captures referencing the same artifact.
    addObservation(sessionId, promptId, turnId, "codi-commit fresh 1");
    addObservation(sessionId, promptId, turnId, "codi-commit fresh 2");
    handle.raw
      .prepare(
        `UPDATE captures SET ts = 1
         WHERE capture_id IN (
           SELECT capture_id FROM captures ORDER BY capture_id DESC LIMIT 1
         )`,
      )
      .run();
    // Only 1 fresh remains in window — below minEvidence=2 so no proposal.
    const proposals = p9ArtifactObservation.detect(handle.raw, {
      installedArtifacts: [{ name: "codi-commit", kind: "skill" }],
      minEvidence: 2,
      sinceTs: 1000,
    });
    expect(proposals).toEqual([]);
  });

  it("a proposal carries the full capture content as snippets", () => {
    const { sessionId, promptId, turnId } = seedSession();
    const samples = [
      "codi-commit outdated thing 1",
      "codi-commit outdated thing 2",
      "codi-commit outdated thing 3",
    ];
    for (const s of samples) addObservation(sessionId, promptId, turnId, s);
    const proposals = p9ArtifactObservation.detect(handle.raw, {
      installedArtifacts: [{ name: "codi-commit", kind: "skill" }],
      minEvidence: 3,
    });
    expect(proposals).toHaveLength(1);
    const snippets = proposals[0]?.evidence.map((e) => e.snippet).sort() ?? [];
    expect(snippets).toEqual(samples.slice().sort());
  });
});

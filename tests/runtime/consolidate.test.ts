/**
 * Sprint 5 — consolidation pipeline.
 *
 * Patterns are pure SQL over the brain DB; tests seed deterministic data
 * and assert that the right proposals come out. Repo round-trip is also
 * covered: insert → list → decide → list (status changed).
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openBrain, applyMigrations } from "#src/runtime/brain/index.js";
import {
  insertProposal,
  listProposals,
  getProposal,
  decideProposal,
  p1RepeatedCorrection,
  p2UnusedSkill,
  p5NewPattern,
  type Proposal,
} from "#src/runtime/consolidate/index.js";

function tmpBrain() {
  const dir = mkdtempSync(join(tmpdir(), "codi-consolidate-"));
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

const baseProposal: Proposal = {
  patternCode: "P1",
  proposalType: "PROMOTE_TO_RULE",
  artifactKind: "rule",
  artifactName: null,
  title: "test",
  rationale: "because",
  patch: null,
  evidence: [{ id: 1, source: "captures" }],
};

describe("repo: insert / list / get", () => {
  it("inserts and reads back", () => {
    const t = tmpBrain();
    try {
      const id = insertProposal(t.handle.raw, baseProposal);
      expect(id).toBeGreaterThan(0);
      const got = getProposal(t.handle.raw, id);
      expect(got?.title).toBe("test");
      expect(got?.status).toBe("pending");
      expect(got?.evidence).toEqual([{ id: 1, source: "captures" }]);
    } finally {
      t.cleanup();
    }
  });

  it("filters list by status", () => {
    const t = tmpBrain();
    try {
      const a = insertProposal(t.handle.raw, baseProposal);
      const b = insertProposal(t.handle.raw, baseProposal);
      decideProposal(t.handle.raw, { proposalId: a, status: "accepted" });
      const pending = listProposals(t.handle.raw, { status: "pending" });
      expect(pending.map((p) => p.proposalId)).toEqual([b]);
      const accepted = listProposals(t.handle.raw, { status: "accepted" });
      expect(accepted.map((p) => p.proposalId)).toEqual([a]);
    } finally {
      t.cleanup();
    }
  });

  it("decideProposal rejects already-decided", () => {
    const t = tmpBrain();
    try {
      const id = insertProposal(t.handle.raw, baseProposal);
      const first = decideProposal(t.handle.raw, {
        proposalId: id,
        status: "accepted",
      });
      const second = decideProposal(t.handle.raw, {
        proposalId: id,
        status: "rejected",
      });
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(false);
      expect(second.error).toBe("already_decided");
    } finally {
      t.cleanup();
    }
  });

  it("decideProposal returns not_found for unknown id", () => {
    const t = tmpBrain();
    try {
      const r = decideProposal(t.handle.raw, {
        proposalId: 9999,
        status: "accepted",
      });
      expect(r.ok).toBe(false);
      expect(r.error).toBe("not_found");
    } finally {
      t.cleanup();
    }
  });
});

describe("P1 repeated correction", () => {
  it("emits a PROMOTE_TO_RULE proposal when a file is corrected ≥3 times", () => {
    const t = tmpBrain();
    try {
      const now = Date.now();
      const stmt = t.handle.raw.prepare(
        `INSERT INTO corrections(session_id, ts, file_path, diff_summary, detected_via)
         VALUES (?, ?, ?, ?, 'agent')`,
      );
      stmt.run("s1", now - 1000, "src/auth.ts", "removed any cast");
      stmt.run("s2", now - 800, "src/auth.ts", "removed any cast");
      stmt.run("s3", now - 600, "src/auth.ts", "removed any cast");

      const proposals = p1RepeatedCorrection.detect(t.handle.raw, { minEvidence: 3 });
      expect(proposals).toHaveLength(1);
      expect(proposals[0]!.proposalType).toBe("PROMOTE_TO_RULE");
      expect(proposals[0]!.title).toContain("src/auth.ts");
      expect(proposals[0]!.evidence).toHaveLength(3);
    } finally {
      t.cleanup();
    }
  });

  it("does not emit when below the evidence threshold", () => {
    const t = tmpBrain();
    try {
      const now = Date.now();
      t.handle.raw
        .prepare(
          `INSERT INTO corrections(session_id, ts, file_path, diff_summary, detected_via)
           VALUES (?, ?, ?, ?, 'agent')`,
        )
        .run("s1", now, "src/x.ts", "diff");
      const proposals = p1RepeatedCorrection.detect(t.handle.raw, { minEvidence: 3 });
      expect(proposals).toEqual([]);
    } finally {
      t.cleanup();
    }
  });
});

describe("P2 unused skill", () => {
  it("flags skills with no 'invoked' usage in window", () => {
    const t = tmpBrain();
    try {
      const now = Date.now();
      // skill-A used; skill-B never used.
      t.handle.raw
        .prepare(
          `INSERT INTO artifacts_used(session_id, ts, artifact_type, artifact_name, event)
           VALUES (?, ?, 'skill', ?, 'invoked')`,
        )
        .run("s1", now, "skill-A");
      const proposals = p2UnusedSkill.detect(t.handle.raw, {
        installedSkills: ["skill-A", "skill-B"],
      });
      expect(proposals).toHaveLength(1);
      expect(proposals[0]!.artifactName).toBe("skill-B");
      expect(proposals[0]!.proposalType).toBe("DEPRECATE_ARTIFACT");
    } finally {
      t.cleanup();
    }
  });

  it("returns nothing when installedSkills is empty", () => {
    const t = tmpBrain();
    try {
      const proposals = p2UnusedSkill.detect(t.handle.raw, { installedSkills: [] });
      expect(proposals).toEqual([]);
    } finally {
      t.cleanup();
    }
  });
});

describe("P5 new consistent pattern", () => {
  it("emits CREATE_NEW_ARTIFACT for content seen across ≥3 sessions", () => {
    const t = tmpBrain();
    try {
      const stmt = t.handle.raw.prepare(
        `INSERT INTO captures(session_id, prompt_id, turn_id, ts, type, content, raw_marker)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      const ts = Date.now();
      stmt.run("s1", 1, 1, ts, "RULE", "always run pnpm test before commit", '|RULE: "x"|');
      stmt.run("s2", 2, 2, ts, "RULE", "Always Run Pnpm Test Before Commit", '|RULE: "y"|');
      stmt.run("s3", 3, 3, ts, "RULE", "always run pnpm test before commit", '|RULE: "z"|');

      const proposals = p5NewPattern.detect(t.handle.raw, { minEvidence: 3 });
      expect(proposals.length).toBeGreaterThan(0);
      const p = proposals[0]!;
      expect(p.proposalType).toBe("CREATE_NEW_ARTIFACT");
      expect(p.title.toLowerCase()).toContain("always run pnpm test");
      expect(p.evidence.length).toBeGreaterThanOrEqual(3);
    } finally {
      t.cleanup();
    }
  });

  it("requires ≥2 distinct sessions", () => {
    const t = tmpBrain();
    try {
      const stmt = t.handle.raw.prepare(
        `INSERT INTO captures(session_id, prompt_id, turn_id, ts, type, content, raw_marker)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      const ts = Date.now();
      stmt.run("s1", 1, 1, ts, "RULE", "same content", '|RULE: "x"|');
      stmt.run("s1", 2, 2, ts, "RULE", "same content", '|RULE: "y"|');
      stmt.run("s1", 3, 3, ts, "RULE", "same content", '|RULE: "z"|');
      const proposals = p5NewPattern.detect(t.handle.raw, { minEvidence: 3 });
      expect(proposals).toEqual([]);
    } finally {
      t.cleanup();
    }
  });
});

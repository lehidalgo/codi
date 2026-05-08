/**
 * runConsolidation + generatePackage end-to-end (Sprint 5.b).
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openBrain, applyMigrations } from "#src/runtime/brain/index.js";
import {
  runConsolidation,
  generatePackage,
  packageToJson,
  decideProposal,
  listProposals,
  p3SkillCoFire,
  p4RuleConflict,
  p6SlowSkill,
  p7OrphanCluster,
  p8UnusedRule,
} from "#src/runtime/consolidate/index.js";

function tmpBrain() {
  const dir = mkdtempSync(join(tmpdir(), "codi-runner-"));
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

describe("runConsolidation", () => {
  it("aggregates proposals from every detector and persists them", () => {
    const t = tmpBrain();
    try {
      const now = Date.now();
      // P1 fixture
      const corr = t.handle.raw.prepare(
        `INSERT INTO corrections(session_id, ts, file_path, diff_summary, detected_via)
         VALUES (?, ?, ?, ?, 'agent')`,
      );
      corr.run("s1", now - 1000, "x.ts", "diff");
      corr.run("s2", now - 800, "x.ts", "diff");
      corr.run("s3", now - 600, "x.ts", "diff");

      const result = runConsolidation(t.handle.raw, {
        installedSkills: ["skill-A", "skill-B"],
        installedRules: ["rule-A"],
        existingRuleKeywords: ["test"],
      });

      expect(result.proposals.length).toBeGreaterThan(0);
      expect(result.perPatternCounts.P1).toBe(1);

      const stored = listProposals(t.handle.raw);
      expect(stored.length).toBe(result.proposals.length);
    } finally {
      t.cleanup();
    }
  });
});

describe("generatePackage", () => {
  it("collects accepted proposals into a manifest with counts", () => {
    const t = tmpBrain();
    try {
      const now = Date.now();
      t.handle.raw
        .prepare(
          `INSERT INTO corrections(session_id, ts, file_path, diff_summary, detected_via)
           VALUES (?, ?, ?, ?, 'agent')`,
        )
        .run("s1", now, "y.ts", "d");
      t.handle.raw
        .prepare(
          `INSERT INTO corrections(session_id, ts, file_path, diff_summary, detected_via)
           VALUES (?, ?, ?, ?, 'agent')`,
        )
        .run("s2", now, "y.ts", "d");
      t.handle.raw
        .prepare(
          `INSERT INTO corrections(session_id, ts, file_path, diff_summary, detected_via)
           VALUES (?, ?, ?, ?, 'agent')`,
        )
        .run("s3", now, "y.ts", "d");

      const result = runConsolidation(t.handle.raw, {
        installedSkills: [],
        installedRules: [],
        existingRuleKeywords: [],
      });
      // Accept the first one
      const firstId = result.proposals[0]!.id;
      decideProposal(t.handle.raw, { proposalId: firstId, status: "accepted" });

      const manifest = generatePackage(t.handle.raw);
      expect(manifest.counts.total).toBe(1);
      expect(manifest.proposals[0]!.proposalId).toBe(firstId);
      const json = packageToJson(manifest);
      expect(JSON.parse(json).counts.total).toBe(1);
    } finally {
      t.cleanup();
    }
  });
});

describe("Sprint 5.b detectors", () => {
  it("P3 flags skills that co-fire across distinct sessions", () => {
    const t = tmpBrain();
    try {
      const now = Date.now();
      const stmt = t.handle.raw.prepare(
        `INSERT INTO artifacts_used(session_id, ts, artifact_type, artifact_name, event)
         VALUES (?, ?, 'skill', ?, 'invoked')`,
      );
      // Three sessions, A and B always together within 60s.
      for (const sid of ["s1", "s2", "s3"]) {
        stmt.run(sid, now, "skill-A");
        stmt.run(sid, now + 1000, "skill-B");
      }
      const proposals = p3SkillCoFire.detect(t.handle.raw, { minEvidence: 3 });
      expect(proposals.length).toBeGreaterThan(0);
      expect(proposals[0]!.proposalType).toBe("MERGE_SIMILAR");
    } finally {
      t.cleanup();
    }
  });

  it("P4 flags same-content opposing-type captures", () => {
    const t = tmpBrain();
    try {
      const now = Date.now();
      const stmt = t.handle.raw.prepare(
        `INSERT INTO captures(session_id, prompt_id, turn_id, ts, type, content, raw_marker)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      stmt.run("s1", 1, 1, now, "RULE", "always commit at end", '|RULE: "x"|');
      stmt.run("s1", 2, 2, now, "PROHIBITION", "always commit at end", '|PROHIBITION: "x"|');
      stmt.run("s2", 3, 3, now, "RULE", "always commit at end", '|RULE: "y"|');
      const proposals = p4RuleConflict.detect(t.handle.raw, { minEvidence: 3 });
      expect(proposals.length).toBeGreaterThan(0);
      expect(proposals[0]!.proposalType).toBe("RESOLVE_CONFLICT");
    } finally {
      t.cleanup();
    }
  });

  it("P6 flags skills exceeding the slowMs threshold on average", () => {
    const t = tmpBrain();
    try {
      const now = Date.now();
      const stmt = t.handle.raw.prepare(
        `INSERT INTO artifacts_used(session_id, ts, artifact_type, artifact_name, event, duration_ms)
         VALUES (?, ?, 'skill', ?, 'invoked', ?)`,
      );
      for (let i = 0; i < 5; i++) stmt.run(`s${i}`, now, "slow-skill", 8000);
      stmt.run("s9", now, "fast-skill", 100);
      const proposals = p6SlowSkill.detect(t.handle.raw, {
        slowMs: 5000,
        minEvidence: 3,
      });
      expect(proposals).toHaveLength(1);
      expect(proposals[0]!.artifactName).toBe("slow-skill");
      expect(proposals[0]!.proposalType).toBe("OPTIMIZE_EXISTING_ARTIFACT");
    } finally {
      t.cleanup();
    }
  });

  it("P7 flags clusters with no rule keyword match", () => {
    const t = tmpBrain();
    try {
      const now = Date.now();
      const stmt = t.handle.raw.prepare(
        `INSERT INTO captures(session_id, prompt_id, turn_id, ts, type, content, raw_marker)
         VALUES (?, ?, ?, ?, 'INSIGHT', ?, '|x|')`,
      );
      stmt.run("s1", 1, 1, now, "deeply nested ternary readability is bad");
      stmt.run("s2", 2, 2, now, "deeply nested ternary readability is bad");
      stmt.run("s3", 3, 3, now, "deeply nested ternary readability is bad");
      const proposals = p7OrphanCluster.detect(t.handle.raw, {
        existingRuleKeywords: ["typescript", "security"],
        minEvidence: 3,
      });
      expect(proposals.length).toBeGreaterThan(0);
      expect(proposals[0]!.proposalType).toBe("CREATE_NEW_ARTIFACT");
    } finally {
      t.cleanup();
    }
  });

  it("P8 flags rules with no usage in window", () => {
    const t = tmpBrain();
    try {
      const now = Date.now();
      t.handle.raw
        .prepare(
          `INSERT INTO artifacts_used(session_id, ts, artifact_type, artifact_name, event)
           VALUES (?, ?, 'rule', ?, 'matched')`,
        )
        .run("s1", now, "rule-A");
      const proposals = p8UnusedRule.detect(t.handle.raw, {
        installedRules: ["rule-A", "rule-B"],
      });
      expect(proposals).toHaveLength(1);
      expect(proposals[0]!.artifactName).toBe("rule-B");
      expect(proposals[0]!.proposalType).toBe("DEPRECATE_ARTIFACT");
    } finally {
      t.cleanup();
    }
  });
});

/**
 * Pattern detectors (Sprint 5).
 *
 * Each detector takes a brain DB and returns Proposal[] with evidence.
 * Pure functions — no I/O beyond the DB read. The pipeline runner persists
 * the returned proposals via repo.insertProposal().
 *
 * Sprint 5 ships P1, P2, P5. Remaining patterns are stubs to be filled in
 * later sprints — keeping a single contract makes the runner trivial.
 */

import type Database from "better-sqlite3";
import type { Proposal, ProposalEvidence } from "./types.js";

export interface PatternDetector {
  readonly code: string;
  detect(raw: Database.Database, opts: DetectOptions): Proposal[];
}

export interface DetectOptions {
  /** Only consider events newer than this ts. Default: 30 days ago. */
  readonly sinceTs?: number;
  /** Minimum evidence count before emitting a proposal. Default: 3. */
  readonly minEvidence?: number;
}

const DEFAULT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function defaultSince(opts: DetectOptions): number {
  return opts.sinceTs ?? Date.now() - DEFAULT_WINDOW_MS;
}

function defaultMinEvidence(opts: DetectOptions): number {
  return opts.minEvidence ?? 3;
}

// ─── P1 — repeated correction → propose RULE ────────────────────────────────
//
// "The user corrected the same file path more than N times in the window."
// Heuristic: GROUP BY file_path on the corrections table; flag any path
// hit ≥ minEvidence times by distinct sessions.

export const p1RepeatedCorrection: PatternDetector = {
  code: "P1",
  detect(raw, opts): Proposal[] {
    const since = defaultSince(opts);
    const min = defaultMinEvidence(opts);
    const rows = raw
      .prepare(
        `SELECT file_path,
                COUNT(*) AS hits,
                COUNT(DISTINCT session_id) AS sessions,
                GROUP_CONCAT(correction_id) AS evidence_ids,
                GROUP_CONCAT(diff_summary, '') AS snippets
         FROM corrections
         WHERE ts >= ?
         GROUP BY file_path
         HAVING hits >= ?
         ORDER BY hits DESC`,
      )
      .all(since, min) as {
      file_path: string;
      hits: number;
      sessions: number;
      evidence_ids: string;
      snippets: string;
    }[];

    return rows.map((r) => {
      const ids = r.evidence_ids.split(",").map(Number);
      const snippets = r.snippets.split("");
      const evidence: ProposalEvidence[] = ids.map((id, i) => ({
        id,
        source: "corrections" as const,
        snippet: snippets[i],
      }));
      return {
        patternCode: "P1",
        proposalType: "PROMOTE_TO_RULE",
        artifactKind: "rule",
        artifactName: null,
        title: `Recurring correction on ${r.file_path}`,
        rationale: `Corrected ${r.hits} times across ${r.sessions} sessions in the last ${Math.round(
          (Date.now() - since) / (24 * 60 * 60 * 1000),
        )} days. The pattern is stable enough to encode as a rule the agent applies up-front.`,
        patch: null,
        evidence,
      };
    });
  },
};

// ─── P2 — skill never selected → propose DEPRECATE ──────────────────────────
//
// "The skill exists in the catalog but artifacts_used has 0 'invoked'
// rows for it across the window." For Sprint 5 we accept the catalog list
// from the caller (artifactNames) since the runtime doesn't yet hold the
// installed manifest. Sprint 6 wires this to the plugin manifest.

export interface P2Options extends DetectOptions {
  /** Skill names known to be installed. */
  readonly installedSkills: readonly string[];
}

export const p2UnusedSkill = {
  code: "P2",
  detect(raw: Database.Database, opts: P2Options): Proposal[] {
    const since = defaultSince(opts);
    if (opts.installedSkills.length === 0) return [];
    const placeholders = opts.installedSkills.map(() => "?").join(",");
    const used = raw
      .prepare(
        `SELECT DISTINCT artifact_name FROM artifacts_used
         WHERE artifact_type = 'skill'
           AND event = 'invoked'
           AND ts >= ?
           AND artifact_name IN (${placeholders})`,
      )
      .all(since, ...opts.installedSkills) as { artifact_name: string }[];
    const usedSet = new Set(used.map((r) => r.artifact_name));
    const unused = opts.installedSkills.filter((name) => !usedSet.has(name));

    return unused.map((name) => ({
      patternCode: "P2" as const,
      proposalType: "DEPRECATE_ARTIFACT" as const,
      artifactKind: "skill" as const,
      artifactName: name,
      title: `Skill "${name}" has not fired in the analysis window`,
      rationale: `No 'invoked' usage record for this skill since ${new Date(since).toISOString()}. Either the trigger is stale, the skill is redundant with another, or the user simply doesn't reach for it. Consider deprecating or rewriting the description.`,
      patch: null,
      evidence: [],
    }));
  },
};

// ─── P5 — new consistent pattern (≥3 occurrences) → propose CREATE_NEW ──────
//
// "The same capture content (case-insensitive) showed up ≥ minEvidence times
// across distinct sessions." This is the cleanest signal for "should this
// be a rule that wasn't there before".

export const p5NewPattern: PatternDetector = {
  code: "P5",
  detect(raw, opts): Proposal[] {
    const since = defaultSince(opts);
    const min = defaultMinEvidence(opts);
    const rows = raw
      .prepare(
        `SELECT lower(content) AS norm,
                COUNT(*) AS hits,
                COUNT(DISTINCT session_id) AS sessions,
                MIN(content) AS sample_content,
                GROUP_CONCAT(capture_id) AS evidence_ids
         FROM captures
         WHERE type IN ('RULE', 'PROHIBITION', 'PREFERENCE')
           AND ts >= ?
         GROUP BY lower(content)
         HAVING hits >= ? AND sessions >= 2
         ORDER BY hits DESC
         LIMIT 50`,
      )
      .all(since, min) as {
      norm: string;
      hits: number;
      sessions: number;
      sample_content: string;
      evidence_ids: string;
    }[];

    return rows.map((r) => {
      const ids = r.evidence_ids.split(",").map(Number);
      const evidence: ProposalEvidence[] = ids.map((id) => ({
        id,
        source: "captures" as const,
      }));
      return {
        patternCode: "P5",
        proposalType: "CREATE_NEW_ARTIFACT",
        artifactKind: "rule",
        artifactName: null,
        title: `New rule candidate: "${r.sample_content.slice(0, 64)}…"`,
        rationale: `${r.hits} captures across ${r.sessions} sessions express the same intent. Promote to a top-level rule so the agent applies it automatically rather than re-inferring it each session.`,
        patch: { proposed_rule_body: r.sample_content },
        evidence,
      };
    });
  },
};

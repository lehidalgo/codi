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

    // Cold-start guard: absence of evidence is not evidence of absence.
    // If NO skill has been invoked in the window, the consolidator has
    // no signal to differentiate "unused" from "tracking not yet wired".
    // Suppress the pattern entirely until at least one skill fires —
    // otherwise the entire catalog gets flagged for deprecation on the
    // first run after install, which is the worst possible UX.
    const totalSkillUse = raw
      .prepare(
        `SELECT COUNT(*) AS n FROM artifacts_used
         WHERE artifact_type = 'skill' AND event = 'invoked' AND ts >= ?`,
      )
      .get(since) as { n: number };
    if (totalSkillUse.n === 0) return [];

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
      rationale: `No 'invoked' usage record for this skill since ${new Date(since).toISOString()} (${totalSkillUse.n} other skill invocations recorded in the window). Either the trigger is stale, the skill is redundant with another, or the user simply doesn't reach for it. Consider deprecating or rewriting the description.`,
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

// ─── P3 — skill always co-fires with another → propose MERGE ────────────────
//
// Two skills appear in the same session, ordered by ts, within a small
// proximity window in ≥ minEvidence sessions. Heuristic: any pair where
// distinct co-fire sessions ≥ threshold is merge-worthy.

export interface P3Options extends DetectOptions {
  /** Window (ms) within which two invocations are considered co-firing. Default: 60s. */
  readonly proximityWindowMs?: number;
}

export const p3SkillCoFire = {
  code: "P3",
  detect(raw: Database.Database, opts: P3Options): Proposal[] {
    const since = defaultSince(opts);
    const min = defaultMinEvidence(opts);
    const window = opts.proximityWindowMs ?? 60_000;
    const rows = raw
      .prepare(
        `WITH events AS (
           SELECT session_id, ts, artifact_name
           FROM artifacts_used
           WHERE artifact_type = 'skill' AND event = 'invoked' AND ts >= ?
         )
         SELECT a.artifact_name AS skill_a,
                b.artifact_name AS skill_b,
                COUNT(DISTINCT a.session_id) AS sessions
         FROM events a
           JOIN events b
             ON a.session_id = b.session_id
            AND a.artifact_name < b.artifact_name
            AND ABS(a.ts - b.ts) <= ?
         GROUP BY a.artifact_name, b.artifact_name
         HAVING sessions >= ?
         ORDER BY sessions DESC`,
      )
      .all(since, window, min) as {
      skill_a: string;
      skill_b: string;
      sessions: number;
    }[];

    return rows.map((r) => ({
      patternCode: "P3" as const,
      proposalType: "MERGE_SIMILAR" as const,
      artifactKind: "skill" as const,
      artifactName: `${r.skill_a}+${r.skill_b}`,
      title: `Skills "${r.skill_a}" and "${r.skill_b}" co-fire consistently`,
      rationale: `Both skills invoked within ${Math.round(window / 1000)}s of each other in ${r.sessions} sessions. Consider merging into one skill or chaining them via composition.`,
      patch: null,
      evidence: [],
    }));
  },
};

// ─── P4 — two rules contradicting → propose RESOLVE_CONFLICT ────────────────
//
// Pure code-side check: two captures of type RULE or PROHIBITION with the
// same lower(content) but recorded as opposing types are a flagable
// contradiction. (E.g. RULE "always X" vs PROHIBITION "never X".) The runner
// supplies a list of pairs the parser flagged; this detector rolls them up.

export interface P4Options extends DetectOptions {
  /** Optional pairs already detected by upstream tooling. */
  readonly knownContradictions?: readonly { a: string; b: string }[];
}

export const p4RuleConflict = {
  code: "P4",
  detect(raw: Database.Database, opts: P4Options): Proposal[] {
    const since = defaultSince(opts);
    const min = defaultMinEvidence(opts);
    const rows = raw
      .prepare(
        `SELECT lower(content) AS norm,
                COUNT(DISTINCT type) AS distinct_types,
                COUNT(*) AS hits,
                GROUP_CONCAT(DISTINCT type) AS types,
                MIN(content) AS sample
         FROM captures
         WHERE type IN ('RULE', 'PROHIBITION')
           AND ts >= ?
         GROUP BY lower(content)
         HAVING distinct_types >= 2 AND hits >= ?`,
      )
      .all(since, min) as {
      norm: string;
      distinct_types: number;
      hits: number;
      types: string;
      sample: string;
    }[];

    const fromKnown: Proposal[] = (opts.knownContradictions ?? []).map((pair) => ({
      patternCode: "P4" as const,
      proposalType: "RESOLVE_CONFLICT" as const,
      artifactKind: "rule" as const,
      artifactName: null,
      title: `Contradicting captures: "${pair.a}" vs "${pair.b}"`,
      rationale:
        "Upstream parser flagged these two captures as contradictory. Reviewer needs to pick one or scope each to a context.",
      patch: { a: pair.a, b: pair.b },
      evidence: [],
    }));

    const fromSql: Proposal[] = rows.map((r) => ({
      patternCode: "P4" as const,
      proposalType: "RESOLVE_CONFLICT" as const,
      artifactKind: "rule" as const,
      artifactName: null,
      title: `Same content recorded as ${r.types}: "${r.sample.slice(0, 60)}…"`,
      rationale: `Captured ${r.hits} times across types ${r.types}. Consolidate into a single RULE with clear scope.`,
      patch: { types: r.types, sample: r.sample },
      evidence: [],
    }));

    return [...fromKnown, ...fromSql];
  },
};

// ─── P6 — skill timing exceeds threshold → propose OPTIMIZE ─────────────────
//
// Tool calls record duration_ms; skill timing is approximated by the average
// duration of its associated `invoked` event. When the average exceeds the
// configured threshold, the detector emits an OPTIMIZE proposal.

export interface P6Options extends DetectOptions {
  /** ms threshold above which a skill is flagged as slow. Default 5000. */
  readonly slowMs?: number;
}

export const p6SlowSkill = {
  code: "P6",
  detect(raw: Database.Database, opts: P6Options): Proposal[] {
    const since = defaultSince(opts);
    const min = defaultMinEvidence(opts);
    const slowMs = opts.slowMs ?? 5000;
    const rows = raw
      .prepare(
        `SELECT artifact_name,
                AVG(duration_ms) AS avg_ms,
                COUNT(*) AS hits
         FROM artifacts_used
         WHERE artifact_type = 'skill'
           AND event = 'invoked'
           AND duration_ms IS NOT NULL
           AND ts >= ?
         GROUP BY artifact_name
         HAVING avg_ms >= ? AND hits >= ?
         ORDER BY avg_ms DESC`,
      )
      .all(since, slowMs, min) as {
      artifact_name: string;
      avg_ms: number;
      hits: number;
    }[];

    return rows.map((r) => ({
      patternCode: "P6" as const,
      proposalType: "OPTIMIZE_EXISTING_ARTIFACT" as const,
      artifactKind: "skill" as const,
      artifactName: r.artifact_name,
      title: `Skill "${r.artifact_name}" is slow (avg ${Math.round(r.avg_ms)}ms)`,
      rationale: `${r.hits} invocations averaged ${Math.round(r.avg_ms)}ms (threshold ${slowMs}ms). Cache, parallelise, or trim its scope.`,
      patch: { avg_ms: r.avg_ms, threshold_ms: slowMs },
      evidence: [],
    }));
  },
};

// ─── P7 — capture cluster sin home rule → propose CREATE_NEW ────────────────
//
// Captures whose content shares a tri-gram with no existing rule body. For
// Sprint 5.b we approximate "home rule" via an externally supplied list of
// rule-body keywords; the consolidator that orchestrates the full pipeline
// supplies that list.

export interface P7Options extends DetectOptions {
  /** Lowercased rule body keywords used to test "has a home". */
  readonly existingRuleKeywords: readonly string[];
}

export const p7OrphanCluster = {
  code: "P7",
  detect(raw: Database.Database, opts: P7Options): Proposal[] {
    const since = defaultSince(opts);
    const min = defaultMinEvidence(opts);
    const rows = raw
      .prepare(
        `SELECT lower(content) AS norm,
                COUNT(*) AS hits,
                MIN(content) AS sample
         FROM captures
         WHERE ts >= ?
         GROUP BY lower(content)
         HAVING hits >= ?`,
      )
      .all(since, min) as { norm: string; hits: number; sample: string }[];

    const orphans = rows.filter((r) => {
      return !opts.existingRuleKeywords.some((kw) => r.norm.includes(kw));
    });

    return orphans.map((r) => ({
      patternCode: "P7" as const,
      proposalType: "CREATE_NEW_ARTIFACT" as const,
      artifactKind: "rule" as const,
      artifactName: null,
      title: `Orphan capture cluster: "${r.sample.slice(0, 60)}…"`,
      rationale: `${r.hits} captures share this content but no existing rule keyword matches it. Either create a new rule or extend one.`,
      patch: { proposed_rule_body: r.sample },
      evidence: [],
    }));
  },
};

// ─── P8 — rule referenced never triggered → propose DEPRECATE ───────────────
//
// A rule whose name appears in artifacts_used 0 times in the window is
// likely dead. Mirror of P2 but for rules.

export interface P8Options extends DetectOptions {
  readonly installedRules: readonly string[];
}

export const p8UnusedRule = {
  code: "P8",
  detect(raw: Database.Database, opts: P8Options): Proposal[] {
    const since = defaultSince(opts);
    if (opts.installedRules.length === 0) return [];

    // Cold-start guard: rules apply continuously (loaded into every
    // prompt context) and don't emit a per-event firing signal today.
    // P8 fires only once we observe at least one rule-typed usage row
    // in the window — i.e. once the runtime starts surfacing real rule
    // activations. Until then, suppress to avoid flagging the whole
    // catalog. The logic mirrors P2; both refuse to deprecate without
    // positive evidence of usage of *some* artifact in the same kind.
    const totalRuleUse = raw
      .prepare(
        `SELECT COUNT(*) AS n FROM artifacts_used
         WHERE artifact_type = 'rule' AND ts >= ?`,
      )
      .get(since) as { n: number };
    if (totalRuleUse.n === 0) return [];

    const placeholders = opts.installedRules.map(() => "?").join(",");
    const used = raw
      .prepare(
        `SELECT DISTINCT artifact_name FROM artifacts_used
         WHERE artifact_type = 'rule'
           AND ts >= ?
           AND artifact_name IN (${placeholders})`,
      )
      .all(since, ...opts.installedRules) as { artifact_name: string }[];
    const usedSet = new Set(used.map((r) => r.artifact_name));
    const unused = opts.installedRules.filter((name) => !usedSet.has(name));

    return unused.map((name) => ({
      patternCode: "P8" as const,
      proposalType: "DEPRECATE_ARTIFACT" as const,
      artifactKind: "rule" as const,
      artifactName: name,
      title: `Rule "${name}" never referenced in window`,
      rationale: `No usage event with type=rule found since ${new Date(since).toISOString()} (${totalRuleUse.n} other rule events recorded in the window). Either the rule is silently disabled, redundant, or the trigger never matches. Consider deprecating.`,
      patch: null,
      evidence: [],
    }));
  },
};

// ─── P9 — OBSERVATION captures naming an artifact → propose IMPROVE ─────────
//
// F10 — replaces the legacy `[CODI-OBSERVATION: ...]` filesystem feedback
// pipeline. Agents now emit `|OBSERVATION: "..."|` capture markers (Iron Law 9);
// the Stop hook persists them into `captures` with type='OBSERVATION'. P9
// scans those captures, matches each one against the installed catalog
// (rules + skills + agents), and emits OPTIMIZE_EXISTING_ARTIFACT proposals
// for any artifact that accumulates ≥minEvidence references in the window.
//
// Matching is case-insensitive substring on the capture content. Punctuation
// inside the artifact name (e.g. `codi-commit`) is treated literally — the
// detector is intentionally narrow because false positives turn into noisy
// proposals the reviewer has to dismiss.

export interface P9Options extends DetectOptions {
  /** Catalog of installed artifact names — only these can earn proposals. */
  readonly installedArtifacts: ReadonlyArray<{
    readonly name: string;
    readonly kind: "rule" | "skill" | "agent";
  }>;
}

export const p9ArtifactObservation = {
  code: "P9",
  detect(raw: Database.Database, opts: P9Options): Proposal[] {
    const since = defaultSince(opts);
    const min = defaultMinEvidence(opts);
    if (opts.installedArtifacts.length === 0) return [];

    const rows = raw
      .prepare(
        `SELECT capture_id, content
           FROM captures
          WHERE type = 'OBSERVATION'
            AND ts >= ?
          ORDER BY capture_id ASC`,
      )
      .all(since) as { capture_id: number; content: string }[];

    if (rows.length === 0) return [];

    type Hit = {
      readonly artifact: { readonly name: string; readonly kind: "rule" | "skill" | "agent" };
      readonly captureIds: number[];
      readonly snippets: string[];
    };
    const hits = new Map<string, Hit>();

    for (const r of rows) {
      const lc = r.content.toLowerCase();
      for (const a of opts.installedArtifacts) {
        if (!lc.includes(a.name.toLowerCase())) continue;
        const key = `${a.kind}:${a.name}`;
        const existing = hits.get(key);
        if (existing) {
          existing.captureIds.push(r.capture_id);
          existing.snippets.push(r.content);
        } else {
          hits.set(key, { artifact: a, captureIds: [r.capture_id], snippets: [r.content] });
        }
      }
    }

    const proposals: Proposal[] = [];
    for (const hit of hits.values()) {
      if (hit.captureIds.length < min) continue;
      const evidence: ProposalEvidence[] = hit.captureIds.map((id, i) => ({
        id,
        source: "captures" as const,
        snippet: hit.snippets[i],
      }));
      proposals.push({
        patternCode: "P9",
        proposalType: "OPTIMIZE_EXISTING_ARTIFACT",
        artifactKind: hit.artifact.kind,
        artifactName: hit.artifact.name,
        title: `${hit.captureIds.length} observation(s) reference ${hit.artifact.kind} "${hit.artifact.name}"`,
        rationale: `Agents emitted ${hit.captureIds.length} OBSERVATION captures naming "${hit.artifact.name}" since ${new Date(since).toISOString()}. The pattern is consistent enough to evidence a real gap — review the captures and tighten the trigger, fix the outdated guidance, or add the missing example.`,
        patch: { artifact_kind: hit.artifact.kind, artifact_name: hit.artifact.name },
        evidence,
      });
    }
    return proposals.sort((a, b) => b.evidence.length - a.evidence.length);
  },
};

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

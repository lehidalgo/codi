/**
 * Consolidation pipeline runner (Sprint 5.b).
 *
 * Orchestrates: detection → persistence → optional package generation.
 * The 5-stage pipeline (Ingest, Detect, Propose, Review, Generate) is
 * compressed here into one entry point because Stage 1 (Ingest) and
 * Stage 4 (Review) live elsewhere — Ingest happens continuously via the
 * capture hooks, and Review is the brain-ui /proposals UI.
 *
 * runConsolidation() returns the persisted proposal IDs so a caller can
 * fan out to LLM/agent endpoints (Sprint 5.b) for prompt expansion.
 */

import type Database from "better-sqlite3";
import { insertProposal } from "./repo.js";
import {
  p1RepeatedCorrection,
  p2UnusedSkill,
  p3SkillCoFire,
  p4RuleConflict,
  p5NewPattern,
  p6SlowSkill,
  p7OrphanCluster,
  p8UnusedRule,
} from "./patterns.js";
import { renderPrompt } from "./prompts.js";
import type { Proposal } from "./types.js";
import type { LlmProvider } from "../llm/index.js";
import { maxCallsPerRun } from "../llm/index.js";

export interface RunContext {
  readonly installedSkills: readonly string[];
  readonly installedRules: readonly string[];
  readonly existingRuleKeywords: readonly string[];
  readonly knownContradictions?: readonly { a: string; b: string }[];
  readonly sinceTs?: number;
  readonly minEvidence?: number;
  /** When set, each detected proposal is enriched with an LLM-generated
   *  rationale before persistence. Capped by CODI_LLM_MAX_CALLS_PER_RUN. */
  readonly llmProvider?: LlmProvider;
  /** When true, runs the planner but does not insert into proposals. */
  readonly dryRun?: boolean;
}

export interface RunResult {
  readonly proposals: readonly { id: number; pattern: string; title: string }[];
  readonly perPatternCounts: Record<string, number>;
  readonly llmCalls: number;
  readonly llmFailures: number;
  readonly dryRun: boolean;
}

export async function runConsolidation(
  raw: Database.Database,
  ctx: RunContext,
): Promise<RunResult> {
  const detected: Proposal[] = [];

  detected.push(
    ...p1RepeatedCorrection.detect(raw, {
      sinceTs: ctx.sinceTs,
      minEvidence: ctx.minEvidence,
    }),
  );
  detected.push(
    ...p2UnusedSkill.detect(raw, {
      installedSkills: ctx.installedSkills,
      sinceTs: ctx.sinceTs,
    }),
  );
  detected.push(
    ...p3SkillCoFire.detect(raw, {
      sinceTs: ctx.sinceTs,
      minEvidence: ctx.minEvidence,
    }),
  );
  detected.push(
    ...p4RuleConflict.detect(raw, {
      sinceTs: ctx.sinceTs,
      minEvidence: ctx.minEvidence,
      knownContradictions: ctx.knownContradictions,
    }),
  );
  detected.push(
    ...p5NewPattern.detect(raw, {
      sinceTs: ctx.sinceTs,
      minEvidence: ctx.minEvidence,
    }),
  );
  detected.push(
    ...p6SlowSkill.detect(raw, {
      sinceTs: ctx.sinceTs,
      minEvidence: ctx.minEvidence,
    }),
  );
  detected.push(
    ...p7OrphanCluster.detect(raw, {
      sinceTs: ctx.sinceTs,
      minEvidence: ctx.minEvidence,
      existingRuleKeywords: ctx.existingRuleKeywords,
    }),
  );
  detected.push(
    ...p8UnusedRule.detect(raw, {
      installedRules: ctx.installedRules,
      sinceTs: ctx.sinceTs,
    }),
  );

  let llmCalls = 0;
  let llmFailures = 0;
  const enriched: Proposal[] = [];
  const callBudget = maxCallsPerRun();

  for (const p of detected) {
    if (!ctx.llmProvider || llmCalls >= callBudget) {
      enriched.push(p);
      continue;
    }
    try {
      const promptText = renderPrompt(p.patternCode, {
        pattern_code: p.patternCode,
        artifact_name: p.artifactName ?? "",
        evidence_sample: p.evidence[0]?.snippet ?? "",
      });
      const result = await ctx.llmProvider.generate({
        system: "You are a Codi consolidation reviewer. Output only the requested paragraph.",
        user: promptText,
      });
      llmCalls++;
      const patch =
        typeof p.patch === "object" && p.patch !== null ? { ...(p.patch as object) } : {};
      enriched.push({
        ...p,
        patch: { ...patch, llm_response: result.text, llm_model: result.model },
      });
    } catch {
      llmFailures++;
      // Degrade gracefully: ship the proposal without LLM enrichment.
      enriched.push(p);
    }
  }

  const proposals: { id: number; pattern: string; title: string }[] = [];
  const perPatternCounts: Record<string, number> = {};

  if (!ctx.dryRun) {
    const txn = raw.transaction((items: Proposal[]) => {
      for (const p of items) {
        const id = insertProposal(raw, p);
        proposals.push({ id, pattern: p.patternCode, title: p.title });
        perPatternCounts[p.patternCode] = (perPatternCounts[p.patternCode] ?? 0) + 1;
      }
    });
    txn(enriched);
  } else {
    for (const p of enriched) {
      proposals.push({ id: -1, pattern: p.patternCode, title: p.title });
      perPatternCounts[p.patternCode] = (perPatternCounts[p.patternCode] ?? 0) + 1;
    }
  }

  return {
    proposals,
    perPatternCounts,
    llmCalls,
    llmFailures,
    dryRun: ctx.dryRun ?? false,
  };
}

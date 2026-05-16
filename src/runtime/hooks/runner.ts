/**
 * Runtime hook runner.
 *
 * Orchestrates the enabled runtime-bucket hooks for a single agent event:
 *
 *   - applies phaseFilter (workflow-phase gating)
 *   - honours dispatchSkill (delegation marker, no local evaluation)
 *   - calls evaluate() with a 30 s timeout
 *   - fails open on throws, timeouts, or runner internals
 *   - aggregates HookVerdicts into a final exit decision (exit code + stderr)
 */

import type {
  HookContext,
  HookVerdict,
  RuntimeHookArtifact,
} from "#src/core/hooks/hook-artifact.js";

const HOOK_TIMEOUT_MS = 30_000;

function isPhaseAllowed(hook: RuntimeHookArtifact, phase: string | undefined): boolean {
  if (!hook.phaseFilter || hook.phaseFilter.length === 0) return true;
  if (!phase) return false;
  return hook.phaseFilter.includes(phase);
}

function infoVerdict(name: string, message?: string): HookVerdict {
  return message !== undefined
    ? { hookName: name, matched: false, severity: "info", message }
    : { hookName: name, matched: false, severity: "info" };
}

async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race<T>([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

export async function runRuntimeHooks(
  hooks: RuntimeHookArtifact[],
  ctx: HookContext,
): Promise<HookVerdict[]> {
  const out: HookVerdict[] = [];
  for (const hook of hooks) {
    if (!isPhaseAllowed(hook, ctx.workflowPhase)) {
      out.push(infoVerdict(hook.name));
      continue;
    }
    if (hook.dispatchSkill) {
      out.push(infoVerdict(hook.name, `dispatchSkill=${hook.dispatchSkill}`));
      continue;
    }
    try {
      const result = hook.evaluate(ctx);
      const verdict =
        result instanceof Promise
          ? await withTimeout(result, HOOK_TIMEOUT_MS, infoVerdict(hook.name))
          : result;
      out.push(verdict);
    } catch {
      out.push(infoVerdict(hook.name));
    }
  }
  return out;
}

export interface ExitDecision {
  exitCode: 0 | 2;
  stderrLines: string[];
}

export function aggregateExitDecision(verdicts: HookVerdict[]): ExitDecision {
  const lines: string[] = [];
  let blocking = false;
  for (const v of verdicts) {
    if (!v.matched) continue;
    if (v.severity === "block" || v.severity === "warn") {
      blocking = true;
      const tag = v.ruleId ? `[${v.hookName}/${v.ruleId}]` : `[${v.hookName}]`;
      if (v.message) lines.push(`${tag} ${v.message}`);
      if (v.suggestedAction) lines.push(`  → ${v.suggestedAction}`);
    }
  }
  return { exitCode: blocking ? 2 : 0, stderrLines: lines };
}

import { generate } from "./generator.js";
import type { GenerationResult } from "./generator.js";
import { pruneEmptyAdapterDirs } from "./prune-empty-adapter-dirs.js";
import { StateManager } from "#src/core/config/state.js";
import type { GeneratedFileState } from "#src/core/config/state.js";
import { resolveProjectDir } from "#src/utils/paths.js";
import { hashContent } from "#src/utils/hash.js";
import { Logger } from "#src/core/output/logger.js";
import type { BackupHandle } from "#src/core/backup/types.js";
import type { NormalizedConfig } from "#src/types/config.js";
import type { Result } from "#src/types/result.js";
import { ok } from "#src/types/result.js";

/**
 * Options for {@link applyConfiguration}. Render options are forwarded to
 * {@link generate}; reconcile options control orphan handling.
 */
export interface ApplyOptions {
  /** Override the agents from `config.manifest.agents`. */
  agents?: string[];
  /** Render only — no FS writes, no state writes, no reconcile. */
  dryRun?: boolean;
  /** Accept-incoming on conflict during render. */
  force?: boolean;
  /** Reject-incoming on conflict during render. */
  keepCurrent?: boolean;
  /** Append-merge on conflict during render. */
  unionMerge?: boolean;
  /**
   * Force-delete drifted orphans (user-edited generated files).
   * Default: `options.force`. The CLI layer composes whatever expression it
   * wants (e.g. `force || onConflict === "keep-incoming"`); apply.ts itself
   * does not know about CLI option vocabulary.
   */
  forceDeleteDriftedOrphans?: boolean;
}

/**
 * Outcome of an {@link applyConfiguration} call.
 */
export interface ApplyResult {
  /** The underlying {@link generate} result. */
  generation: GenerationResult;
  reconciliation: {
    /** Relative paths of files actually pruned from disk. */
    pruned: string[];
    /** Relative paths of drifted orphans kept (user-edited, not force-deleted). */
    preservedDrifted: string[];
    /** Relative paths of empty adapter directories removed after orphan deletion. */
    prunedDirs: string[];
    /** False on dryRun or if the state-write step failed (non-fatal). */
    stateUpdated: boolean;
  };
}

/**
 * Render a configuration, write its files, prune orphans, and persist state.
 *
 * Single public entry point for "apply this configuration to the filesystem".
 * CLI handlers should call this rather than {@link generate} directly.
 * {@link generate} remains available for pure-render use cases (tests,
 * dry-run reporting) that must not touch state.
 *
 * Order of operations (CORE-002): render → write → detect-orphans →
 * delete-orphans → atomic-state-commit (remove old agents + add new
 * agents fused into one mutation).
 *
 * Crash-recovery model: every transition is convergent.
 * - Crash mid-delete: state still lists everything; next run re-tries delete.
 * - Crash between delete and commit: files gone, state stale; next run's
 *   `detectOrphans` sees ENOENT, classifies as clean orphan, and trims
 *   state (see state.ts:detectOrphans ENOENT branch).
 * - Crash during commit: state.atomicMutate releases the lock without
 *   writing; state unchanged; next run re-runs the full pipeline.
 *
 * Reconciliation is idempotent and self-healing. Two parallel
 * `codi generate` runs serialize through `state.atomicMutate`'s
 * cross-process lock.
 */
export async function applyConfiguration(
  config: NormalizedConfig,
  projectRoot: string,
  options: ApplyOptions = {},
  backupHandle?: BackupHandle,
): Promise<Result<ApplyResult>> {
  const log = Logger.getInstance();
  const genResult = await generate(config, projectRoot, {
    agents: options.agents,
    dryRun: options.dryRun,
    force: options.force,
    keepCurrent: options.keepCurrent,
    unionMerge: options.unionMerge,
  });
  if (!genResult.ok) return genResult;

  if (options.dryRun) {
    return ok({
      generation: genResult.data,
      reconciliation: {
        pruned: [],
        preservedDrifted: [],
        prunedDirs: [],
        stateUpdated: false,
      },
    });
  }

  const configDir = resolveProjectDir(projectRoot);
  const stateManager = new StateManager(configDir, projectRoot);

  const prevStateResult = await stateManager.read();
  const prevAgentIds = prevStateResult.ok ? Object.keys(prevStateResult.data.agents) : [];

  const agentUpdates: Record<string, GeneratedFileState[]> = {};
  for (const agentId of genResult.data.agents) {
    agentUpdates[agentId] = (genResult.data.filesByAgent[agentId] ?? []).map(
      (f): GeneratedFileState => ({
        path: f.path,
        sourceHash: hashContent(f.sources.join(",")),
        generatedHash: f.hash,
        sources: f.sources,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  const pruned: string[] = [];
  const preservedDrifted: string[] = [];

  const orphanResult = await stateManager.detectOrphans(agentUpdates);
  if (orphanResult.ok) {
    const { clean, drifted } = orphanResult.data;
    const forceDelete = options.forceDeleteDriftedOrphans ?? options.force ?? false;
    const toDelete = forceDelete ? [...clean, ...drifted] : clean;
    if (toDelete.length > 0) {
      if (backupHandle) {
        await backupHandle.append(
          toDelete.map((o) => o.path),
          "output",
          { deleted: true },
        );
      }
      const deleted = await stateManager.deleteOrphans(toDelete);
      pruned.push(...deleted);
    }
    if (!forceDelete) {
      preservedDrifted.push(...drifted.map((d) => d.path));
    }
  }

  const nextAgentIds = new Set(genResult.data.agents);
  const removedAgentIds = prevAgentIds.filter((id) => !nextAgentIds.has(id));
  const prunedDirs = await pruneEmptyAdapterDirs(projectRoot, pruned, removedAgentIds);

  // CORE-002: fuse `removeAgents` + `updateAgentsBatch` into one atomicMutate
  // call so the state mutation is a single transaction under the
  // cross-process lock. Pre-fix, these were two separate locked writes;
  // a crash between them left state with one mutation applied but not
  // the other.
  let stateUpdated = false;
  try {
    const updateResult = await stateManager.atomicMutate((state) => {
      for (const id of removedAgentIds) {
        if (id in state.agents) delete state.agents[id];
      }
      for (const [agentId, files] of Object.entries(agentUpdates)) {
        state.agents[agentId] = files;
      }
      state.lastGenerated = new Date().toISOString();
      return state;
    });
    stateUpdated = updateResult.ok;
    if (!updateResult.ok) {
      log.warn("State update failed; orphan detection may be incomplete on next run.");
    }
  } catch {
    log.warn("State update failed; orphan detection may be incomplete on next run.");
  }

  return ok({
    generation: genResult.data,
    reconciliation: { pruned, preservedDrifted, prunedDirs, stateUpdated },
  });
}

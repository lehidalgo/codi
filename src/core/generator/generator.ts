import { chmod, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import pLimit from "p-limit";
import type { GeneratedFile, GenerateOptions } from "#src/types/agent.js";
import type { NormalizedConfig } from "#src/types/config.js";
import type { Result } from "#src/types/result.js";
import { ok, err } from "#src/types/result.js";
import { Logger } from "#src/core/output/logger.js";
import { getAdapter } from "./adapter-registry.js";

/**
 * CORE-002: cap concurrent file I/O so a large skill catalog × multiple
 * adapters can't exhaust file descriptors. macOS default RLIMIT_NOFILE is
 * 256; Linux is 1024. With ~150-900 files across 6 adapters and 3 sequential
 * I/O waves (read-classify, direct-write, conflict-write), a peak of 32
 * in-flight operations leaves ample headroom even on the tightest default
 * (~12% of macOS). Override via `CODI_FILE_IO_CONCURRENCY` env var.
 */
const FILE_IO_CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env["CODI_FILE_IO_CONCURRENCY"] ?? "", 10) || 32,
);
import { buildVerificationData } from "../verify/token.js";
import { buildVerificationSection } from "../verify/section-builder.js";
import { hashContent } from "#src/utils/hash.js";
import {
  resolveConflicts,
  makeConflictEntry,
  type ConflictEntry,
} from "#src/utils/conflict-resolver.js";
import {
  extractProjectContext,
  injectProjectContext,
  ensureProjectContextAnchor,
} from "#src/utils/project-context-preserv.js";

/**
 * Aggregated result returned by {@link generate}.
 */
export interface GenerationResult {
  /** All files produced across every agent, in generation order. */
  files: GeneratedFile[];
  /** IDs of agents that participated in this generation run. */
  agents: string[];
  /** Files produced by each agent, keyed by agent ID. */
  filesByAgent: Record<string, GeneratedFile[]>;
  /** Relative paths of files kept as-is due to conflict resolution. */
  skipped: string[];
}

interface AgentOutput {
  agentId: string;
  generated: GeneratedFile[];
}

/**
 * Run the full generation pipeline for all registered agents.
 *
 * Phase 1 renders file content in memory (no I/O). Phase 2 writes files to
 * disk with conflict detection: identical content is written directly; differing
 * content triggers the interactive resolver (or `--force` auto-accept).
 *
 * The primary instruction file for each agent also receives the verification
 * token section and has any existing `<!-- project-context -->` block
 * preserved across regenerations.
 *
 * @param config - Fully resolved and validated Codi configuration.
 * @param projectRoot - Absolute path to the project root directory.
 * @param options - Generation options (dry-run, force, agent filter, etc.).
 * @returns `ok(GenerationResult)` on success, or `err(errors)` if an adapter
 *   is missing or an unexpected I/O failure occurs.
 *
 * @example
 * const result = await generate(config, process.cwd(), { dryRun: true });
 * if (result.ok) {
 *   console.log(`Would write ${result.data.files.length} files`);
 * }
 */
export async function generate(
  config: NormalizedConfig,
  projectRoot: string,
  options: GenerateOptions = {},
): Promise<Result<GenerationResult>> {
  const agentIds = options.agents ?? config.manifest.agents ?? [];

  // Pre-validate every adapter is registered BEFORE dispatching parallel
  // work. Fail fast with the canonical error shape — partial-success of
  // some adapters while another is missing would be a confusing state.
  const adapters: Array<{ agentId: string; adapter: ReturnType<typeof getAdapter> }> = [];
  for (const agentId of agentIds) {
    const adapter = getAdapter(agentId);
    if (!adapter) {
      return err([
        {
          code: "ADAPTER_NOT_FOUND",
          message: `No adapter registered for agent: ${agentId}`,
          hint: `Check that the adapter "${agentId}" is registered.`,
          severity: "error",
          context: { agentId },
        },
      ]);
    }
    adapters.push({ agentId, adapter });
  }

  // Phase 1: generate content for all agents in parallel. Each adapter's
  // `.generate()` is independent — scaffolder template loaders are
  // module-level immutable maps; the only filesystem I/O here is the
  // instruction-file read which targets different paths per adapter.
  // `Promise.all` preserves input order, so `agentOutputs` ordering stays
  // deterministic for downstream consumers (verification, status, hash).
  const verifyData = buildVerificationData(config);
  const verifySection = buildVerificationSection(verifyData);

  const agentOutputs: AgentOutput[] = await Promise.all(
    adapters.map(async ({ agentId, adapter }) => {
      const generated = await adapter!.generate(config, { ...options, projectRoot });

      for (const file of generated) {
        if (file.path !== adapter!.paths.instructionFile) continue;
        file.content = file.content + "\n\n" + verifySection;

        // Ensure the onboarding playbook/skill always has a deterministic
        // insertion point at the top of the file.
        file.content = ensureProjectContextAnchor(file.content);

        // Preserve any user-written project-context block from the existing file.
        // This prevents codi generate from overwriting the context the agent wrote.
        const fullPath = join(projectRoot, file.path);
        let existingContent: string | null = null;
        try {
          existingContent = await readFile(fullPath, "utf-8");
        } catch {
          // File does not exist yet — nothing to preserve
        }
        if (existingContent) {
          const block = extractProjectContext(existingContent);
          if (block) {
            file.content = injectProjectContext(file.content, block);
          }
        }

        file.hash = hashContent(file.content);
      }

      return { agentId, generated };
    }),
  );

  // Phase 2: write files (with conflict detection unless dry-run)
  const skipped: string[] = [];

  if (!options.dryRun) {
    const directWrites: GeneratedFile[] = [];
    const potentialConflicts: ConflictEntry[] = [];

    // Classification pass: read every existing file in parallel, then
    // sort into directWrites vs potentialConflicts. CORE-002 bounds each
    // I/O wave with `FILE_IO_CONCURRENCY` so the fan-out can't exhaust
    // file descriptors on tight ulimit environments (macOS default 256).
    type Classified =
      | { kind: "direct"; file: GeneratedFile }
      | { kind: "conflict"; entry: ConflictEntry };

    const ioLimit = pLimit(FILE_IO_CONCURRENCY);

    const classified: Classified[] = await Promise.all(
      agentOutputs.flatMap(({ generated }) =>
        generated.map((file) =>
          ioLimit(async (): Promise<Classified> => {
            // Binary files are always copied without conflict checking.
            if (file.binarySrc) return { kind: "direct", file };

            const fullPath = join(projectRoot, file.path);
            let existing: string | null = null;
            try {
              existing = await readFile(fullPath, "utf-8");
            } catch {
              // File does not exist yet — falls through to direct write.
            }

            if (existing === null || existing.trim() === file.content.trim()) {
              return { kind: "direct", file };
            }
            return {
              kind: "conflict",
              entry: makeConflictEntry(file.path, fullPath, existing, file.content),
            };
          }),
        ),
      ),
    );

    for (const c of classified) {
      if (c.kind === "direct") directWrites.push(c.file);
      else potentialConflicts.push(c.entry);
    }

    await Promise.all(
      directWrites.map((file) =>
        ioLimit(async () => {
          const fullPath = join(projectRoot, file.path);
          await mkdir(dirname(fullPath), { recursive: true });
          if (file.binarySrc) {
            await copyFile(file.binarySrc, fullPath);
          } else {
            await writeFile(fullPath, file.content, "utf-8");
            if (fullPath.endsWith(".cjs") || fullPath.endsWith(".sh")) {
              await chmod(fullPath, 0o755);
            }
          }
        }),
      ),
    );

    if (potentialConflicts.length > 0) {
      const resolution = await resolveConflicts(potentialConflicts, {
        force: options.force,
        keepCurrent: options.keepCurrent,
        unionMerge: options.unionMerge,
        log: Logger.getInstance(),
      });

      await Promise.all(
        [...resolution.accepted, ...resolution.merged].map((entry) =>
          ioLimit(async () => {
            await mkdir(dirname(entry.fullPath), { recursive: true });
            await writeFile(entry.fullPath, entry.incomingContent, "utf-8");
            if (entry.fullPath.endsWith(".cjs") || entry.fullPath.endsWith(".sh")) {
              await chmod(entry.fullPath, 0o755);
            }
          }),
        ),
      );

      skipped.push(...resolution.skipped.map((e) => e.label));
    }
  }

  // Build result
  const files: GeneratedFile[] = [];
  const agents: string[] = [];
  const filesByAgent: Record<string, GeneratedFile[]> = {};

  for (const { agentId, generated } of agentOutputs) {
    files.push(...generated);
    agents.push(agentId);
    filesByAgent[agentId] = generated;
  }

  return ok({ files, agents, filesByAgent, skipped });
}

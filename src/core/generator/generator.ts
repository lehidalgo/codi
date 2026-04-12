import { chmod, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { GeneratedFile, GenerateOptions } from "#src/types/agent.js";
import type { NormalizedConfig } from "#src/types/config.js";
import type { Result } from "#src/types/result.js";
import { ok, err } from "#src/types/result.js";
import { getAdapter } from "./adapter-registry.js";
import { buildVerificationData } from "../verify/token.js";
import { buildVerificationSection } from "../verify/section-builder.js";
import { hashContent } from "#src/utils/hash.js";
import {
  resolveConflicts,
  makeConflictEntry,
  type ConflictEntry,
} from "#src/utils/conflict-resolver.js";
import { extractProjectContext, injectProjectContext } from "#src/utils/project-context-preserv.js";

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

  // Phase 1: generate content for all agents (no I/O)
  const agentOutputs: AgentOutput[] = [];

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

    const generated = await adapter.generate(config, {
      ...options,
      projectRoot,
    });

    const verifyData = buildVerificationData(config);
    const verifySection = buildVerificationSection(verifyData);
    for (const file of generated) {
      if (file.path === adapter.paths.instructionFile) {
        file.content = file.content + "\n\n" + verifySection;

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
    }

    agentOutputs.push({ agentId, generated });
  }

  // Phase 2: write files (with conflict detection unless dry-run)
  const skipped: string[] = [];

  if (!options.dryRun) {
    const directWrites: GeneratedFile[] = [];
    const potentialConflicts: ConflictEntry[] = [];

    for (const { generated } of agentOutputs) {
      for (const file of generated) {
        // Binary files are always copied without conflict checking
        if (file.binarySrc) {
          directWrites.push(file);
          continue;
        }

        const fullPath = join(projectRoot, file.path);
        let existing: string | null = null;
        try {
          existing = await readFile(fullPath, "utf-8");
        } catch {
          // File does not exist yet
        }

        if (existing === null || existing.trim() === file.content.trim()) {
          directWrites.push(file);
        } else {
          potentialConflicts.push(makeConflictEntry(file.path, fullPath, existing, file.content));
        }
      }
    }

    await Promise.all(
      directWrites.map(async (file) => {
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
    );

    if (potentialConflicts.length > 0) {
      const resolution = await resolveConflicts(potentialConflicts, {
        force: options.force,
        json: options.json,
      });

      await Promise.all(
        [...resolution.accepted, ...resolution.merged].map(async (entry) => {
          await mkdir(dirname(entry.fullPath), { recursive: true });
          await writeFile(entry.fullPath, entry.incomingContent, "utf-8");
          if (entry.fullPath.endsWith(".cjs") || entry.fullPath.endsWith(".sh")) {
            await chmod(entry.fullPath, 0o755);
          }
        }),
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

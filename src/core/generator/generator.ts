import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { GeneratedFile, GenerateOptions } from "../../types/agent.js";
import type { NormalizedConfig } from "../../types/config.js";
import type { Result } from "../../types/result.js";
import { ok, err } from "../../types/result.js";
import { getAdapter } from "./adapter-registry.js";
import { buildVerificationData } from "../verify/token.js";
import { buildVerificationSection } from "../verify/section-builder.js";
import { hashContent } from "../../utils/hash.js";
import {
  resolveConflicts,
  makeConflictEntry,
  type ConflictEntry,
} from "../../utils/conflict-resolver.js";

export interface GenerationResult {
  files: GeneratedFile[];
  agents: string[];
  filesByAgent: Record<string, GeneratedFile[]>;
  /** Relative paths of files kept as-is due to conflict resolution. */
  skipped: string[];
}

interface AgentOutput {
  agentId: string;
  generated: GeneratedFile[];
}

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
          potentialConflicts.push(
            makeConflictEntry(file.path, fullPath, existing, file.content),
          );
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

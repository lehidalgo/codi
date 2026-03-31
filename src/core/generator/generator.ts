import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { GeneratedFile, GenerateOptions } from "../../types/agent.js";
import type { NormalizedConfig } from "../../types/config.js";
import type { Result } from "../../types/result.js";
import { ok, err } from "../../types/result.js";
import { getAdapter } from "./adapter-registry.js";
import { buildVerificationData } from "../verify/token.js";
import { buildVerificationSection } from "../verify/section-builder.js";
import { hashContent } from "../../utils/hash.js";

export interface GenerationResult {
  files: GeneratedFile[];
  agents: string[];
  filesByAgent: Record<string, GeneratedFile[]>;
}

export async function generate(
  config: NormalizedConfig,
  projectRoot: string,
  options: GenerateOptions = {},
): Promise<Result<GenerationResult>> {
  const agentIds = options.agents ?? config.manifest.agents ?? [];
  const files: GeneratedFile[] = [];
  const agents: string[] = [];
  const filesByAgent: Record<string, GeneratedFile[]> = {};

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

    if (!options.dryRun) {
      await Promise.all(
        generated.map(async (file) => {
          const fullPath = join(projectRoot, file.path);
          await mkdir(dirname(fullPath), { recursive: true });
          if (file.binarySrc) {
            await copyFile(file.binarySrc, fullPath);
          } else {
            await writeFile(fullPath, file.content, "utf-8");
          }
        }),
      );
    }

    files.push(...generated);
    agents.push(agentId);
    filesByAgent[agentId] = generated;
  }

  return ok({ files, agents, filesByAgent });
}

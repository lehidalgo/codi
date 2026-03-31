import fs from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { StateManager } from "../core/config/state.js";
import type {
  DriftReport,
  DriftFile,
  ArtifactFileState,
} from "../core/config/state.js";
import { resolveProjectDir } from "../utils/paths.js";
import { resolveConfig } from "../core/config/resolver.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import type { CommandResult } from "../core/output/types.js";
import { initFromOptions, handleOutput } from "./shared.js";
import type { GlobalOptions } from "./shared.js";
import { renderColoredDiff, countChanges } from "../utils/diff.js";
import { loadPreset } from "../core/preset/preset-loader.js";
import {
  reconstructRuleContent,
  reconstructSkillContent,
  reconstructAgentContent,
  reconstructCommandContent,
} from "../core/preset/preset-applier.js";
import type { LoadedPreset } from "../core/preset/preset-loader.js";
import { Logger } from "../core/output/logger.js";

interface StatusData {
  lastGenerated: string;
  agents: DriftReport[];
  hooks: DriftFile[];
  presetArtifacts: DriftFile[];
  hasDrift: boolean;
}

interface StatusOptions {
  diff?: boolean;
}

/**
 * Infers artifact type and name from a relative path like ".codi/rules/my-rule.md".
 */
function parseArtifactPath(
  relPath: string,
): { type: "rule" | "skill" | "agent" | "command"; name: string } | null {
  const parts = relPath.replace(/\\/g, "/").split("/");
  // Expected: .codi/{type}/{name}.md or .codi/skills/{name}/SKILL.md
  const typeDir = parts[1];
  if (!typeDir) return null;

  if (typeDir === "rules" && parts[2]) {
    return { type: "rule", name: path.basename(parts[2], ".md") };
  }
  if (typeDir === "skills" && parts[2]) {
    return { type: "skill", name: parts[2] };
  }
  if (typeDir === "agents" && parts[2]) {
    return { type: "agent", name: path.basename(parts[2], ".md") };
  }
  if (typeDir === "commands" && parts[2]) {
    return { type: "command", name: path.basename(parts[2], ".md") };
  }
  return null;
}

/**
 * Reconstructs the expected content for an artifact from its source preset.
 */
function findExpectedContent(
  preset: LoadedPreset,
  type: string,
  name: string,
): string | null {
  switch (type) {
    case "rule": {
      const rule = preset.rules.find((r) => r.name === name);
      return rule ? reconstructRuleContent(rule) : null;
    }
    case "skill": {
      const skill = preset.skills.find((s) => s.name === name);
      return skill ? reconstructSkillContent(skill) : null;
    }
    case "agent": {
      const agent = preset.agents.find((a) => a.name === name);
      return agent ? reconstructAgentContent(agent) : null;
    }
    case "command": {
      const cmd = preset.commands.find((c) => c.name === name);
      return cmd ? reconstructCommandContent(cmd) : null;
    }
    default:
      return null;
  }
}

/**
 * Renders diffs for drifted preset artifacts by reloading the source preset.
 */
async function renderDriftDiffs(
  projectRoot: string,
  configDir: string,
  driftedFiles: DriftFile[],
  artifactStates: ArtifactFileState[],
): Promise<void> {
  const log = Logger.getInstance();
  const presetsDir = path.join(configDir, "presets");

  // Group drifted files by source preset
  const byPreset = new Map<
    string,
    Array<{ drift: DriftFile; state: ArtifactFileState }>
  >();
  for (const drift of driftedFiles) {
    if (drift.status !== "drifted") continue;
    const state = artifactStates.find((s) => s.path === drift.path);
    if (!state) continue;

    const entries = byPreset.get(state.preset) ?? [];
    entries.push({ drift, state });
    byPreset.set(state.preset, entries);
  }

  for (const [presetName, entries] of byPreset) {
    const loadResult = await loadPreset(presetName, presetsDir);
    if (!loadResult.ok) {
      log.warn(
        `Cannot load preset "${presetName}" for diff — showing hash info only`,
      );
      for (const { drift } of entries) {
        log.info(
          `  ${drift.path}: drifted (expected ${drift.expectedHash?.slice(0, 8)}… got ${drift.currentHash?.slice(0, 8)}…)`,
        );
      }
      continue;
    }

    const preset = loadResult.data;
    for (const { drift } of entries) {
      const parsed = parseArtifactPath(drift.path);
      if (!parsed) continue;

      const expected = findExpectedContent(preset, parsed.type, parsed.name);
      if (!expected) {
        log.info(
          `  ${drift.path}: drifted (artifact not found in preset "${presetName}")`,
        );
        continue;
      }

      let current: string;
      try {
        current = await fs.readFile(
          path.resolve(projectRoot, drift.path),
          "utf8",
        );
      } catch {
        log.info(`  ${drift.path}: missing`);
        continue;
      }

      const changes = countChanges(expected, current);
      const diff = renderColoredDiff(expected, current, drift.path);
      process.stdout.write(
        `\n  ${drift.path}  (preset: ${presetName})  +${changes.additions} -${changes.removals}\n`,
      );
      process.stdout.write(diff + "\n");
    }
  }
}

export async function statusHandler(
  projectRoot: string,
  options: StatusOptions = {},
): Promise<CommandResult<StatusData>> {
  const configResult = await resolveConfig(projectRoot);
  const driftMode = configResult.ok
    ? ((configResult.data.flags["drift_detection"]?.value as string) ?? "warn")
    : "warn";

  if (driftMode === "off") {
    return createCommandResult({
      success: true,
      command: "status",
      data: {
        lastGenerated: "",
        agents: [],
        hooks: [],
        presetArtifacts: [],
        hasDrift: false,
      },
      exitCode: EXIT_CODES.SUCCESS,
    });
  }

  const configDir = resolveProjectDir(projectRoot);
  const stateManager = new StateManager(configDir, projectRoot);

  const stateResult = await stateManager.read();
  if (!stateResult.ok) {
    return createCommandResult({
      success: false,
      command: "status",
      data: {
        lastGenerated: "",
        agents: [],
        hooks: [],
        presetArtifacts: [],
        hasDrift: false,
      },
      errors: stateResult.errors,
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const state = stateResult.data;
  const reports: DriftReport[] = [];
  let hasDrift = false;

  for (const agentId of Object.keys(state.agents)) {
    const driftResult = await stateManager.detectDrift(agentId);
    if (!driftResult.ok) continue;

    reports.push(driftResult.data);
    const drifted = driftResult.data.files.some(
      (f) => f.status === "drifted" || f.status === "missing",
    );
    if (drifted) hasDrift = true;
  }

  // Check hook drift (informational — reported but does not affect hasDrift exit code)
  let hookDriftFiles: DriftFile[] = [];
  const hookDriftResult = await stateManager.detectHookDrift();
  if (hookDriftResult.ok) {
    hookDriftFiles = hookDriftResult.data;
  }

  // Check preset artifact drift — affects hasDrift so CI can enforce via drift_detection: error
  let presetArtifactFiles: DriftFile[] = [];
  const artifactDriftResult = await stateManager.detectPresetArtifactDrift();
  if (artifactDriftResult.ok) {
    presetArtifactFiles = artifactDriftResult.data;
    const artifactDrifted = presetArtifactFiles.some(
      (f) => f.status === "drifted" || f.status === "missing",
    );
    if (artifactDrifted) hasDrift = true;
  }

  // Show diffs for drifted preset artifacts when --diff is set
  if (options.diff && presetArtifactFiles.some((f) => f.status === "drifted")) {
    await renderDriftDiffs(
      projectRoot,
      configDir,
      presetArtifactFiles,
      state.presetArtifacts ?? [],
    );
  }

  const exitCode =
    hasDrift && driftMode === "error"
      ? EXIT_CODES.DRIFT_DETECTED
      : EXIT_CODES.SUCCESS;

  return createCommandResult({
    success: true,
    command: "status",
    data: {
      lastGenerated: state.lastGenerated,
      agents: reports,
      hooks: hookDriftFiles,
      presetArtifacts: presetArtifactFiles,
      hasDrift,
    },
    exitCode,
  });
}

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show drift status for generated agent files")
    .option("--diff", "Show content diffs for drifted preset artifacts")
    .action(async (cmdOptions: { diff?: boolean }) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      const result = await statusHandler(process.cwd(), {
        diff: cmdOptions.diff,
      });
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });
}

import type { Command } from "commander";
import { Logger } from "../core/output/logger.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import { initFromOptions, handleOutput } from "./shared.js";
import { TIER_1_TARGETS } from "#src/core/capabilities/matrix.js";
import type { PluginArtifact } from "#src/core/capabilities/plugin-manifest.js";
import { publishPlugin, type PublishTrack } from "#src/core/capabilities/publish.js";
import type { GlobalOptions } from "./shared.js";
import type { CommandResult } from "../core/output/types.js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PROJECT_DIR } from "#src/constants.js";
import { isCapabilityType } from "#src/core/artifact-types.js";

interface PublishData {
  readonly track: PublishTrack;
  readonly published: readonly { target: string; manifestPath: string; artifactCount: number }[];
  readonly skipped: readonly { target: string; reason: string }[];
}

function readCodiVersion(repoRoot: string): string {
  const pkgPath = resolve(repoRoot, "package.json");
  if (!existsSync(pkgPath)) return "0.0.0";
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
  return pkg.version ?? "0.0.0";
}

/**
 * For Sprint 6.b we synthesise the artifact list from the installed
 * `.codi/artifact-manifest.json`. Sprint 7 will swap this for a richer
 * inventory that also walks the per-agent output directories.
 */
function loadArtifactsFromManifest(repoRoot: string): PluginArtifact[] {
  const manifestPath = resolve(repoRoot, PROJECT_DIR, "artifact-manifest.json");
  if (!existsSync(manifestPath)) return [];
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    artifacts?: Record<string, { type?: string }>;
  };
  const out: PluginArtifact[] = [];
  for (const [name, meta] of Object.entries(manifest.artifacts ?? {})) {
    if (!isCapabilityType(meta.type)) continue;
    out.push({ name, type: meta.type, path: `.codi/${meta.type}s/${name}` });
  }
  return out;
}

interface PublishFlags {
  readonly track?: string;
  readonly target?: string[];
}

export async function pluginPublishHandler(
  projectRoot: string,
  flags: PublishFlags,
): Promise<CommandResult<PublishData>> {
  const log = Logger.getInstance();
  const track = (flags.track ?? "local") as PublishTrack;
  if (track !== "local" && track !== "marketplace") {
    log.error(`unknown --track: ${flags.track}`);
    return createCommandResult({
      success: false,
      command: "plugin publish",
      data: { track: "local", published: [], skipped: [] },
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const codiVersion = readCodiVersion(projectRoot);
  const artifacts = loadArtifactsFromManifest(projectRoot);
  const targets =
    flags.target && flags.target.length > 0
      ? (flags.target as Parameters<typeof publishPlugin>[0]["targets"])
      : TIER_1_TARGETS;

  const result = publishPlugin({
    track,
    repoRoot: projectRoot,
    codiVersion,
    artifacts,
    targets,
  });

  for (const p of result.published) {
    log.info(`  [${p.target}] wrote ${p.manifestPath} (${p.artifactCount} artifacts)`);
  }
  for (const s of result.skipped) {
    log.warn(`  [${s.target}] skipped — ${s.reason}`);
  }

  return createCommandResult({
    success: true,
    command: "plugin publish",
    data: result,
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export function registerPluginCommand(program: Command): void {
  const plugin = program.command("plugin").description("Plugin packaging + publish");

  plugin
    .command("publish")
    .description("Emit per-target plugin manifests under .claude-plugin/, .codex-plugin/")
    .option("--track <track>", "publish track: local | marketplace", "local")
    .option(
      "--target <targets...>",
      "restrict to a subset of Tier 1 targets (claude-code, codex-cli)",
    )
    .action(async (opts: PublishFlags) => {
      const globalOpts = program.opts() as GlobalOptions;
      initFromOptions(globalOpts);
      const result = await pluginPublishHandler(process.cwd(), opts);
      handleOutput(result, globalOpts);
    });
}

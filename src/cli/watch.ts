import type { Command } from "commander";
import fs from "node:fs";
import { resolveProjectDir } from "../utils/paths.js";
import { hashContent } from "../utils/hash.js";
import { registerAllAdapters } from "../adapters/index.js";
import { resolveConfig } from "../core/config/resolver.js";
import { generate } from "../core/generator/generator.js";
import { StateManager } from "../core/config/state.js";
import type { GeneratedFileState } from "../core/config/state.js";
import { Logger } from "../core/output/logger.js";
import {
  WATCH_DEBOUNCE_MS,
  STATE_FILENAME,
  AUDIT_FILENAME,
  PROJECT_CLI,
  PROJECT_DIR,
} from "../constants.js";
import { writeAuditEntry } from "../core/audit/audit-log.js";
import { initFromOptions } from "./shared.js";
import type { GlobalOptions } from "./shared.js";

interface WatchOptions extends GlobalOptions {
  once?: boolean;
}

async function runGenerate(projectRoot: string, log: Logger): Promise<boolean> {
  registerAllAdapters();
  const configResult = await resolveConfig(projectRoot);
  if (!configResult.ok) {
    log.warn("Config resolution failed during watch — skipping generation.");
    return false;
  }

  const genResult = await generate(configResult.data, projectRoot);
  if (!genResult.ok) {
    log.warn("Generation failed during watch.");
    return false;
  }

  const configDir = resolveProjectDir(projectRoot);
  const stateManager = new StateManager(configDir, projectRoot);
  for (const agentId of genResult.data.agents) {
    const agentFiles = (
      genResult.data.filesByAgent?.[agentId] ?? genResult.data.files
    ).map(
      (f): GeneratedFileState => ({
        path: f.path,
        sourceHash: hashContent(f.sources.join(",")),
        generatedHash: f.hash,
        sources: f.sources,
        timestamp: new Date().toISOString(),
      }),
    );
    await stateManager.updateAgent(agentId, agentFiles);
  }

  await writeAuditEntry(configDir, {
    type: "generate",
    timestamp: new Date().toISOString(),
    details: { trigger: "watch", agents: genResult.data.agents },
  });

  return true;
}

export function registerWatchCommand(program: Command): void {
  program
    .command("watch")
    .description(
      `Watch ${PROJECT_DIR}/ for changes and auto-regenerate agent configs`,
    )
    .option("--once", "Run once and exit (useful for scripts)")
    .action(async (cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: WatchOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);

      const log = Logger.getInstance();
      const projectRoot = process.cwd();
      const configDir = resolveProjectDir(projectRoot);

      // Check if auto_generate_on_change is enabled
      const configResult = await resolveConfig(projectRoot);
      if (!configResult.ok) {
        log.warn(`Cannot resolve config. Run \`${PROJECT_CLI} init\` first.`);
        process.exit(1);
      }

      const autoGenFlag = configResult.data.flags["auto_generate_on_change"];
      if (!autoGenFlag || autoGenFlag.value !== true) {
        log.warn(
          `auto_generate_on_change flag is disabled. Enable it in ${PROJECT_DIR}/flags.yaml to use watch mode.`,
        );
        log.info(
          "Set: auto_generate_on_change: { mode: enabled, value: true }",
        );
        process.exit(0);
      }

      if (options.once) {
        log.info("Running one-time generation...");
        const ok = await runGenerate(projectRoot, log);
        process.exit(ok ? 0 : 1);
      }

      log.info(`Watching ${configDir} for changes...`);
      log.info("Press Ctrl+C to stop.");

      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      let generating = false;

      const watcher = fs.watch(
        configDir,
        { recursive: true },
        (_event, filename) => {
          if (!filename) return;
          if (filename === STATE_FILENAME || filename === AUDIT_FILENAME)
            return;

          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(async () => {
            if (generating) return;
            generating = true;
            log.info(`Change detected: ${filename} — regenerating...`);
            const ok = await runGenerate(projectRoot, log);
            if (ok) {
              log.info("Regeneration complete.");
            }
            generating = false;
          }, WATCH_DEBOUNCE_MS);
        },
      );

      process.on("SIGINT", () => {
        watcher.close();
        if (debounceTimer) clearTimeout(debounceTimer);
        log.info("Watch stopped.");
        process.exit(0);
      });
    });
}

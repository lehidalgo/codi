import type { Command } from 'commander';
import fs from 'node:fs';
import { resolveCodiDir } from '../utils/paths.js';
import { registerAllAdapters } from '../adapters/index.js';
import { resolveConfig } from '../core/config/resolver.js';
import { generate } from '../core/generator/generator.js';
import { Logger } from '../core/output/logger.js';
import { writeAuditEntry } from '../core/audit/audit-log.js';
import { initFromOptions } from './shared.js';
import type { GlobalOptions } from './shared.js';

interface WatchOptions extends GlobalOptions {
  once?: boolean;
}

async function runGenerate(projectRoot: string, log: Logger): Promise<boolean> {
  registerAllAdapters();
  const configResult = await resolveConfig(projectRoot);
  if (!configResult.ok) {
    log.warn('Config resolution failed during watch — skipping generation.');
    return false;
  }

  const genResult = await generate(configResult.data, projectRoot);
  if (!genResult.ok) {
    log.warn('Generation failed during watch.');
    return false;
  }

  const codiDir = resolveCodiDir(projectRoot);
  await writeAuditEntry(codiDir, {
    type: 'generate',
    timestamp: new Date().toISOString(),
    details: { trigger: 'watch', agents: configResult.data.manifest.agents ?? [] },
  });

  return true;
}

export function registerWatchCommand(program: Command): void {
  program
    .command('watch')
    .description('Watch .codi/ for changes and auto-regenerate agent configs')
    .option('--once', 'Run once and exit (useful for scripts)')
    .action(async (cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: WatchOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);

      const log = Logger.getInstance();
      const projectRoot = process.cwd();
      const codiDir = resolveCodiDir(projectRoot);

      // Check if auto_generate_on_change is enabled
      const configResult = await resolveConfig(projectRoot);
      if (!configResult.ok) {
        log.warn('Cannot resolve config. Run `codi init` first.');
        process.exit(1);
      }

      const autoGenFlag = configResult.data.flags['auto_generate_on_change'];
      if (!autoGenFlag || autoGenFlag.value !== true) {
        log.warn('auto_generate_on_change flag is disabled. Enable it in .codi/flags.yaml to use watch mode.');
        log.info('Set: auto_generate_on_change: { mode: enabled, value: true }');
        process.exit(0);
      }

      if (options.once) {
        log.info('Running one-time generation...');
        const ok = await runGenerate(projectRoot, log);
        process.exit(ok ? 0 : 1);
      }

      log.info(`Watching ${codiDir} for changes...`);
      log.info('Press Ctrl+C to stop.');

      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      let generating = false;

      const watcher = fs.watch(codiDir, { recursive: true }, (_event, filename) => {
        if (!filename) return;
        if (filename === 'state.json' || filename === 'audit.jsonl') return;

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          if (generating) return;
          generating = true;
          log.info(`Change detected: ${filename} — regenerating...`);
          const ok = await runGenerate(projectRoot, log);
          if (ok) {
            log.info('Regeneration complete.');
          }
          generating = false;
        }, 500);
      });

      process.on('SIGINT', () => {
        watcher.close();
        if (debounceTimer) clearTimeout(debounceTimer);
        log.info('Watch stopped.');
        process.exit(0);
      });
    });
}

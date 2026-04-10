import { Command } from "commander";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { addGlobalOptions } from "./cli/shared.js";
import { registerInitCommand } from "./cli/init.js";
import { registerGenerateCommand } from "./cli/generate.js";
import { registerValidateCommand } from "./cli/validate.js";
import { registerStatusCommand } from "./cli/status.js";
import { registerAddCommand } from "./cli/add.js";
import { registerVerifyCommand } from "./cli/verify.js";
import { registerDoctorCommand } from "./cli/doctor.js";
import { registerUpdateCommand } from "./cli/update.js";
import { registerCleanCommand } from "./cli/clean.js";
import { registerComplianceCommand } from "./cli/compliance.js";
import { registerCiCommand } from "./cli/ci.js";
import { registerWatchCommand } from "./cli/watch.js";
import { registerRevertCommand } from "./cli/revert.js";

import { registerPresetCommand } from "./cli/preset.js";
import { registerDocsUpdateCommand } from "./cli/docs-update.js";
import { registerDocsCommand } from "./cli/docs.js";
import { registerDocsStampCommand } from "./cli/docs-stamp.js";
import { registerDocsCheckCommand } from "./cli/docs-check.js";
import { registerContributeCommand } from "./cli/contribute.js";
import { registerSkillCommand } from "./cli/skill.js";
import { registerOnboardCommand } from "./cli/onboard.js";
import { registerHooksCommand } from "./cli/hooks.js";
import { runCommandCenter } from "./cli/hub.js";
import { Logger } from "./core/output/logger.js";
import { PROJECT_NAME } from "./constants.js";
import type { GlobalOptions } from "./cli/shared.js";
import { checkTemplateRegistry } from "./core/scaffolder/template-registry-check.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8")) as {
  version: string;
};

const program = new Command();
program
  .name(PROJECT_NAME)
  .description("Unified configuration platform for AI coding agents")
  .version(pkg.version);

addGlobalOptions(program);
registerInitCommand(program);
registerGenerateCommand(program);
registerValidateCommand(program);
registerStatusCommand(program);
registerAddCommand(program);
registerVerifyCommand(program);
registerDoctorCommand(program);
registerUpdateCommand(program);
registerCleanCommand(program);
registerComplianceCommand(program);
registerCiCommand(program);
registerWatchCommand(program);
registerRevertCommand(program);

registerPresetCommand(program);
registerDocsUpdateCommand(program);
registerDocsCommand(program);
registerDocsStampCommand(program);
registerDocsCheckCommand(program);
registerContributeCommand(program);
registerSkillCommand(program);
registerOnboardCommand(program);
registerHooksCommand(program);

// Bare command (no subcommand) → launch Command Center
program.action(async () => {
  const opts = program.opts() as GlobalOptions;
  if (opts.json || opts.quiet) {
    program.help();
    return;
  }
  const registryErrors = checkTemplateRegistry();
  if (registryErrors.length > 0) {
    console.error(`\n[codi] Template registry integrity check failed:`);
    for (const e of registryErrors) console.error(`  • ${e}`);
    console.error(
      `\nThe CLI cannot run with broken templates. This is a bug — please report it.\n`,
    );
    process.exit(1);
  }
  Logger.init({ level: "info", mode: "human", noColor: opts.noColor ?? false });
  await runCommandCenter(process.cwd());
});

program.parse();

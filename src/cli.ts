import { Command } from 'commander';
import { createRequire } from 'node:module';
import { addGlobalOptions } from './cli/shared.js';
import { registerInitCommand } from './cli/init.js';
import { registerGenerateCommand } from './cli/generate.js';
import { registerValidateCommand } from './cli/validate.js';
import { registerStatusCommand } from './cli/status.js';
import { registerAddCommand } from './cli/add.js';
import { registerVerifyCommand } from './cli/verify.js';
import { registerDoctorCommand } from './cli/doctor.js';
import { registerUpdateCommand } from './cli/update.js';
import { registerCleanCommand } from './cli/clean.js';
import { registerComplianceCommand } from './cli/compliance.js';
import { registerCiCommand } from './cli/ci.js';
import { registerWatchCommand } from './cli/watch.js';
import { registerRevertCommand } from './cli/revert.js';
import { registerMarketplaceCommand } from './cli/marketplace.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

const program = new Command();
program
  .name('codi')
  .description('Unified configuration platform for AI coding agents')
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
registerMarketplaceCommand(program);

program.parse();

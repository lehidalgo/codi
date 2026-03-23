import type { Command } from 'commander';
import { resolveConfig } from '../core/config/resolver.js';
import { buildVerificationData } from '../core/verify/token.js';
import { checkAgentResponse } from '../core/verify/checker.js';
import { createCommandResult } from '../core/output/formatter.js';
import { EXIT_CODES } from '../core/output/exit-codes.js';
import type { CommandResult } from '../core/output/types.js';
import { initFromOptions, handleOutput } from './shared.js';
import type { GlobalOptions } from './shared.js';

interface VerifyCommandOptions extends GlobalOptions {
  check?: string;
}

interface VerifyShowData {
  token: string;
  rules: string[];
  skills: string[];
  agents: string[];
  flags: string[];
  prompt: string;
}

interface VerifyCheckData {
  tokenMatch: boolean;
  expectedToken: string;
  receivedToken: string | null;
  rulesFound: string[];
  rulesMissing: string[];
  rulesExtra: string[];
  flagsFound: string[];
  flagsMissing: string[];
}

export async function verifyHandler(
  projectRoot: string,
  options: VerifyCommandOptions,
): Promise<CommandResult<VerifyShowData | VerifyCheckData>> {
  const configResult = await resolveConfig(projectRoot);
  if (!configResult.ok) {
    return createCommandResult({
      success: false,
      command: 'verify',
      data: { token: '', rules: [], skills: [], agents: [], flags: [], prompt: '' } as VerifyShowData,
      errors: configResult.errors,
      exitCode: configResult.errors[0]?.code === 'E_CONFIG_NOT_FOUND'
        ? EXIT_CODES.CONFIG_NOT_FOUND
        : EXIT_CODES.CONFIG_INVALID,
    });
  }

  const verifyData = buildVerificationData(configResult.data);

  if (options.check) {
    const result = checkAgentResponse(options.check, verifyData);
    const allMatch = result.tokenMatch
      && result.rulesMissing.length === 0
      && result.flagsMissing.length === 0;

    return createCommandResult({
      success: allMatch,
      command: 'verify --check',
      data: result satisfies VerifyCheckData,
      exitCode: allMatch ? EXIT_CODES.SUCCESS : EXIT_CODES.VERIFY_MISMATCH,
    });
  }

  const prompt = 'Verify codi configuration. Report the verification token, rule names, and active flags from your instructions.';

  return createCommandResult({
    success: true,
    command: 'verify',
    data: {
      token: verifyData.token,
      rules: verifyData.ruleNames,
      skills: verifyData.skillNames,
      agents: verifyData.agentNames,
      flags: verifyData.activeFlags,
      prompt,
    } satisfies VerifyShowData,
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export function registerVerifyCommand(program: Command): void {
  program
    .command('verify')
    .description('Verify agent configuration awareness')
    .option('--check <response>', 'Validate a pasted agent response')
    .action(async (cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: VerifyCommandOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);
      const result = await verifyHandler(process.cwd(), options);
      handleOutput(result, options);
      process.exit(result.exitCode);
    });
}

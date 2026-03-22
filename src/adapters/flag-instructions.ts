import type { ResolvedFlags } from '../types/flags.js';

export function buildFlagInstructions(flags: ResolvedFlags): string {
  const lines: string[] = [];

  const shellFlag = flags['allow_shell_commands'];
  if (shellFlag && shellFlag.value === false) {
    lines.push('Do NOT execute shell commands.');
  }

  const deleteFlag = flags['allow_file_deletion'];
  if (deleteFlag && deleteFlag.value === false) {
    lines.push('Do NOT delete files.');
  }

  const maxLines = flags['max_file_lines'];
  if (maxLines && typeof maxLines.value === 'number' && maxLines.value > 0) {
    lines.push(`Keep files under ${maxLines.value} lines.`);
  }

  const testsFlag = flags['require_tests'];
  if (testsFlag && testsFlag.value === true) {
    lines.push('Write tests for all new code.');
  }

  return lines.join('\n');
}

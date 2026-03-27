import type { ResolvedFlags } from '../types/flags.js';

export function buildFlagInstructions(flags: ResolvedFlags): string {
  const lines: string[] = [];

  const shellFlag = flags['allow_shell_commands'];
  if (shellFlag && shellFlag.value === false) {
    lines.push('Do NOT execute shell commands.');
  } else if (shellFlag && shellFlag.value === true) {
    lines.push('Shell commands are allowed.');
  }

  const deleteFlag = flags['allow_file_deletion'];
  if (deleteFlag && deleteFlag.value === false) {
    lines.push('Do NOT delete files.');
  }

  const maxLines = flags['max_file_lines'];
  if (maxLines && typeof maxLines.value === 'number' && maxLines.value > 0) {
    lines.push(`Keep source code files under ${maxLines.value} lines. Documentation files have no line limit.`);
  }

  const testsFlag = flags['require_tests'];
  if (testsFlag && testsFlag.value === true) {
    lines.push('Write tests for all new code.');
  }

  const forcePushFlag = flags['allow_force_push'];
  if (forcePushFlag && forcePushFlag.value === false) {
    lines.push('Do NOT use force push (--force) on git operations.');
  }

  const prReviewFlag = flags['require_pr_review'];
  if (prReviewFlag && prReviewFlag.value === true) {
    lines.push('All changes require pull request review before merging.');
  }

  const mcpFlag = flags['mcp_allowed_servers'];
  if (mcpFlag && Array.isArray(mcpFlag.value) && mcpFlag.value.every((v: unknown) => typeof v === 'string') && mcpFlag.value.length > 0) {
    lines.push(`Only use these MCP servers: ${(mcpFlag.value as string[]).join(', ')}.`);
  }

  const docsFlag = flags['require_documentation'];
  if (docsFlag && docsFlag.value === true) {
    lines.push('Write documentation for all new code and APIs.');
  }

  const langsFlag = flags['allowed_languages'];
  if (langsFlag && Array.isArray(langsFlag.value) && langsFlag.value.every((v: unknown) => typeof v === 'string') && !(langsFlag.value as string[]).includes('*')) {
    lines.push(`Only use these languages: ${(langsFlag.value as string[]).join(', ')}.`);
  }

  const tokensFlag = flags['max_context_tokens'];
  if (tokensFlag && typeof tokensFlag.value === 'number') {
    lines.push(`Maximum context window: ${tokensFlag.value} tokens.`);
  }

  return lines.join('\n');
}

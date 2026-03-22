import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { verifyHandler } from '../../../src/cli/verify.js';
import { initHandler } from '../../../src/cli/init.js';
import { addRuleHandler } from '../../../src/cli/add.js';
import { generateHandler } from '../../../src/cli/generate.js';
import { Logger } from '../../../src/core/output/logger.js';
import { EXIT_CODES } from '../../../src/core/output/exit-codes.js';
import { clearAdapters } from '../../../src/core/generator/adapter-registry.js';

let tmpDir: string;

beforeEach(async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-verify-'));
  tmpDir = path.join(base, 'test-project');
  await fs.mkdir(tmpDir, { recursive: true });
  await fs.writeFile(
    path.join(tmpDir, 'package.json'),
    JSON.stringify({ name: 'test-project', version: '1.0.0' }),
    'utf-8',
  );
  clearAdapters();
  Logger.init({ level: 'error', mode: 'human', noColor: true });
});

afterEach(async () => {
  await fs.rm(path.dirname(tmpDir), { recursive: true, force: true });
  clearAdapters();
});

describe('verify command handler', () => {
  it('fails when no config exists', async () => {
    const result = await verifyHandler(tmpDir, {});
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.CONFIG_NOT_FOUND);
  });

  it('returns token, rules, flags, and prompt in show mode', async () => {
    await initHandler(tmpDir, { agents: ['claude-code'] });
    await addRuleHandler(tmpDir, 'code-quality', { template: 'code-style' });
    await generateHandler(tmpDir, {});

    const result = await verifyHandler(tmpDir, {});
    expect(result.success).toBe(true);
    expect(result.command).toBe('verify');

    const data = result.data as { token: string; rules: string[]; flags: string[]; prompt: string };
    expect(data.token).toMatch(/^codi-[a-f0-9]{6}$/);
    expect(data.rules.length).toBeGreaterThan(0);
    expect(typeof data.prompt).toBe('string');
    expect(data.prompt.length).toBeGreaterThan(0);
  });

  it('returns JSON-serializable result', async () => {
    await initHandler(tmpDir, { agents: ['claude-code'] });
    await addRuleHandler(tmpDir, 'code-quality', { template: 'code-style' });

    const result = await verifyHandler(tmpDir, {});
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    expect(parsed.success).toBe(true);
    expect(parsed.data.token).toMatch(/^codi-[a-f0-9]{6}$/);
  });

  it('validates a correct agent response in --check mode', async () => {
    await initHandler(tmpDir, { agents: ['claude-code'] });
    await addRuleHandler(tmpDir, 'code-quality', { template: 'code-style' });

    const showResult = await verifyHandler(tmpDir, {});
    const showData = showResult.data as { token: string; rules: string[]; flags: string[] };

    const response = [
      `Verification token: ${showData.token}`,
      `Rules loaded: ${showData.rules.join(', ')}`,
      `Flags active: ${showData.flags.join(', ')}`,
    ].join('\n');

    const checkResult = await verifyHandler(tmpDir, { check: response });
    expect(checkResult.success).toBe(true);
    expect(checkResult.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('reports mismatch for wrong token in --check mode', async () => {
    await initHandler(tmpDir, { agents: ['claude-code'] });
    await addRuleHandler(tmpDir, 'code-quality', { template: 'code-style' });

    const response = 'Verification token: codi-000000\nRules loaded: none';
    const result = await verifyHandler(tmpDir, { check: response });
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.VERIFY_MISMATCH);
  });
});

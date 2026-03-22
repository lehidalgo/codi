import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { addGlobalOptions, initFromOptions, handleOutput } from '../../../src/cli/shared.js';
import { createCommandResult } from '../../../src/core/output/formatter.js';
import { EXIT_CODES } from '../../../src/core/output/exit-codes.js';

describe('shared CLI utilities', () => {
  describe('addGlobalOptions', () => {
    it('adds --json, --verbose, --quiet, --no-color options', () => {
      const cmd = new Command();
      addGlobalOptions(cmd);

      cmd.parse(['--json', '--verbose'], { from: 'user' });
      const opts = cmd.opts();
      expect(opts['json']).toBe(true);
      expect(opts['verbose']).toBe(true);
    });
  });

  describe('initFromOptions', () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;
    let stderrSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
      stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    });

    afterEach(() => {
      exitSpy.mockRestore();
      stderrSpy.mockRestore();
    });

    it('initializes logger with defaults', () => {
      expect(() => initFromOptions({})).not.toThrow();
    });

    it('rejects --verbose and --quiet together', () => {
      expect(() => initFromOptions({ verbose: true, quiet: true })).toThrow();
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('handleOutput', () => {
    let stdoutSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    });

    afterEach(() => {
      stdoutSpy.mockRestore();
    });

    it('outputs JSON when --json is set', () => {
      const result = createCommandResult({
        success: true,
        command: 'test',
        data: { hello: 'world' },
        exitCode: EXIT_CODES.SUCCESS,
      });

      handleOutput(result, { json: true });
      const output = (stdoutSpy.mock.calls[0]![0] as string);
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
      expect(parsed.data.hello).toBe('world');
    });

    it('outputs human-readable format by default', () => {
      const result = createCommandResult({
        success: true,
        command: 'test',
        data: null,
        exitCode: EXIT_CODES.SUCCESS,
      });

      handleOutput(result, {});
      const output = (stdoutSpy.mock.calls[0]![0] as string);
      expect(output).toContain('[OK] test');
    });
  });
});

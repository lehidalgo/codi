import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger } from '../../src/core/output/logger.js';

describe('Logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('writes to stderr in human mode', () => {
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = new Logger({ level: 'info', mode: 'human', noColor: true });
    logger.info('hello world');
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('hello world'));
  });

  it('suppresses logs in json mode', () => {
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = new Logger({ level: 'debug', mode: 'json', noColor: true });
    logger.info('should not appear');
    logger.error('also not');
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('respects log level filtering', () => {
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = new Logger({ level: 'warn', mode: 'human', noColor: true });
    logger.debug('skip');
    logger.info('skip');
    expect(writeSpy).not.toHaveBeenCalled();
    logger.warn('show');
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });

  it('getInstance returns singleton', () => {
    const a = Logger.getInstance();
    const b = Logger.getInstance();
    expect(a).toBe(b);
  });

  it('init creates new instance', () => {
    const logger = Logger.init({ level: 'debug', mode: 'human', noColor: false });
    expect(Logger.getInstance()).toBe(logger);
  });

  it('setLevel changes filtering', () => {
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = new Logger({ level: 'error', mode: 'human', noColor: true });
    logger.warn('hidden');
    expect(writeSpy).not.toHaveBeenCalled();
    logger.setLevel('warn');
    logger.warn('visible');
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });

  it('setMode switches between human and json', () => {
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = new Logger({ level: 'info', mode: 'human', noColor: true });
    logger.info('visible');
    expect(writeSpy).toHaveBeenCalledTimes(1);
    logger.setMode('json');
    logger.info('invisible');
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });
});

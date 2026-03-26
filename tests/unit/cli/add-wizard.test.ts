import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  multiselect: vi.fn(),
  select: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
}));

import * as p from '@clack/prompts';
import { runAddWizard, selectArtifactType } from '../../../src/cli/add-wizard.js';

describe('selectArtifactType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(p.isCancel).mockReturnValue(false);
  });

  it('returns selected artifact type', async () => {
    vi.mocked(p.select).mockResolvedValueOnce('rule' as never);

    const result = await selectArtifactType();
    expect(result).toBe('rule');
  });

  it('exits when selection is cancelled', async () => {
    vi.mocked(p.select).mockResolvedValueOnce(Symbol('cancel') as never);
    vi.mocked(p.isCancel).mockReturnValueOnce(true);
    vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

    await expect(selectArtifactType()).rejects.toThrow('exit');
    expect(p.cancel).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe('runAddWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(p.isCancel).mockReturnValue(false);
  });

  it('returns templates selection when mode is templates', async () => {
    vi.mocked(p.select).mockResolvedValueOnce('templates' as never);
    vi.mocked(p.multiselect).mockResolvedValueOnce(['security', 'testing'] as never);
    vi.mocked(p.confirm).mockResolvedValueOnce(true as never);

    const result = await runAddWizard('rule');

    expect(result).not.toBeNull();
    expect(result!.names).toEqual(['security', 'testing']);
    expect(result!.useTemplates).toBe(true);
  });

  it('returns null when no templates selected', async () => {
    vi.mocked(p.select).mockResolvedValueOnce('templates' as never);
    vi.mocked(p.multiselect).mockResolvedValueOnce([] as never);

    const result = await runAddWizard('skill');
    expect(result).toBeNull();
  });

  it('returns null when confirmation is denied', async () => {
    vi.mocked(p.select).mockResolvedValueOnce('templates' as never);
    vi.mocked(p.multiselect).mockResolvedValueOnce(['code-review'] as never);
    vi.mocked(p.confirm).mockResolvedValueOnce(false as never);

    const result = await runAddWizard('skill');
    expect(result).toBeNull();
  });

  it('returns custom name when mode is blank', async () => {
    vi.mocked(p.select).mockResolvedValueOnce('blank' as never);
    vi.mocked(p.text).mockResolvedValueOnce('my-custom-rule' as never);

    const result = await runAddWizard('rule');

    expect(result).not.toBeNull();
    expect(result!.names).toEqual(['my-custom-rule']);
    expect(result!.useTemplates).toBe(false);
  });

  it('exits when mode selection is cancelled', async () => {
    vi.mocked(p.select).mockResolvedValueOnce(Symbol('cancel') as never);
    vi.mocked(p.isCancel).mockReturnValueOnce(true);
    vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

    await expect(runAddWizard('agent')).rejects.toThrow('exit');
    vi.restoreAllMocks();
  });

  it('exits when template multiselect is cancelled', async () => {
    vi.mocked(p.select).mockResolvedValueOnce('templates' as never);
    vi.mocked(p.multiselect).mockResolvedValueOnce(Symbol('cancel') as never);
    vi.mocked(p.isCancel).mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

    await expect(runAddWizard('command')).rejects.toThrow('exit');
    vi.restoreAllMocks();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @clack/prompts before importing the module
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  note: vi.fn(),
  multiselect: vi.fn(),
  select: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
  log: {
    message: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    step: vi.fn(),
    warn: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

import * as p from '@clack/prompts';
import { runInitWizard } from '../../../src/cli/init-wizard.js';

describe('runInitWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(p.isCancel).mockReturnValue(false);
  });

  it('returns null when agent selection is cancelled', async () => {
    vi.mocked(p.multiselect).mockResolvedValueOnce(Symbol('cancel') as never);
    vi.mocked(p.isCancel).mockReturnValueOnce(false).mockReturnValueOnce(true);

    const result = await runInitWizard([], [], ['claude-code', 'cursor']);
    expect(result).toBeNull();
    expect(p.cancel).toHaveBeenCalled();
  });

  it('returns null when no agents selected', async () => {
    vi.mocked(p.multiselect).mockResolvedValueOnce([] as never);

    const result = await runInitWizard([], [], ['claude-code']);
    expect(result).toBeNull();
  });

  it('returns zip config when zip mode selected', async () => {
    vi.mocked(p.multiselect).mockResolvedValueOnce(['claude-code'] as never);
    vi.mocked(p.select).mockResolvedValueOnce('zip' as never);
    vi.mocked(p.text).mockResolvedValueOnce('/path/to/preset.zip' as never);

    const result = await runInitWizard(['node'], ['claude-code'], ['claude-code', 'cursor']);

    expect(result).not.toBeNull();
    expect(result!.configMode).toBe('zip');
    expect(result!.importSource).toBe('/path/to/preset.zip');
    expect(result!.agents).toEqual(['claude-code']);
  });

  it('returns github config when github mode selected', async () => {
    vi.mocked(p.multiselect).mockResolvedValueOnce(['claude-code'] as never);
    vi.mocked(p.select).mockResolvedValueOnce('github' as never);
    vi.mocked(p.text).mockResolvedValueOnce('org/my-preset' as never);

    const result = await runInitWizard([], [], ['claude-code']);

    expect(result).not.toBeNull();
    expect(result!.configMode).toBe('github');
    expect(result!.importSource).toBe('org/my-preset');
  });

  it('returns custom config with artifact selections', async () => {
    // Step 1: agent selection
    vi.mocked(p.multiselect)
      .mockResolvedValueOnce(['claude-code'] as never)    // agents
      .mockResolvedValueOnce(['security'] as never)        // rules
      .mockResolvedValueOnce(['code-review'] as never)     // skills
      .mockResolvedValueOnce([])                           // agent templates
      .mockResolvedValueOnce(['commit'] as never);         // commands

    vi.mocked(p.select)
      .mockResolvedValueOnce('custom' as never)            // config mode
      .mockResolvedValueOnce('balanced' as never);         // flag preset

    vi.mocked(p.confirm)
      .mockResolvedValueOnce(false as never)               // save as preset? no
      .mockResolvedValueOnce(true as never);               // version pin? yes

    const result = await runInitWizard(['node'], [], ['claude-code']);

    expect(result).not.toBeNull();
    expect(result!.configMode).toBe('custom');
    expect(result!.rules).toEqual(['security']);
    expect(result!.skills).toEqual(['code-review']);
    expect(result!.commandTemplates).toEqual(['commit']);
    expect(result!.preset).toBe('balanced');
    expect(result!.versionPin).toBe(true);
  });

  it('returns preset config when preset mode selected without modifications', async () => {
    // Need to get the preset definition to know what initialValues will be
    const { getBuiltinPresetDefinition } = await import('../../../src/templates/presets/index.js');
    const presetDef = getBuiltinPresetDefinition('balanced');
    const presetRules = presetDef?.rules ?? [];
    const presetSkills = presetDef?.skills ?? [];
    const presetAgents = presetDef?.agents ?? [];
    const presetCommands = presetDef?.commands ?? [];

    // Step 1: agent selection
    vi.mocked(p.multiselect)
      .mockResolvedValueOnce(['claude-code'] as never)     // agents
      .mockResolvedValueOnce(presetRules as never)         // rules (same as preset)
      .mockResolvedValueOnce(presetSkills as never)        // skills (same as preset)
      .mockResolvedValueOnce(presetAgents as never)        // agents (same as preset)
      .mockResolvedValueOnce(presetCommands as never);     // commands (same as preset)

    vi.mocked(p.select)
      .mockResolvedValueOnce('preset' as never)            // config mode
      .mockResolvedValueOnce('balanced' as never);         // preset choice

    vi.mocked(p.confirm)
      .mockResolvedValueOnce(false as never);              // version pin

    const result = await runInitWizard([], [], ['claude-code']);

    expect(result).not.toBeNull();
    expect(result!.configMode).toBe('preset');
    expect(result!.presetName).toBe('balanced');
  });

  it('prompts save-as-preset when preset artifacts are modified', async () => {
    // Get actual preset artifacts to ensure we're really different
    const { getBuiltinPresetDefinition } = await import('../../../src/templates/presets/index.js');
    const presetDef = getBuiltinPresetDefinition('strict');
    const presetRules = presetDef?.rules ?? [];

    // Remove one rule to ensure it's "modified"
    const modifiedRules = presetRules.length > 0 ? presetRules.slice(1) : ['extra-rule'];

    vi.mocked(p.multiselect)
      .mockResolvedValueOnce(['claude-code'] as never)     // agents
      .mockResolvedValueOnce(modifiedRules as never)       // rules (different = modified)
      .mockResolvedValueOnce(presetDef?.skills ?? [] as never) // skills (same)
      .mockResolvedValueOnce(presetDef?.agents ?? [] as never) // agents (same)
      .mockResolvedValueOnce(presetDef?.commands ?? [] as never); // commands (same)

    vi.mocked(p.select)
      .mockResolvedValueOnce('preset' as never)
      .mockResolvedValueOnce('strict' as never);

    vi.mocked(p.text)
      .mockResolvedValueOnce('my-custom-preset' as never); // save name

    vi.mocked(p.confirm)
      .mockResolvedValueOnce(true as never);               // version pin

    const result = await runInitWizard([], [], ['claude-code']);

    expect(result).not.toBeNull();
    expect(result!.configMode).toBe('custom');
    expect(result!.saveAsPreset).toBe('my-custom-preset');
  });

  it('maps python-web preset to balanced base', async () => {
    const { getBuiltinPresetDefinition } = await import('../../../src/templates/presets/index.js');
    const presetDef = getBuiltinPresetDefinition('python-web');
    const presetRules = presetDef?.rules ?? [];
    const presetSkills = presetDef?.skills ?? [];
    const presetAgents = presetDef?.agents ?? [];
    const presetCommands = presetDef?.commands ?? [];

    vi.mocked(p.multiselect)
      .mockResolvedValueOnce(['claude-code'] as never)
      .mockResolvedValueOnce(presetRules as never)
      .mockResolvedValueOnce(presetSkills as never)
      .mockResolvedValueOnce(presetAgents as never)
      .mockResolvedValueOnce(presetCommands as never);

    vi.mocked(p.select)
      .mockResolvedValueOnce('preset' as never)
      .mockResolvedValueOnce('python-web' as never);

    vi.mocked(p.confirm)
      .mockResolvedValueOnce(false as never);

    const result = await runInitWizard([], [], ['claude-code']);

    expect(result).not.toBeNull();
    expect(result!.preset).toBe('balanced');
  });

  it('returns null when configMode is cancelled', async () => {
    vi.mocked(p.multiselect).mockResolvedValueOnce(['claude-code'] as never);
    vi.mocked(p.select).mockResolvedValueOnce(Symbol('cancel') as never);
    vi.mocked(p.isCancel)
      .mockReturnValueOnce(false)  // agents check
      .mockReturnValueOnce(true);  // configMode check

    const result = await runInitWizard([], [], ['claude-code']);
    expect(result).toBeNull();
  });
});

import * as p from '@clack/prompts';
import { DEFAULT_PRESET } from '../constants.js';
import { getBuiltinPresetDefinition, BUILTIN_PRESETS } from '../templates/presets/index.js';
import { FLAG_CATALOG } from '../core/flags/flag-catalog.js';
import type { FlagDefinition } from '../types/flags.js';
import { AVAILABLE_TEMPLATES } from '../core/scaffolder/template-loader.js';
import { AVAILABLE_SKILL_TEMPLATES } from '../core/scaffolder/skill-template-loader.js';
import { AVAILABLE_AGENT_TEMPLATES } from '../core/scaffolder/agent-template-loader.js';
import { AVAILABLE_COMMAND_TEMPLATES } from '../core/scaffolder/command-template-loader.js';
import { AVAILABLE_MCP_SERVER_TEMPLATES, loadMcpServerTemplate } from '../core/scaffolder/mcp-template-loader.js';

export interface WizardResult {
  agents: string[];
  configMode: 'preset' | 'custom' | 'zip' | 'github';
  presetName?: string;
  selectedPresetName?: string;
  importSource?: string;
  saveAsPreset?: string;
  rules: string[];
  skills: string[];
  agentTemplates: string[];
  commandTemplates: string[];
  mcpServers: string[];
  preset: string;
  flags?: Record<string, FlagDefinition>;
  versionPin: boolean;
}

const BACK = Symbol('back');

function isBack<T>(value: T | symbol): value is typeof BACK {
  return p.isCancel(value);
}

function getReservedPresetNames(): Set<string> {
  return new Set(Object.keys(BUILTIN_PRESETS));
}

function formatLabel(name: string): string {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function buildPresetOptions(): Array<{ label: string; value: string; hint: string }> {
  return Object.entries(BUILTIN_PRESETS).map(([name, def]) => ({
    label: name === DEFAULT_PRESET ? `${formatLabel(name)} (recommended)` : formatLabel(name),
    value: name,
    hint: def.description,
  }));
}

export async function runInitWizard(
  detectedStack: string[],
  detectedAgents: string[],
  allAgents: string[],
): Promise<WizardResult | null> {
  p.intro('codi — Project Setup');

  p.note(
    [
      'space        toggle selection',
      'a            select / deselect all',
      'arrow keys   move up / down',
      'enter        confirm',
      'ctrl+c       go back (exit at first step)',
    ].join('\n'),
    'Keyboard shortcuts',
  );

  const stackLabel = detectedStack.length > 0 ? detectedStack.join(', ') : 'none detected';
  p.log.step(`Detected stack: ${stackLabel}`);

  let step = 0;
  let savedAgents: string[] | undefined;
  let savedConfigMode: WizardResult['configMode'] | undefined;

  while (step >= 0) {
    switch (step) {
      case 0: {
        p.log.step('Agents');
        const agents = await p.multiselect({
          message: 'Select agents to generate config for',
          options: allAgents.map((id) => ({ label: id, value: id })),
          initialValues: savedAgents ?? detectedAgents,
          required: true,
        });
        if (isBack(agents)) { p.cancel('Operation cancelled.'); return null; }
        if ((agents as string[]).length === 0) return null;
        savedAgents = agents as string[];
        step++;
        break;
      }
      case 1: {
        p.log.step('Configuration');
        const configMode = await p.select({
          message: 'How do you want to configure?',
          options: [
            { label: 'Use a built-in preset', value: 'preset' as const, hint: 'Curated configuration bundles' },
            { label: 'Import from ZIP file', value: 'zip' as const, hint: 'Load a preset from a .zip package' },
            { label: 'Import from GitHub', value: 'github' as const, hint: 'Load a preset from a GitHub repository' },
            { label: 'Custom selection', value: 'custom' as const, hint: 'Pick individual artifacts (searchable)' },
          ],
        });
        if (isBack(configMode)) { step--; break; }
        savedConfigMode = configMode as WizardResult['configMode'];
        step++;
        break;
      }
      case 2: {
        let result: WizardResult | null | typeof BACK;
        switch (savedConfigMode) {
          case 'zip': result = await handleZipPath(savedAgents!); break;
          case 'github': result = await handleGithubPath(savedAgents!); break;
          case 'preset': result = await handlePresetPath(savedAgents!); break;
          default: result = await handleCustomPath(savedAgents!); break;
        }
        if (result === BACK) { step--; break; }
        return result;
      }
    }
  }
  return null;
}

async function handleZipPath(agents: string[]): Promise<WizardResult | null | typeof BACK> {
  const zipPath = await p.text({
    message: 'Path to preset ZIP file',
    validate: (v) => {
      if (!v || !v.endsWith('.zip')) return 'Must be a .zip file';
    },
  });
  if (isBack(zipPath)) return BACK;

  p.outro('Importing preset from ZIP.');
  return {
    agents, configMode: 'zip', importSource: zipPath as string,
    rules: [], skills: [], agentTemplates: [], commandTemplates: [], mcpServers: [],
    preset: DEFAULT_PRESET, versionPin: true,
  };
}

async function handleGithubPath(agents: string[]): Promise<WizardResult | null | typeof BACK> {
  const repo = await p.text({
    message: 'GitHub repo (e.g., org/preset-name or github:org/repo@v1.0)',
  });
  if (isBack(repo)) return BACK;

  p.outro('Importing preset from GitHub.');
  return {
    agents, configMode: 'github', importSource: repo as string,
    rules: [], skills: [], agentTemplates: [], commandTemplates: [], mcpServers: [],
    preset: DEFAULT_PRESET, versionPin: true,
  };
}

async function editPresetFlags(
  presetName: string,
  flags: Record<string, FlagDefinition>,
): Promise<Record<string, FlagDefinition> | null> {
  const result = { ...flags };

  const lockedEntries = Object.entries(flags).filter(([, def]) => def.locked);
  if (lockedEntries.length > 0) {
    p.log.info(`Locked flags: ${lockedEntries.map(([k, d]) => `${k}=${String(d.value)}`).join(', ')}`);
  }

  const booleanKeys = Object.keys(flags).filter(
    k => FLAG_CATALOG[k]?.type === 'boolean' && !flags[k]?.locked,
  );
  if (booleanKeys.length > 0) {
    p.log.step(`Flags in "${presetName}" (modify to customize)`);
    const selected = await p.multiselect({
      message: 'Boolean flags (selected = enabled)',
      options: booleanKeys.map(k => ({
        label: `${k} — ${FLAG_CATALOG[k]!.description}`,
        value: k,
      })),
      initialValues: booleanKeys.filter(k => flags[k]?.value === true),
      required: false,
    });
    if (p.isCancel(selected)) return null;

    const enabledSet = new Set(selected);
    for (const key of booleanKeys) {
      result[key] = { ...result[key]!, value: enabledSet.has(key) };
    }
  }

  for (const [key, spec] of Object.entries(FLAG_CATALOG)) {
    if (spec.type !== 'enum' || !spec.values || flags[key]?.locked || !flags[key]) continue;
    const current = flags[key]!.value as string;
    const enumVal = await p.select({
      message: `${key} — ${spec.description}`,
      options: spec.values.map(v => ({ label: v, value: v })),
      initialValue: current,
    });
    if (p.isCancel(enumVal)) return null;
    result[key] = { ...result[key]!, value: enumVal };
  }

  for (const [key, spec] of Object.entries(FLAG_CATALOG)) {
    if (spec.type !== 'number' || flags[key]?.locked || !flags[key]) continue;
    const current = flags[key]!.value as number;
    const numVal = await p.text({
      message: `${key} — ${spec.description}`,
      initialValue: String(current),
      validate: (v) => {
        const n = Number(v);
        if (isNaN(n) || !Number.isInteger(n)) return 'Must be an integer';
        if (spec.min !== undefined && n < spec.min) return `Minimum: ${spec.min}`;
      },
    });
    if (p.isCancel(numVal)) return null;
    result[key] = { ...result[key]!, value: Number(numVal) };
  }

  return result;
}

async function handlePresetPath(agents: string[]): Promise<WizardResult | null | typeof BACK> {
  let step = 0;
  let selectedPreset: string | undefined;
  let editedFlags: Record<string, FlagDefinition> | undefined;
  let originalFlags: Record<string, FlagDefinition> = {};
  let rules: string[] | undefined;
  let skills: string[] | undefined;
  let agentTpls: string[] | undefined;
  let commands: string[] | undefined;
  let mcpServers: string[] | undefined;
  let saveAsPreset: string | undefined;

  while (step >= 0) {
    switch (step) {
      case 0: {
        const presetName = await p.select({ message: 'Choose a preset', options: buildPresetOptions() });
        if (isBack(presetName)) return BACK;
        selectedPreset = presetName as string;
        const presetDef = getBuiltinPresetDefinition(selectedPreset);
        originalFlags = { ...presetDef?.flags ?? {} };
        editedFlags = undefined;
        step++;
        break;
      }
      case 1: {
        const flags = await editPresetFlags(selectedPreset!, originalFlags);
        if (!flags) { step--; break; }
        editedFlags = flags;
        step++;
        break;
      }
      case 2: {
        const presetDef = getBuiltinPresetDefinition(selectedPreset!);
        const presetRules = new Set(presetDef?.rules ?? []);
        p.log.step(`Artifacts in "${selectedPreset}" (modify to customize)`);
        const val = await p.multiselect({
          message: 'Rules',
          options: AVAILABLE_TEMPLATES.map(t => ({ label: t, value: t })),
          initialValues: rules ?? AVAILABLE_TEMPLATES.filter(t => presetRules.has(t)),
          required: false,
        });
        if (isBack(val)) { step--; break; }
        rules = val as string[];
        step++;
        break;
      }
      case 3: {
        const presetDef = getBuiltinPresetDefinition(selectedPreset!);
        const presetSkills = new Set(presetDef?.skills ?? []);
        const val = await p.multiselect({
          message: 'Skills',
          options: AVAILABLE_SKILL_TEMPLATES.map(t => ({ label: t, value: t })),
          initialValues: skills ?? AVAILABLE_SKILL_TEMPLATES.filter(t => presetSkills.has(t)),
          required: false,
        });
        if (isBack(val)) { step--; break; }
        skills = val as string[];
        step++;
        break;
      }
      case 4: {
        const presetDef = getBuiltinPresetDefinition(selectedPreset!);
        const presetAgents = new Set(presetDef?.agents ?? []);
        const val = await p.multiselect({
          message: 'Agents',
          options: AVAILABLE_AGENT_TEMPLATES.map(t => ({ label: t, value: t })),
          initialValues: agentTpls ?? AVAILABLE_AGENT_TEMPLATES.filter(t => presetAgents.has(t)),
          required: false,
        });
        if (isBack(val)) { step--; break; }
        agentTpls = val as string[];
        step++;
        break;
      }
      case 5: {
        const presetDef = getBuiltinPresetDefinition(selectedPreset!);
        const presetCommands = new Set(presetDef?.commands ?? []);
        const val = await p.multiselect({
          message: 'Commands',
          options: AVAILABLE_COMMAND_TEMPLATES.map(t => ({ label: t, value: t })),
          initialValues: commands ?? AVAILABLE_COMMAND_TEMPLATES.filter(t => presetCommands.has(t)),
          required: false,
        });
        if (isBack(val)) { step--; break; }
        commands = val as string[];
        step++;
        break;
      }
      case 6: {
        const presetDef = getBuiltinPresetDefinition(selectedPreset!);
        const presetMcps = new Set(presetDef?.mcpServers ?? []);
        const val = await p.multiselect({
          message: 'MCP Servers',
          options: AVAILABLE_MCP_SERVER_TEMPLATES.map(t => {
            const tmpl = loadMcpServerTemplate(t);
            const hint = tmpl.ok ? tmpl.data.description : '';
            return { label: t, value: t, hint };
          }),
          initialValues: mcpServers ?? AVAILABLE_MCP_SERVER_TEMPLATES.filter(t => presetMcps.has(t)),
          required: false,
        });
        if (isBack(val)) { step--; break; }
        mcpServers = val as string[];
        step++;
        break;
      }
      case 7: {
        const presetDef = getBuiltinPresetDefinition(selectedPreset!);
        const flagsChanged = !sameFlagValues(editedFlags!, originalFlags);
        const changed = flagsChanged
          || !sameArrays(rules!, [...(presetDef?.rules ?? [])])
          || !sameArrays(skills!, [...(presetDef?.skills ?? [])])
          || !sameArrays(agentTpls!, [...(presetDef?.agents ?? [])])
          || !sameArrays(commands!, [...(presetDef?.commands ?? [])])
          || !sameArrays(mcpServers!, [...(presetDef?.mcpServers ?? [])]);

        if (changed) {
          p.log.step('Custom Preset');
          const customName = await p.text({
            message: 'You modified the preset. Save as custom preset (name)',
            initialValue: saveAsPreset ?? `${selectedPreset}-custom`,
            placeholder: `${selectedPreset}-custom`,
            validate: (v) => {
              if (!v || !/^[a-z][a-z0-9-]*$/.test(v)) return 'Must be kebab-case';
              if (getReservedPresetNames().has(v)) return `"${v}" is a built-in preset name`;
            },
          });
          if (isBack(customName)) { step--; break; }
          saveAsPreset = customName as string;
        }
        step++;
        break;
      }
      case 8: {
        const versionPin = await p.confirm({ message: 'Enable version pinning?' });
        if (isBack(versionPin)) { step--; break; }

        const presetDef = getBuiltinPresetDefinition(selectedPreset!);
        const flagsChanged = !sameFlagValues(editedFlags!, originalFlags);
        const changed = flagsChanged
          || !sameArrays(rules!, [...(presetDef?.rules ?? [])])
          || !sameArrays(skills!, [...(presetDef?.skills ?? [])])
          || !sameArrays(agentTpls!, [...(presetDef?.agents ?? [])])
          || !sameArrays(commands!, [...(presetDef?.commands ?? [])])
          || !sameArrays(mcpServers!, [...(presetDef?.mcpServers ?? [])]);

        p.outro('Configuration complete.');
        return {
          agents,
          configMode: changed ? 'custom' : 'preset',
          presetName: changed ? undefined : selectedPreset,
          selectedPresetName: selectedPreset,
          saveAsPreset,
          rules: rules!,
          skills: skills!,
          agentTemplates: agentTpls!,
          commandTemplates: commands!,
          mcpServers: mcpServers!,
          preset: selectedPreset!,
          flags: editedFlags,
          versionPin: versionPin as boolean,
        };
      }
    }
  }
  return null;
}

async function handleCustomPath(agents: string[]): Promise<WizardResult | null | typeof BACK> {
  let step = 0;
  let rules: string[] | undefined;
  let skills: string[] | undefined;
  let agentTpls: string[] | undefined;
  let commandTpls: string[] | undefined;
  let mcpServers: string[] | undefined;
  let preset: string | undefined;
  let saveAsPreset: string | undefined;

  while (step >= 0) {
    switch (step) {
      case 0: {
        p.log.step('Artifacts');
        const val = await p.multiselect({
          message: 'Select rules',
          options: AVAILABLE_TEMPLATES.map(t => ({ label: t, value: t })),
          initialValues: rules ?? [...AVAILABLE_TEMPLATES],
          required: false,
        });
        if (isBack(val)) return BACK;
        rules = val as string[];
        step++;
        break;
      }
      case 1: {
        const val = await p.multiselect({
          message: 'Select skills',
          options: AVAILABLE_SKILL_TEMPLATES.map(t => ({ label: t, value: t })),
          initialValues: skills,
          required: false,
        });
        if (isBack(val)) { step--; break; }
        skills = val as string[];
        step++;
        break;
      }
      case 2: {
        const val = await p.multiselect({
          message: 'Select agent definitions',
          options: AVAILABLE_AGENT_TEMPLATES.map(t => ({ label: t, value: t })),
          initialValues: agentTpls ?? [...AVAILABLE_AGENT_TEMPLATES],
          required: false,
        });
        if (isBack(val)) { step--; break; }
        agentTpls = val as string[];
        step++;
        break;
      }
      case 3: {
        const val = await p.multiselect({
          message: 'Select commands',
          options: AVAILABLE_COMMAND_TEMPLATES.map(t => ({ label: t, value: t })),
          initialValues: commandTpls ?? [...AVAILABLE_COMMAND_TEMPLATES],
          required: false,
        });
        if (isBack(val)) { step--; break; }
        commandTpls = val as string[];
        step++;
        break;
      }
      case 4: {
        const val = await p.multiselect({
          message: 'Select MCP servers',
          options: AVAILABLE_MCP_SERVER_TEMPLATES.map(t => {
            const tmpl = loadMcpServerTemplate(t);
            const hint = tmpl.ok ? tmpl.data.description : '';
            return { label: t, value: t, hint };
          }),
          initialValues: mcpServers ?? [],
          required: false,
        });
        if (isBack(val)) { step--; break; }
        mcpServers = val as string[];
        step++;
        break;
      }
      case 5: {
        const val = await p.select({
          message: 'Choose flag preset',
          options: [
            { label: 'Balanced (recommended)', value: 'balanced' as const, hint: BUILTIN_PRESETS['balanced']!.description },
            { label: 'Minimal', value: 'minimal' as const, hint: BUILTIN_PRESETS['minimal']!.description },
            { label: 'Strict', value: 'strict' as const, hint: BUILTIN_PRESETS['strict']!.description },
          ],
        });
        if (isBack(val)) { step--; break; }
        preset = val as string;
        step++;
        break;
      }
      case 6: {
        const save = await p.confirm({ message: 'Save this selection as a named preset for reuse?', initialValue: false });
        if (isBack(save)) { step--; break; }
        if (save) {
          const nameInput = await p.text({
            message: 'Preset name (kebab-case)',
            placeholder: 'my-team-preset',
            initialValue: saveAsPreset,
            validate: (v) => {
              if (!v || !/^[a-z][a-z0-9-]*$/.test(v)) return 'Must be kebab-case';
              if (getReservedPresetNames().has(v)) return `"${v}" is a built-in preset name`;
            },
          });
          if (isBack(nameInput)) { step--; break; }
          saveAsPreset = nameInput as string;
        } else {
          saveAsPreset = undefined;
        }
        step++;
        break;
      }
      case 7: {
        const versionPin = await p.confirm({ message: 'Enable version pinning?' });
        if (isBack(versionPin)) { step--; break; }

        p.outro('Configuration complete.');
        return {
          agents,
          configMode: 'custom',
          saveAsPreset,
          rules: rules!,
          skills: skills!,
          agentTemplates: agentTpls!,
          commandTemplates: commandTpls!,
          mcpServers: mcpServers!,
          preset: (preset ?? DEFAULT_PRESET) as string,
          versionPin: versionPin as boolean,
        };
      }
    }
  }
  return null;
}

function sameArrays(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every(item => setA.has(item));
}

function sameFlagValues(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

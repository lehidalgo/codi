import type { ResolvedFlags } from './flags.js';

export interface CodiManifest {
  name: string;
  version: '1';
  description?: string;
  agents?: string[];
  layers?: {
    rules?: boolean;
    skills?: boolean;
    commands?: boolean;
    agents?: boolean;
  };
  codi?: {
    requiredVersion?: string;
  };
  team?: string;
  source?: {
    repo: string;
    branch: string;
    paths: string[];
  };
  marketplace?: {
    registry: string;
    branch: string;
  };
  presetRegistry?: {
    url: string;
    branch: string;
  };
  presets?: string[];
}

export interface NormalizedRule {
  name: string;
  description: string;
  content: string;
  language?: string;
  priority: 'high' | 'medium' | 'low';
  scope?: string[];
  alwaysApply: boolean;
  managedBy: 'codi' | 'user';
}

export interface NormalizedSkill {
  name: string;
  description: string;
  content: string;
  compatibility?: string[];
  tools?: string[];
  disableModelInvocation?: boolean;
  argumentHint?: string;
  allowedTools?: string[];
  license?: string;
  metadata?: Record<string, string>;
  managedBy?: 'codi' | 'user';
}

export interface NormalizedCommand {
  name: string;
  description: string;
  content: string;
  managedBy?: 'codi' | 'user';
}

export interface NormalizedAgent {
  name: string;
  description: string;
  content: string;
  tools?: string[];
  model?: string;
  managedBy?: 'codi' | 'user';
}

export interface McpConfig {
  servers: Record<string, {
    type?: 'stdio' | 'http';
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
    enabled?: boolean;
  }>;
}

export interface NormalizedConfig {
  manifest: CodiManifest;
  rules: NormalizedRule[];
  skills: NormalizedSkill[];
  commands: NormalizedCommand[];
  agents: NormalizedAgent[];
  flags: ResolvedFlags;
  mcp: McpConfig;
}

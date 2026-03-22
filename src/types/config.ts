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
    context?: boolean;
  };
  codi?: {
    requiredVersion?: string;
  };
  sync?: {
    repo: string;
    branch: string;
    paths: string[];
  };
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
}

export interface NormalizedCommand {
  name: string;
  description: string;
  content: string;
}

export interface NormalizedAgent {
  name: string;
  description: string;
  content: string;
}

export interface NormalizedContext {
  name: string;
  content: string;
}

export interface McpConfig {
  servers: Record<string, {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  }>;
}

export interface NormalizedConfig {
  manifest: CodiManifest;
  rules: NormalizedRule[];
  skills: NormalizedSkill[];
  commands: NormalizedCommand[];
  agents: NormalizedAgent[];
  context: NormalizedContext[];
  flags: ResolvedFlags;
  mcp: McpConfig;
}

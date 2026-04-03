import type { MANAGED_BY_VALUES } from "../constants.js";
import type { ResolvedFlags } from "./flags.js";

export type ManagedBy = (typeof MANAGED_BY_VALUES)[number];

export interface ProjectManifest {
  name: string;
  version: "1";
  description?: string;
  agents?: string[];
  layers?: {
    rules?: boolean;
    skills?: boolean;
    commands?: boolean;
    agents?: boolean;
  };
  engine?: {
    requiredVersion?: string;
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
  priority: "high" | "medium" | "low";
  scope?: string[];
  alwaysApply: boolean;
  managedBy: ManagedBy;
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
  category?: string;
  license?: string;
  metadata?: Record<string, string>;
  managedBy?: ManagedBy;
  model?: string;
  effort?: "low" | "medium" | "high" | "max";
  context?: "fork";
  agent?: string;
  userInvocable?: boolean;
  paths?: string[];
  shell?: "bash" | "powershell";
  intentHints?: {
    taskType: string;
    examples: string[];
  };
}

export interface NormalizedCommand {
  name: string;
  description: string;
  content: string;
  managedBy?: ManagedBy;
}

export interface NormalizedAgent {
  name: string;
  description: string;
  content: string;
  tools?: string[];
  disallowedTools?: string[];
  model?: string;
  maxTurns?: number;
  effort?: "low" | "medium" | "high" | "max";
  managedBy?: ManagedBy;
}

export interface McpConfig {
  servers: Record<
    string,
    {
      type?: "stdio" | "http";
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      url?: string;
      headers?: Record<string, string>;
      enabled?: boolean;
    }
  >;
}

export interface NormalizedConfig {
  manifest: ProjectManifest;
  rules: NormalizedRule[];
  skills: NormalizedSkill[];
  commands: NormalizedCommand[];
  agents: NormalizedAgent[];
  flags: ResolvedFlags;
  mcp: McpConfig;
}

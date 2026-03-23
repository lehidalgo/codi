import type { NormalizedConfig } from './config.js';

export interface AgentPaths {
  configRoot: string;
  rules: string;
  skills: string | null;
  commands: string | null;
  agents: string | null;
  instructionFile: string;
  mcpConfig: string | null;
}

export interface AgentCapabilities {
  rules: boolean;
  skills: boolean;
  commands: boolean;
  mcp: boolean;
  frontmatter: boolean;
  progressiveLoading: boolean;
  agents: boolean;
  maxContextTokens: number;
}

export interface GeneratedFile {
  path: string;
  content: string;
  sources: string[];
  hash: string;
}

export interface GenerateOptions {
  agents?: string[];
  dryRun?: boolean;
  force?: boolean;
}

export type FileStatus = 'created' | 'updated' | 'unchanged' | 'deleted' | 'error';

export interface AgentFileStatus {
  path: string;
  status: FileStatus;
  hash?: string;
}

export interface AgentStatus {
  agentId: string;
  agentName: string;
  files: AgentFileStatus[];
}

export interface AgentAdapter {
  id: string;
  name: string;
  detect(projectRoot: string): Promise<boolean>;
  paths: AgentPaths;
  capabilities: AgentCapabilities;
  generate(config: NormalizedConfig, options: GenerateOptions): Promise<GeneratedFile[]>;
}

export type FlagMode =
  | 'enforced'
  | 'enabled'
  | 'disabled'
  | 'inherited'
  | 'delegated_to_agent_default'
  | 'conditional';

export interface FlagDefinition {
  mode: FlagMode;
  value?: unknown;
  locked?: boolean;
  conditions?: FlagConditions;
}

export interface FlagConditions {
  lang?: string[];
  framework?: string[];
  agent?: string[];
  file_pattern?: string[];
}

export interface ResolvedFlags {
  [key: string]: ResolvedFlag;
}

export interface ResolvedFlag {
  value: unknown;
  mode: FlagMode;
  source: string;
  locked: boolean;
}

export interface FlagSpec {
  type: 'boolean' | 'number' | 'enum' | 'string[]';
  default: unknown;
  values?: string[];
  min?: number;
  hook?: string | null;
  description: string;
}

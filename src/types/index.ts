export type { Result } from './result.js';
export { ok, err, isOk, isErr } from './result.js';

export type {
  FlagMode,
  FlagDefinition,
  FlagConditions,
  ResolvedFlags,
  ResolvedFlag,
  FlagSpec,
} from './flags.js';

export type {
  CodiManifest,
  NormalizedRule,
  NormalizedSkill,
  NormalizedCommand,
  NormalizedAgent,
  NormalizedContext,
  McpConfig,
  NormalizedConfig,
} from './config.js';

export type {
  AgentPaths,
  AgentCapabilities,
  GeneratedFile,
  GenerateOptions,
  FileStatus,
  AgentFileStatus,
  AgentStatus,
  AgentAdapter,
} from './agent.js';

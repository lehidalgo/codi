/**
 * ISSUE-087 — workflow YAML scaffolder.
 *
 * Writes a stub workflow definition to `.codi/workflows/<name>.yaml` so
 * project teams can add custom workflow types (alongside the built-in
 * project / feature / bug-fix / refactor / migration / team-consolidation
 * yamls shipped from `src/templates/workflows/`).
 *
 * Hook scaffolding is NOT implemented here. Hooks are CapabilityType
 * (framework-managed via hook-installer), not user-extensible artifacts —
 * users cannot add new hook entrypoints without first declaring them in
 * the hook registry. See ISSUE-087 closing notes.
 */

import type { Result } from "#src/types/result.js";
import { writeArtifactFile, replaceNamePlaceholder } from "./common.js";
import { DEFAULT_MAINTAINER } from "#src/constants.js";

const DEFAULT_CONTENT = `id: {{name}}
name: {{name}}
description: Custom workflow scaffolded by codi
version: 1
maintainers: ["${DEFAULT_MAINTAINER}"]
phases:
  intent:
    gates: [scope_described]
    next: [execute, abandoned]
    chains: []
  execute:
    gates: [work_done]
    next: [done, abandoned]
    chains: []
  done:
    gates: []
    next: []
  abandoned:
    gates: []
    next: []
flags:
  agent_driven: true
  produces_document: false
`;

export interface CreateWorkflowOptions {
  /** Workflow id in kebab-case. */
  name: string;
  /** Absolute path to the `.codi/` configuration directory. */
  configDir: string;
  /** When `true`, overwrite an existing workflow without error. */
  force?: boolean;
}

/**
 * Scaffold a new workflow yaml in `<configDir>/workflows/<name>.yaml`.
 *
 * Name validation, mkdir, conflict-check, and write are delegated to
 * `writeArtifactFile` (same orchestrator as rule / agent scaffolders).
 */
export async function createWorkflow(options: CreateWorkflowOptions): Promise<Result<string>> {
  const { name, configDir, force } = options;
  const content = replaceNamePlaceholder(DEFAULT_CONTENT, name);
  return writeArtifactFile({
    configDir,
    subdir: "workflows",
    name,
    ext: "yaml",
    content,
    label: "Workflow",
    force: Boolean(force),
  });
}

import path from "node:path";
import { resolveProjectDir } from "../utils/paths.js";
import { resolveArtifactName, prefixedName } from "../constants.js";
import { createRule } from "../core/scaffolder/rule-scaffolder.js";
import { createSkill } from "../core/scaffolder/skill-scaffolder.js";
import { createAgent } from "../core/scaffolder/agent-scaffolder.js";
import { createCommand } from "../core/scaffolder/command-scaffolder.js";
import { AVAILABLE_TEMPLATES } from "../core/scaffolder/template-loader.js";
import { AVAILABLE_AGENT_TEMPLATES } from "../core/scaffolder/agent-template-loader.js";
import { AVAILABLE_SKILL_TEMPLATES } from "../core/scaffolder/skill-template-loader.js";
import { AVAILABLE_COMMAND_TEMPLATES } from "../core/scaffolder/command-template-loader.js";
import { createMcpServer } from "../core/scaffolder/mcp-scaffolder.js";
import { AVAILABLE_MCP_SERVER_TEMPLATES } from "../core/scaffolder/mcp-template-loader.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import type { CommandResult } from "../core/output/types.js";
import { handleOutput, regenerateConfigs } from "./shared.js";
import type { GlobalOptions } from "./shared.js";
import { runAddWizard } from "./add-wizard.js";
import type { ArtifactType, AddWizardResult } from "./add-wizard.js";
import { OperationsLedgerManager } from "../core/audit/operations-ledger.js";

export interface AddRuleOptions extends GlobalOptions {
  template?: string;
  all?: boolean;
}

interface AddRuleData {
  name: string;
  path: string;
  template: string | null;
}

export async function addRuleHandler(
  projectRoot: string,
  name: string,
  options: AddRuleOptions,
): Promise<CommandResult<AddRuleData>> {
  const configDir = resolveProjectDir(projectRoot);

  const resolvedTemplate = options.template
    ? resolveArtifactName(options.template, AVAILABLE_TEMPLATES)
    : undefined;

  if (options.template && !resolvedTemplate) {
    return createCommandResult({
      success: false,
      command: "add rule",
      data: { name, path: "", template: options.template },
      errors: [
        {
          code: "E_CONFIG_INVALID",
          message: `Unknown template "${options.template}". Available: ${AVAILABLE_TEMPLATES.join(", ")}`,
          hint: `Use one of: ${AVAILABLE_TEMPLATES.join(", ")}`,
          severity: "error",
          context: { template: options.template },
        },
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const result = await createRule({
    name,
    configDir,
    template: resolvedTemplate,
  });

  if (!result.ok) {
    return createCommandResult({
      success: false,
      command: "add rule",
      data: { name, path: "", template: options.template ?? null },
      errors: result.errors,
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  return createCommandResult({
    success: true,
    command: "add rule",
    data: { name, path: result.data, template: options.template ?? null },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export interface AddSkillOptions extends GlobalOptions {
  template?: string;
  all?: boolean;
}

interface AddSkillData {
  name: string;
  path: string;
  template: string | null;
}

export async function addSkillHandler(
  projectRoot: string,
  name: string,
  options: AddSkillOptions,
): Promise<CommandResult<AddSkillData>> {
  const configDir = resolveProjectDir(projectRoot);

  const resolvedTemplate = options.template
    ? resolveArtifactName(options.template, AVAILABLE_SKILL_TEMPLATES)
    : undefined;

  if (options.template && !resolvedTemplate) {
    return createCommandResult({
      success: false,
      command: "add skill",
      data: { name, path: "", template: options.template },
      errors: [
        {
          code: "E_CONFIG_INVALID",
          message: `Unknown skill template "${options.template}". Available: ${AVAILABLE_SKILL_TEMPLATES.join(", ")}`,
          hint: `Use one of: ${AVAILABLE_SKILL_TEMPLATES.join(", ")}`,
          severity: "error",
          context: { template: options.template },
        },
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const result = await createSkill({
    name,
    configDir,
    template: resolvedTemplate,
    copyrightHolder: path.basename(projectRoot),
  });

  if (!result.ok) {
    return createCommandResult({
      success: false,
      command: "add skill",
      data: { name, path: "", template: options.template ?? null },
      errors: result.errors,
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  return createCommandResult({
    success: true,
    command: "add skill",
    data: { name, path: result.data, template: options.template ?? null },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export interface AddAgentOptions extends GlobalOptions {
  template?: string;
  all?: boolean;
}

interface AddAgentData {
  name: string;
  path: string;
  template: string | null;
}

export async function addAgentHandler(
  projectRoot: string,
  name: string,
  options: { template?: string },
): Promise<CommandResult<AddAgentData>> {
  const configDir = resolveProjectDir(projectRoot);

  const resolvedTemplate = options.template
    ? resolveArtifactName(options.template, AVAILABLE_AGENT_TEMPLATES)
    : undefined;

  if (options.template && !resolvedTemplate) {
    return createCommandResult({
      success: false,
      command: "add agent",
      data: { name, path: "", template: options.template },
      errors: [
        {
          code: "E_CONFIG_INVALID",
          message: `Unknown agent template "${options.template}". Available: ${AVAILABLE_AGENT_TEMPLATES.join(", ")}`,
          hint: `Use one of: ${AVAILABLE_AGENT_TEMPLATES.join(", ")}`,
          severity: "error",
          context: { template: options.template },
        },
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const result = await createAgent({
    name,
    configDir,
    template: resolvedTemplate,
  });

  if (!result.ok) {
    return createCommandResult({
      success: false,
      command: "add agent",
      data: { name, path: "", template: options.template ?? null },
      errors: result.errors,
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  return createCommandResult({
    success: true,
    command: "add agent",
    data: { name, path: result.data, template: options.template ?? null },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export interface AddCommandOptions extends GlobalOptions {
  template?: string;
  all?: boolean;
}

interface AddCommandData {
  name: string;
  path: string;
  template: string | null;
}

export async function addCommandHandler(
  projectRoot: string,
  name: string,
  options: { template?: string },
): Promise<CommandResult<AddCommandData>> {
  const configDir = resolveProjectDir(projectRoot);

  const resolvedTemplate = options.template
    ? resolveArtifactName(options.template, AVAILABLE_COMMAND_TEMPLATES)
    : undefined;

  if (options.template && !resolvedTemplate) {
    return createCommandResult({
      success: false,
      command: "add command",
      data: { name, path: "", template: options.template },
      errors: [
        {
          code: "E_CONFIG_INVALID",
          message: `Unknown command template "${options.template}". Available: ${AVAILABLE_COMMAND_TEMPLATES.join(", ")}`,
          hint: `Use one of: ${AVAILABLE_COMMAND_TEMPLATES.join(", ")}`,
          severity: "error",
          context: { template: options.template },
        },
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const result = await createCommand({
    name,
    configDir,
    template: resolvedTemplate,
  });

  if (!result.ok) {
    return createCommandResult({
      success: false,
      command: "add command",
      data: { name, path: "", template: options.template ?? null },
      errors: result.errors,
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  return createCommandResult({
    success: true,
    command: "add command",
    data: { name, path: result.data, template: options.template ?? null },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

interface AddBrandData {
  name: string;
  path: string;
}

export async function addBrandHandler(
  projectRoot: string,
  name: string,
  _options?: { template?: string },
): Promise<CommandResult<AddBrandData>> {
  const configDir = resolveProjectDir(projectRoot);

  const result = await createSkill({
    name,
    configDir,
    template: prefixedName("brand-identity"),
    copyrightHolder: path.basename(projectRoot),
  });

  if (!result.ok) {
    return createCommandResult({
      success: false,
      command: "add brand",
      data: { name, path: "" },
      errors: result.errors,
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  return createCommandResult({
    success: true,
    command: "add brand",
    data: { name, path: result.data },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export async function addMcpServerHandler(
  projectRoot: string,
  name: string,
  options: { template?: string },
): Promise<
  CommandResult<{ name: string; path: string; template: string | null }>
> {
  const configDir = resolveProjectDir(projectRoot);

  const resolvedTemplate = options.template
    ? resolveArtifactName(options.template, AVAILABLE_MCP_SERVER_TEMPLATES)
    : undefined;

  if (options.template && !resolvedTemplate) {
    return createCommandResult({
      success: false,
      command: "add mcp-server",
      data: { name, path: "", template: options.template },
      errors: [
        {
          code: "E_CONFIG_INVALID",
          message: `Unknown MCP server template "${options.template}". Available: ${AVAILABLE_MCP_SERVER_TEMPLATES.join(", ")}`,
          hint: `Use one of: ${AVAILABLE_MCP_SERVER_TEMPLATES.join(", ")}`,
          severity: "error",
          context: { template: options.template },
        },
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const result = await createMcpServer({
    name,
    configDir,
    template: resolvedTemplate,
  });

  if (!result.ok) {
    return createCommandResult({
      success: false,
      command: "add mcp-server",
      data: { name, path: "", template: options.template ?? null },
      errors: result.errors,
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  return createCommandResult({
    success: true,
    command: "add mcp-server",
    data: { name, path: result.data, template: options.template ?? null },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

async function logAddToLedger(
  projectRoot: string,
  artifactType: string,
  name: string,
): Promise<void> {
  try {
    const configDir = resolveProjectDir(projectRoot);
    const ledger = new OperationsLedgerManager(configDir);
    await ledger.logOperation({
      type: "add",
      timestamp: new Date().toISOString(),
      details: { artifactType, name },
    });
  } catch {
    // Best-effort
  }
}

export type ArtifactHandler = (
  projectRoot: string,
  name: string,
  options: { template?: string },
) => Promise<
  CommandResult<{ name: string; path: string; template: string | null }>
>;

export const brandAsArtifactHandler: ArtifactHandler = async (
  projectRoot,
  name,
) => {
  const result = await addBrandHandler(projectRoot, name);
  return createCommandResult({
    success: result.success,
    command: "add brand",
    data: { name, path: result.data.path, template: null },
    errors: result.errors.length > 0 ? result.errors : undefined,
    exitCode: result.exitCode,
  });
};

export async function handleWizardFlow(
  type: ArtifactType,
  handler: ArtifactHandler,
  options: GlobalOptions,
): Promise<void> {
  const wizardResult: AddWizardResult | null = await runAddWizard(type);
  if (!wizardResult) {
    process.exit(0);
    return;
  }

  const results: Array<{ name: string; success: boolean }> = [];
  for (const selected of wizardResult.names) {
    const templateOpt = wizardResult.useTemplates ? selected : undefined;
    const result = await handler(process.cwd(), selected, {
      ...options,
      template: templateOpt,
    });
    results.push({ name: selected, success: result.success });
  }
  const added = results.filter((r) => r.success).map((r) => r.name);
  if (added.length > 0) {
    await regenerateConfigs(process.cwd());
    for (const name of added) await logAddToLedger(process.cwd(), type, name);
  }
  const summary = createCommandResult({
    success: true,
    command: `add ${type}`,
    data: { added, total: wizardResult.names.length },
    exitCode: EXIT_CODES.SUCCESS,
  });
  handleOutput(summary, options);
  process.exit(summary.exitCode);
}

import type { Command } from "commander";
import { AVAILABLE_TEMPLATES } from "../core/scaffolder/template-loader.js";
import { AVAILABLE_AGENT_TEMPLATES } from "../core/scaffolder/agent-template-loader.js";
import { AVAILABLE_SKILL_TEMPLATES } from "../core/scaffolder/skill-template-loader.js";
import { AVAILABLE_MCP_SERVER_TEMPLATES } from "../core/scaffolder/mcp-template-loader.js";
import { initFromOptions, handleOutput, regenerateConfigs } from "./shared.js";
import type { GlobalOptions } from "./shared.js";
import {
  addRuleHandler,
  addSkillHandler,
  addAgentHandler,
  addBrandHandler,
  addMcpServerHandler,
  addWorkflowHandler,
  handleWizardFlow,
  brandAsArtifactHandler,
} from "./add-handlers.js";
import type { AddRuleOptions, AddSkillOptions, AddAgentOptions } from "./add-handlers.js";
import { emitNameRequiredError, runAddAll } from "./add-shared.js";
import { PROJECT_CLI, PROJECT_DIR } from "../constants.js";

export {
  addRuleHandler,
  addSkillHandler,
  addAgentHandler,
  addBrandHandler,
  addMcpServerHandler,
} from "./add-handlers.js";

export function registerAddCommand(program: Command): void {
  const addCmd = program
    .command("add")
    .description(`Add resources to the ${PROJECT_DIR}/ configuration`);

  addCmd
    .command("rule [name]")
    .description("Add a new custom rule")
    .option("-t, --template <template>", `Use a template (${AVAILABLE_TEMPLATES.join(", ")})`)
    .option("--all", "Add all available template rules")
    .action(async (name: string | undefined, cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: AddRuleOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);

      if (options.all) {
        await runAddAll({
          artifactType: "rule",
          templates: AVAILABLE_TEMPLATES,
          handler: addRuleHandler,
          options,
        });
      }

      if (!name && !options.json) {
        await handleWizardFlow("rule", addRuleHandler, options);
        return;
      }

      if (!name) {
        emitNameRequiredError({ artifactType: "rule", label: "Rule", options });
      }

      const result = await addRuleHandler(process.cwd(), name, options);
      if (result.success) await regenerateConfigs(process.cwd());
      handleOutput(result, options);
      process.exit(result.exitCode);
    });

  addCmd
    .command("skill [name]")
    .description("Add a new custom skill")
    .option(
      "-t, --template <template>",
      `Use a skill template (${AVAILABLE_SKILL_TEMPLATES.join(", ")})`,
    )
    .option("--all", "Add all available skill templates")
    .action(async (name: string | undefined, cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: AddSkillOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);

      if (options.all) {
        await runAddAll({
          artifactType: "skill",
          templates: AVAILABLE_SKILL_TEMPLATES,
          handler: addSkillHandler,
          options,
        });
      }

      if (!name && !options.json) {
        await handleWizardFlow("skill", addSkillHandler, options);
        return;
      }

      if (!name) {
        emitNameRequiredError({ artifactType: "skill", label: "Skill", options });
      }

      const result = await addSkillHandler(process.cwd(), name, options);
      if (result.success) await regenerateConfigs(process.cwd());
      handleOutput(result, options);
      process.exit(result.exitCode);
    });

  addCmd
    .command("agent [name]")
    .description("Add a new custom agent")
    .option(
      "-t, --template <template>",
      `Use an agent template (${AVAILABLE_AGENT_TEMPLATES.join(", ")})`,
    )
    .option("--all", "Add all available agent templates")
    .action(async (name: string | undefined, cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: AddAgentOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);

      if (options.all) {
        // Normalized to spread options like rule/skill (was previously dropping
        // global flags by passing only `{ template }` — see ISSUE-043 audit).
        await runAddAll({
          artifactType: "agent",
          templates: AVAILABLE_AGENT_TEMPLATES,
          handler: addAgentHandler,
          options,
        });
      }

      if (!name && !options.json) {
        await handleWizardFlow("agent", addAgentHandler, options);
        return;
      }

      if (!name) {
        emitNameRequiredError({ artifactType: "agent", label: "Agent", options });
      }

      const result = await addAgentHandler(process.cwd(), name, options);
      if (result.success) await regenerateConfigs(process.cwd());
      handleOutput(result, options);
      process.exit(result.exitCode);
    });

  addCmd
    .command("brand [name]")
    .description("Add a new brand identity")
    .action(async (name: string | undefined, _cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);

      if (!name && !globalOptions.json) {
        await handleWizardFlow("brand", brandAsArtifactHandler, globalOptions);
        return;
      }

      if (!name) {
        emitNameRequiredError({
          artifactType: "brand",
          label: "Brand",
          hint: `Usage: ${PROJECT_CLI} add brand <name>`,
          options: globalOptions,
        });
      }

      const result = await addBrandHandler(process.cwd(), name);
      if (result.success) await regenerateConfigs(process.cwd());
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });

  // ISSUE-087 — workflow scaffolder. No --template / --all variants yet: the
  // built-in workflows (project / feature / bug-fix / refactor / migration /
  // team-consolidation) ship from src/templates/workflows and are not
  // user-extensible through this command. Hook scaffolder deferred (hooks
  // are CapabilityType, framework-managed via hook-installer).
  addCmd
    .command("workflow [name]")
    .description("Scaffold a custom workflow yaml in .codi/workflows/<name>.yaml")
    .action(async (name: string | undefined) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      if (!name) {
        emitNameRequiredError({
          artifactType: "workflow",
          label: "Workflow",
          options: globalOptions,
        });
      }
      const result = await addWorkflowHandler(process.cwd(), name);
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });

  addCmd
    .command("mcp-server [name]")
    .description("Add a new MCP server configuration")
    .option(
      "-t, --template <template>",
      `Use a builtin template (${AVAILABLE_MCP_SERVER_TEMPLATES.join(", ")})`,
    )
    .option("--all", "Add all available MCP server templates")
    .action(async (name: string | undefined, cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options = { ...globalOptions, ...cmdOptions } as GlobalOptions & {
        template?: string;
        all?: boolean;
      };
      initFromOptions(options);

      if (options.all) {
        await runAddAll({
          artifactType: "mcp-server",
          templates: AVAILABLE_MCP_SERVER_TEMPLATES,
          handler: addMcpServerHandler,
          options,
        });
      }

      if (!name) {
        emitNameRequiredError({ artifactType: "mcp-server", label: "MCP server", options });
      }

      const result = await addMcpServerHandler(process.cwd(), name, options);
      if (result.success) await regenerateConfigs(process.cwd());
      handleOutput(result, options);
      process.exit(result.exitCode);
    });
}

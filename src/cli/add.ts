import type { Command } from "commander";
import { AVAILABLE_TEMPLATES } from "../core/scaffolder/template-loader.js";
import { AVAILABLE_AGENT_TEMPLATES } from "../core/scaffolder/agent-template-loader.js";
import { AVAILABLE_SKILL_TEMPLATES } from "../core/scaffolder/skill-template-loader.js";
import { AVAILABLE_MCP_SERVER_TEMPLATES } from "../core/scaffolder/mcp-template-loader.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import { initFromOptions, handleOutput, regenerateConfigs } from "./shared.js";
import type { GlobalOptions } from "./shared.js";
import {
  addRuleHandler,
  addSkillHandler,
  addAgentHandler,
  addBrandHandler,
  addMcpServerHandler,
  handleWizardFlow,
  brandAsArtifactHandler,
} from "./add-handlers.js";
import type { AddRuleOptions, AddSkillOptions, AddAgentOptions } from "./add-handlers.js";

export {
  addRuleHandler,
  addSkillHandler,
  addAgentHandler,
  addBrandHandler,
  addMcpServerHandler,
} from "./add-handlers.js";
import { PROJECT_CLI, PROJECT_DIR } from "../constants.js";

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
        const results: Array<{ name: string; success: boolean }> = [];
        for (const tmpl of AVAILABLE_TEMPLATES) {
          const result = await addRuleHandler(process.cwd(), tmpl, {
            ...options,
            template: tmpl,
          });
          results.push({ name: tmpl, success: result.success });
        }
        const added = results.filter((r) => r.success).map((r) => r.name);
        const skipped = results.filter((r) => !r.success).map((r) => r.name);
        await regenerateConfigs(process.cwd());
        const summary = createCommandResult({
          success: true,
          command: "add rule --all",
          data: { added, skipped, total: AVAILABLE_TEMPLATES.length },
          exitCode: EXIT_CODES.SUCCESS,
        });
        handleOutput(summary, options);
        process.exit(summary.exitCode);
        return;
      }

      if (!name && !options.json) {
        await handleWizardFlow("rule", addRuleHandler, options);
        return;
      }

      if (!name) {
        const err = createCommandResult({
          success: false,
          command: "add rule",
          data: { name: "", path: "", template: null },
          errors: [
            {
              code: "E_CONFIG_INVALID",
              message: "Rule name required. Use --all to add all templates.",
              hint: "",
              severity: "error",
              context: {},
            },
          ],
          exitCode: EXIT_CODES.GENERAL_ERROR,
        });
        handleOutput(err, options);
        process.exit(err.exitCode);
        return;
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
        const results: Array<{ name: string; success: boolean }> = [];
        for (const tmpl of AVAILABLE_SKILL_TEMPLATES) {
          const result = await addSkillHandler(process.cwd(), tmpl, {
            ...options,
            template: tmpl,
          });
          results.push({ name: tmpl, success: result.success });
        }
        const added = results.filter((r) => r.success).map((r) => r.name);
        const skipped = results.filter((r) => !r.success).map((r) => r.name);
        await regenerateConfigs(process.cwd());
        const summary = createCommandResult({
          success: true,
          command: "add skill --all",
          data: { added, skipped, total: AVAILABLE_SKILL_TEMPLATES.length },
          exitCode: EXIT_CODES.SUCCESS,
        });
        handleOutput(summary, options);
        process.exit(summary.exitCode);
        return;
      }

      if (!name && !options.json) {
        await handleWizardFlow("skill", addSkillHandler, options);
        return;
      }

      if (!name) {
        const err = createCommandResult({
          success: false,
          command: "add skill",
          data: { name: "", path: "", template: null },
          errors: [
            {
              code: "E_CONFIG_INVALID",
              message: "Skill name required. Use --all to add all templates.",
              hint: "",
              severity: "error",
              context: {},
            },
          ],
          exitCode: EXIT_CODES.GENERAL_ERROR,
        });
        handleOutput(err, options);
        process.exit(err.exitCode);
        return;
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
        const results: Array<{ name: string; success: boolean }> = [];
        for (const tmpl of AVAILABLE_AGENT_TEMPLATES) {
          const result = await addAgentHandler(process.cwd(), tmpl, {
            template: tmpl,
          });
          results.push({ name: tmpl, success: result.success });
        }
        const added = results.filter((r) => r.success).map((r) => r.name);
        const skipped = results.filter((r) => !r.success).map((r) => r.name);
        await regenerateConfigs(process.cwd());
        const summary = createCommandResult({
          success: true,
          command: "add agent --all",
          data: { added, skipped, total: AVAILABLE_AGENT_TEMPLATES.length },
          exitCode: EXIT_CODES.SUCCESS,
        });
        handleOutput(summary, options);
        process.exit(summary.exitCode);
        return;
      }

      if (!name && !options.json) {
        await handleWizardFlow("agent", addAgentHandler, options);
        return;
      }

      if (!name) {
        const errResult = createCommandResult({
          success: false,
          command: "add agent",
          data: { name: "", path: "", template: null },
          errors: [
            {
              code: "E_CONFIG_INVALID",
              message: "Agent name required. Use --all to add all templates.",
              hint: "",
              severity: "error",
              context: {},
            },
          ],
          exitCode: EXIT_CODES.GENERAL_ERROR,
        });
        handleOutput(errResult, options);
        process.exit(errResult.exitCode);
        return;
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
        const errResult = createCommandResult({
          success: false,
          command: "add brand",
          data: { name: "", path: "" },
          errors: [
            {
              code: "E_CONFIG_INVALID",
              message: "Brand name required.",
              hint: `Usage: ${PROJECT_CLI} add brand <name>`,
              severity: "error",
              context: {},
            },
          ],
          exitCode: EXIT_CODES.GENERAL_ERROR,
        });
        handleOutput(errResult, globalOptions);
        process.exit(errResult.exitCode);
        return;
      }

      const result = await addBrandHandler(process.cwd(), name);
      if (result.success) {
        await regenerateConfigs(process.cwd());
      }
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
        const results: Array<{ name: string; success: boolean }> = [];
        for (const tmpl of AVAILABLE_MCP_SERVER_TEMPLATES) {
          const result = await addMcpServerHandler(process.cwd(), tmpl, {
            template: tmpl,
          });
          results.push({ name: tmpl, success: result.success });
        }
        const added = results.filter((r) => r.success).map((r) => r.name);
        const skipped = results.filter((r) => !r.success).map((r) => r.name);
        await regenerateConfigs(process.cwd());
        const summary = createCommandResult({
          success: true,
          command: "add mcp-server --all",
          data: {
            added,
            skipped,
            total: AVAILABLE_MCP_SERVER_TEMPLATES.length,
          },
          exitCode: EXIT_CODES.SUCCESS,
        });
        handleOutput(summary, options);
        process.exit(summary.exitCode);
        return;
      }

      if (!name) {
        const errResult = createCommandResult({
          success: false,
          command: "add mcp-server",
          data: { name: "", path: "", template: null },
          errors: [
            {
              code: "E_CONFIG_INVALID",
              message: "MCP server name required. Use --all to add all templates.",
              hint: "",
              severity: "error",
              context: {},
            },
          ],
          exitCode: EXIT_CODES.GENERAL_ERROR,
        });
        handleOutput(errResult, options);
        process.exit(errResult.exitCode);
        return;
      }

      const result = await addMcpServerHandler(process.cwd(), name, options);
      if (result.success) {
        await regenerateConfigs(process.cwd());
      }
      handleOutput(result, options);
      process.exit(result.exitCode);
    });
}

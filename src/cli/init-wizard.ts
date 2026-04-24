import * as p from "@clack/prompts";
import { PROJECT_CLI } from "../constants.js";
import { getSupportedLanguages } from "../core/hooks/hook-registry.js";
import {
  handleZipPath,
  handleGithubPath,
  handlePresetPath,
  handleCustomPath,
  formatLabel,
} from "./init-wizard-paths.js";
import type { InstalledArtifactInventoryEntry } from "./installed-artifact-inventory.js";
import { printWelcomeBanner } from "./banner.js";
import { wizardSelect, wizardMultiselect } from "./wizard-prompts.js";

export interface WizardResult {
  languages: string[];
  agents: string[];
  configMode: "preset" | "custom" | "zip" | "github";
  presetName?: string;
  selectedPresetName?: string;
  importSource?: string;
  saveAsPreset?: string;
  rules: string[];
  skills: string[];
  agentTemplates: string[];
  mcpServers: string[];
  preset?: string;
  flagPreset?: string;
  flags?: Record<string, import("../types/flags.js").FlagDefinition>;
  versionPin: boolean;
}

function isBack<T>(value: T | symbol): value is symbol {
  return typeof value === "symbol";
}

export interface ExistingSelections {
  preset: string;
  rules: string[];
  skills: string[];
  agents: string[];
  mcpServers: string[];
}

export interface ExistingInstallContext {
  selections: ExistingSelections;
  inventory: InstalledArtifactInventoryEntry[];
}

export interface RunInitWizardOptions {
  /**
   * When true and existingInstall is set, skip step 0 (the Modify-vs-Fresh
   * prompt) and start at step 1 with installMode='modify'. Used by the hub's
   * "Customize codi setup" entry to avoid asking the user a question they
   * already answered by picking that menu item.
   */
  forceModify?: boolean;
}

export async function runInitWizard(
  detectedStack: string[],
  detectedAgents: string[],
  allAgents: string[],
  existingInstall?: ExistingInstallContext,
  options: RunInitWizardOptions = {},
): Promise<WizardResult | null> {
  printWelcomeBanner({
    detectedStack,
    detectedAgents: allAgents.filter((a) => detectedAgents.includes(a)),
  });

  p.intro(`${PROJECT_CLI} — Project Setup`);

  const forceModify = options.forceModify === true && existingInstall !== undefined;
  let step = forceModify ? 1 : 0;
  let savedLanguages: string[] | undefined;
  let savedAgents: string[] | undefined;
  let savedConfigMode: WizardResult["configMode"] | undefined;
  let installMode: "modify" | "fresh" = forceModify
    ? "modify"
    : existingInstall
      ? "modify"
      : "fresh";

  while (step >= 0) {
    switch (step) {
      case 0: {
        if (existingInstall) {
          p.log.step("Existing Installation");
          const action = await wizardSelect({
            message: `${PROJECT_CLI} is already installed. What do you want to do?`,
            options: [
              {
                label: "Modify current installation",
                value: "modify" as const,
                hint: "Reuse current artifacts and show installed, modified, and local-only entries",
              },
              {
                label: "Create a fresh installation",
                value: "fresh" as const,
                hint: "Start from builtin presets/custom selection without inheriting the current install",
              },
              {
                label: "Cancel",
                value: "cancel" as const,
                hint: "Exit setup",
              },
            ],
          });
          if (isBack(action) || action === "cancel") {
            p.cancel("Operation cancelled.");
            return null;
          }
          installMode = action as "modify" | "fresh";
        }
        step++;
        break;
      }
      case 1: {
        p.log.step("Languages");
        const allLanguages = getSupportedLanguages();
        const languages = await wizardMultiselect({
          message: "Select project languages for pre-commit hooks",
          options: allLanguages.map((lang) => ({
            label: formatLabel(lang),
            value: lang,
          })),
          initialValues: savedLanguages ?? detectedStack,
          required: false,
        });
        if (isBack(languages)) {
          p.cancel("Operation cancelled.");
          return null;
        }
        savedLanguages = languages as string[];
        step++;
        break;
      }
      case 2: {
        p.log.step("Agents");
        const agents = await wizardMultiselect({
          message: "Select agents to generate config for",
          options: allAgents.map((id) => ({ label: id, value: id })),
          initialValues: savedAgents ?? detectedAgents,
          required: true,
        });
        if (isBack(agents)) {
          step--;
          break;
        }
        if ((agents as string[]).length === 0) return null;
        savedAgents = agents as string[];
        step++;
        break;
      }
      case 3: {
        const isModify = installMode === "modify";
        p.log.step(isModify ? "Update Source" : "Configuration");
        const configMode = await wizardSelect({
          message: isModify
            ? "How do you want to update your installation?"
            : "How do you want to configure?",
          options: isModify
            ? [
                {
                  label: "Customize current artifacts",
                  value: "custom" as const,
                  hint: "Edit the current selection (default)",
                },
                {
                  label: "Import from ZIP file",
                  value: "zip" as const,
                  hint: "Replace the active preset with a .zip package",
                },
                {
                  label: "Import from GitHub",
                  value: "github" as const,
                  hint: "Replace the active preset with a GitHub repository",
                },
                {
                  label: "Switch to a built-in preset",
                  value: "preset" as const,
                  hint: "Reset the selection to a named built-in preset",
                },
              ]
            : [
                {
                  label: "Use a built-in preset",
                  value: "preset" as const,
                  hint: "Curated configuration bundles",
                },
                {
                  label: "Import from ZIP file",
                  value: "zip" as const,
                  hint: "Load a preset from a .zip package",
                },
                {
                  label: "Import from GitHub",
                  value: "github" as const,
                  hint: "Load a preset from a GitHub repository",
                },
                {
                  label: "Custom selection",
                  value: "custom" as const,
                  hint: "Pick individual artifacts (searchable)",
                },
              ],
        });
        if (isBack(configMode)) {
          step--;
          break;
        }
        savedConfigMode = configMode as WizardResult["configMode"];
        step++;
        break;
      }
      case 4: {
        let result: WizardResult | null | symbol;
        switch (savedConfigMode) {
          case "zip":
            result = await handleZipPath(
              savedAgents!,
              installMode === "modify" ? existingInstall : undefined,
            );
            break;
          case "github":
            result = await handleGithubPath(
              savedAgents!,
              installMode === "modify" ? existingInstall : undefined,
            );
            break;
          case "preset":
            result = await handlePresetPath(
              savedAgents!,
              installMode === "modify" ? existingInstall : undefined,
            );
            break;
          default:
            result = await handleCustomPath(
              savedAgents!,
              installMode === "modify" ? existingInstall : undefined,
            );
            break;
        }
        if (typeof result === "symbol") {
          step -= installMode === "modify" ? 2 : 1;
          break;
        }
        if (result) {
          result.languages = savedLanguages!;
        }
        return result;
      }
    }
  }
  return null;
}

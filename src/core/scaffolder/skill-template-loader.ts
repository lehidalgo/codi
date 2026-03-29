import { ok, err } from "../../types/result.js";
import type { Result } from "../../types/result.js";
import { createError } from "../output/errors.js";
import type { TemplateCounts } from "../../templates/skills/types.js";
import { AVAILABLE_TEMPLATES } from "./template-loader.js";
import { AVAILABLE_AGENT_TEMPLATES } from "./agent-template-loader.js";
import { AVAILABLE_COMMAND_TEMPLATES } from "./command-template-loader.js";
import { FLAG_CATALOG } from "../flags/flag-catalog.js";
import * as skillTemplates from "../../templates/skills/index.js";

type TemplateEntry = string | ((counts: TemplateCounts) => string);

const TEMPLATE_MAP: Record<string, TemplateEntry> = {
  mcp: skillTemplates.mcp,
  "code-review": skillTemplates.codeReview,
  documentation: skillTemplates.documentation,
  "codi-operations": skillTemplates.getCodiOperationsTemplate,
  "e2e-testing": skillTemplates.getE2eTestingTemplate,
  "security-scan": skillTemplates.securityScan,
  "test-coverage": skillTemplates.testCoverage,
  refactoring: skillTemplates.refactoring,
  "codebase-onboarding": skillTemplates.codebaseOnboarding,
  // presentation: deprecated, replaced by deck-engine
  "mobile-development": skillTemplates.mobileDevelopment,
  commit: skillTemplates.commit,
  "codi-preset-creator": skillTemplates.presetCreator,
  "codi-contribute": skillTemplates.contribute,
  "codi-skill-creator": skillTemplates.skillCreator,
  "codi-rule-creator": skillTemplates.ruleCreator,
  "codi-agent-creator": skillTemplates.agentCreator,
  "codi-command-creator": skillTemplates.commandCreator,
  "codi-compare-preset": skillTemplates.comparePreset,
  "guided-qa-testing": skillTemplates.guidedQaTesting,
  "mcp-server-creator": skillTemplates.mcpServerCreator,
  "error-recovery": skillTemplates.errorRecovery,
  "deck-engine": skillTemplates.deckEngine,
  "doc-engine": skillTemplates.docEngine,
  "claude-api": skillTemplates.claudeApi,
  pdf: skillTemplates.pdf,
  xlsx: skillTemplates.xlsx,
  docx: skillTemplates.docx,
  "webapp-testing": skillTemplates.webappTesting,
  pptx: skillTemplates.pptx,
  "frontend-design": skillTemplates.frontendDesign,
  "theme-factory": skillTemplates.themeFactory,
  "web-artifacts-builder": skillTemplates.webArtifactsBuilder,
  "algorithmic-art": skillTemplates.algorithmicArt,
  "canvas-design": skillTemplates.canvasDesign,
  "internal-comms": skillTemplates.internalComms,
  "slack-gif-creator": skillTemplates.slackGifCreator,
  "codi-docs": skillTemplates.codiDocs,
};

export const AVAILABLE_SKILL_TEMPLATES = Object.keys(TEMPLATE_MAP);

function getTemplateCounts(): TemplateCounts {
  return {
    rules: AVAILABLE_TEMPLATES.length,
    skills: AVAILABLE_SKILL_TEMPLATES.length,
    agents: AVAILABLE_AGENT_TEMPLATES.length,
    commands: AVAILABLE_COMMAND_TEMPLATES.length,
    flags: Object.keys(FLAG_CATALOG).length,
  };
}

export function loadSkillTemplate(templateName: string): Result<string> {
  const entry = TEMPLATE_MAP[templateName];
  if (!entry) {
    return err([
      createError("E_CONFIG_NOT_FOUND", {
        path: `skill-template:${templateName}`,
      }),
    ]);
  }
  const content =
    typeof entry === "function" ? entry(getTemplateCounts()) : entry;
  return ok(content);
}

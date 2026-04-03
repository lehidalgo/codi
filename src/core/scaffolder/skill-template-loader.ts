import { ok, err } from "../../types/result.js";
import type { Result } from "../../types/result.js";
import { createError } from "../output/errors.js";
import { prefixedName } from "#src/constants.js";
import { createVersionMap } from "../version/artifact-version.js";
import type { TemplateCounts, SkillTemplateDescriptor } from "../../templates/skills/types.js";
import { AVAILABLE_TEMPLATES } from "./template-loader.js";
import { AVAILABLE_AGENT_TEMPLATES } from "./agent-template-loader.js";
import { AVAILABLE_COMMAND_TEMPLATES } from "./command-template-loader.js";
import { FLAG_CATALOG } from "../flags/flag-catalog.js";
import * as skillTemplates from "../../templates/skills/index.js";

type TemplateEntry = string | ((counts: TemplateCounts) => string);

const TEMPLATE_MAP: Record<string, TemplateEntry> = {
  [prefixedName("mcp-ops")]: skillTemplates.mcpOps,
  [prefixedName("code-review")]: skillTemplates.codeReview,
  [prefixedName("documentation")]: skillTemplates.documentation,
  [prefixedName("operations")]: skillTemplates.getOperationsTemplate,
  [prefixedName("e2e-testing")]: skillTemplates.getE2eTestingTemplate,
  [prefixedName("security-scan")]: skillTemplates.securityScan,
  [prefixedName("test-coverage")]: skillTemplates.testCoverage,
  [prefixedName("refactoring")]: skillTemplates.refactoring,
  [prefixedName("codebase-onboarding")]: skillTemplates.codebaseOnboarding,
  [prefixedName("mobile-development")]: skillTemplates.mobileDevelopment,
  [prefixedName("commit")]: skillTemplates.commit,
  [prefixedName("preset-creator")]: skillTemplates.presetCreator,
  [prefixedName("contribute")]: skillTemplates.contribute,
  [prefixedName("skill-creator")]: skillTemplates.skillCreator,
  [prefixedName("rule-creator")]: skillTemplates.ruleCreator,
  [prefixedName("agent-creator")]: skillTemplates.agentCreator,
  [prefixedName("command-creator")]: skillTemplates.commandCreator,
  [prefixedName("compare-preset")]: skillTemplates.comparePreset,
  [prefixedName("guided-qa-testing")]: skillTemplates.guidedQaTesting,
  [prefixedName("error-recovery")]: skillTemplates.errorRecovery,
  [prefixedName("deck-engine")]: skillTemplates.deckEngine,
  [prefixedName("doc-engine")]: skillTemplates.docEngine,
  [prefixedName("claude-api")]: skillTemplates.claudeApi,
  [prefixedName("pdf")]: skillTemplates.pdf,
  [prefixedName("xlsx")]: skillTemplates.xlsx,
  [prefixedName("docx")]: skillTemplates.docx,
  [prefixedName("webapp-testing")]: skillTemplates.webappTesting,
  [prefixedName("pptx")]: skillTemplates.pptx,
  [prefixedName("frontend-design")]: skillTemplates.frontendDesign,
  [prefixedName("theme-factory")]: skillTemplates.themeFactory,
  [prefixedName("web-artifacts-builder")]: skillTemplates.webArtifactsBuilder,
  [prefixedName("algorithmic-art")]: skillTemplates.algorithmicArt,
  [prefixedName("canvas-design")]: skillTemplates.canvasDesign,
  [prefixedName("internal-comms")]: skillTemplates.internalComms,
  [prefixedName("slack-gif-creator")]: skillTemplates.slackGifCreator,
  [prefixedName("docs-manager")]: skillTemplates.docsManager,
  [prefixedName("brand-identity")]: skillTemplates.brandIdentity,
  [prefixedName("rl3-brand")]: skillTemplates.rl3Brand,
  [prefixedName("bbva-brand")]: skillTemplates.bbvaBrand,
  [prefixedName("content-factory")]: skillTemplates.contentFactory,
  [prefixedName("project-quality-guard")]: skillTemplates.projectQualityGuard,
  [prefixedName("audio-transcriber")]: skillTemplates.audioTranscriber,
  [prefixedName("skill-reporter")]: skillTemplates.skillReporter,
  [prefixedName("rule-feedback")]: skillTemplates.ruleFeedback,
  [prefixedName("refine-rules")]: skillTemplates.refineRules,
  [prefixedName("humanizer")]: skillTemplates.humanizer,
};

/** Maps template names to their static asset directories (when available). */
const STATIC_DIR_MAP: Record<string, string> = {
  [prefixedName("algorithmic-art")]: skillTemplates.algorithmicArtStaticDir,
  [prefixedName("canvas-design")]: skillTemplates.canvasDesignStaticDir,
  [prefixedName("claude-api")]: skillTemplates.claudeApiStaticDir,
  [prefixedName("docx")]: skillTemplates.docxStaticDir,
  [prefixedName("internal-comms")]: skillTemplates.internalCommsStaticDir,
  [prefixedName("pdf")]: skillTemplates.pdfStaticDir,
  [prefixedName("pptx")]: skillTemplates.pptxStaticDir,
  [prefixedName("skill-creator")]: skillTemplates.skillCreatorStaticDir,
  [prefixedName("slack-gif-creator")]: skillTemplates.slackGifCreatorStaticDir,
  [prefixedName("theme-factory")]: skillTemplates.themeFactoryStaticDir,
  [prefixedName("web-artifacts-builder")]: skillTemplates.webArtifactsBuilderStaticDir,
  [prefixedName("webapp-testing")]: skillTemplates.webappTestingStaticDir,
  [prefixedName("xlsx")]: skillTemplates.xlsxStaticDir,
  [prefixedName("rl3-brand")]: skillTemplates.rl3BrandStaticDir,
  [prefixedName("bbva-brand")]: skillTemplates.bbvaBrandStaticDir,
  [prefixedName("content-factory")]: skillTemplates.contentFactoryStaticDir,
  [prefixedName("project-quality-guard")]: skillTemplates.projectQualityGuardStaticDir,
  [prefixedName("audio-transcriber")]: skillTemplates.audioTranscriberStaticDir,
  [prefixedName("code-review")]: skillTemplates.codeReviewStaticDir,
  [prefixedName("security-scan")]: skillTemplates.securityScanStaticDir,
  [prefixedName("test-coverage")]: skillTemplates.testCoverageStaticDir,
  [prefixedName("refactoring")]: skillTemplates.refactoringStaticDir,
  [prefixedName("codebase-onboarding")]: skillTemplates.codebaseOnboardingStaticDir,
  [prefixedName("documentation")]: skillTemplates.documentationStaticDir,
  [prefixedName("commit")]: skillTemplates.commitStaticDir,
  [prefixedName("e2e-testing")]: skillTemplates.e2eTestingStaticDir,
  [prefixedName("guided-qa-testing")]: skillTemplates.guidedQaTestingStaticDir,
  [prefixedName("frontend-design")]: skillTemplates.frontendDesignStaticDir,
  [prefixedName("doc-engine")]: skillTemplates.docEngineStaticDir,
  [prefixedName("mcp-ops")]: skillTemplates.mcpOpsStaticDir,
  [prefixedName("deck-engine")]: skillTemplates.deckEngineStaticDir,
};

export const AVAILABLE_SKILL_TEMPLATES = Object.keys(TEMPLATE_MAP);
const TEMPLATE_VERSIONS = createVersionMap(AVAILABLE_SKILL_TEMPLATES);

function getTemplateCounts(): TemplateCounts {
  return {
    rules: AVAILABLE_TEMPLATES.length,
    skills: AVAILABLE_SKILL_TEMPLATES.length,
    agents: AVAILABLE_AGENT_TEMPLATES.length,
    commands: AVAILABLE_COMMAND_TEMPLATES.length,
    flags: Object.keys(FLAG_CATALOG).length,
  };
}

/** Resolve template entry to its string content. */
function resolveTemplate(entry: TemplateEntry): string {
  return typeof entry === "function" ? entry(getTemplateCounts()) : entry;
}

export function loadSkillTemplate(templateName: string): Result<SkillTemplateDescriptor> {
  const entry = TEMPLATE_MAP[templateName];
  if (!entry) {
    return err([
      createError("E_CONFIG_NOT_FOUND", {
        path: `skill-template:${templateName}`,
      }),
    ]);
  }
  const descriptor: SkillTemplateDescriptor = {
    template: resolveTemplate(entry),
  };
  const staticDir = STATIC_DIR_MAP[templateName];
  if (staticDir) {
    descriptor.staticDir = staticDir;
  }
  return ok(descriptor);
}

/**
 * Load only the template content string (for doc generation and other consumers
 * that only need the markdown content, not the full descriptor).
 */
export function loadSkillTemplateContent(templateName: string): Result<string> {
  const entry = TEMPLATE_MAP[templateName];
  if (!entry) {
    return err([
      createError("E_CONFIG_NOT_FOUND", {
        path: `skill-template:${templateName}`,
      }),
    ]);
  }
  return ok(resolveTemplate(entry));
}

export function getSkillTemplateVersion(templateName: string): number | undefined {
  return TEMPLATE_VERSIONS[templateName];
}

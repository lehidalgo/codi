import { ok, err } from "#src/types/result.js";
import type { Result } from "#src/types/result.js";
import { createError } from "../output/errors.js";
import { prefixedName } from "#src/constants.js";
import { parseVersionFromFrontmatter } from "../version/artifact-version.js";
import type { TemplateCounts, SkillTemplateDescriptor } from "#src/templates/skills/types.js";
import { AVAILABLE_TEMPLATES } from "./template-loader.js";
import { AVAILABLE_AGENT_TEMPLATES } from "./agent-template-loader.js";
import { FLAG_CATALOG } from "../flags/flag-catalog.js";
import * as skillTemplates from "#src/templates/skills/index.js";

type TemplateEntry = string | ((counts: TemplateCounts) => string);

const TEMPLATE_MAP: Record<string, TemplateEntry> = {
  [prefixedName("mcp-ops")]: skillTemplates.mcpOps,
  [prefixedName("code-review")]: skillTemplates.codeReview,
  [prefixedName("pr-review")]: skillTemplates.prReview,
  [prefixedName("project-documentation")]: skillTemplates.projectDocumentation,
  [prefixedName("dev-operations")]: skillTemplates.getCodidevOperationsTemplate,
  [prefixedName("dev-e2e-testing")]: skillTemplates.getCodidevE2eTestingTemplate,
  [prefixedName("security-scan")]: skillTemplates.securityScan,
  [prefixedName("test-suite")]: skillTemplates.testSuite,
  [prefixedName("refactoring")]: skillTemplates.refactoring,
  [prefixedName("codebase-onboarding")]: skillTemplates.codebaseOnboarding,
  [prefixedName("mobile-development")]: skillTemplates.mobileDevelopment,
  [prefixedName("commit")]: skillTemplates.commit,
  [prefixedName("preset-creator")]: skillTemplates.presetCreator,
  [prefixedName("artifact-contributor")]: skillTemplates.artifactContributor,
  [prefixedName("skill-creator")]: skillTemplates.skillCreator,
  [prefixedName("rule-creator")]: skillTemplates.ruleCreator,
  [prefixedName("agent-creator")]: skillTemplates.agentCreator,
  [prefixedName("compare-preset")]: skillTemplates.comparePreset,
  [prefixedName("guided-qa-testing")]: skillTemplates.guidedQaTesting,
  [prefixedName("session-recovery")]: skillTemplates.sessionRecovery,
  [prefixedName("claude-api")]: skillTemplates.claudeApi,
  [prefixedName("pdf")]: skillTemplates.pdf,
  [prefixedName("xlsx")]: skillTemplates.xlsx,
  [prefixedName("docx")]: skillTemplates.docx,
  [prefixedName("webapp-testing")]: skillTemplates.webappTesting,
  [prefixedName("pptx")]: skillTemplates.pptx,
  [prefixedName("frontend-design")]: skillTemplates.frontendDesign,
  [prefixedName("theme-factory")]: skillTemplates.themeFactory,
  [prefixedName("claude-artifacts-builder")]: skillTemplates.claudeArtifactsBuilder,
  [prefixedName("algorithmic-art")]: skillTemplates.algorithmicArt,
  [prefixedName("canvas-design")]: skillTemplates.canvasDesign,
  [prefixedName("internal-comms")]: skillTemplates.internalComms,
  [prefixedName("slack-gif-creator")]: skillTemplates.slackGifCreator,
  [prefixedName("dev-docs-manager")]: skillTemplates.devDocsManager,
  [prefixedName("brand-creator")]: skillTemplates.brandCreator,
  [prefixedName("codi-brand")]: skillTemplates.codiBrand,
  [prefixedName("content-factory")]: skillTemplates.contentFactory,
  [prefixedName("project-quality-guard")]: skillTemplates.projectQualityGuard,
  [prefixedName("audio-transcriber")]: skillTemplates.audioTranscriber,
  [prefixedName("rule-feedback")]: skillTemplates.ruleFeedback,
  [prefixedName("refine-rules")]: skillTemplates.refineRules,
  [prefixedName("humanizer")]: skillTemplates.humanizer,
  [prefixedName("session-log")]: skillTemplates.sessionLog,
  [prefixedName("codebase-explore")]: skillTemplates.codebaseExplore,
  [prefixedName("graph-sync")]: skillTemplates.graphSync,
  [prefixedName("roadmap")]: skillTemplates.roadmap,
  [prefixedName("verification")]: skillTemplates.verification,
  [prefixedName("debugging")]: skillTemplates.debugging,
  [prefixedName("tdd")]: skillTemplates.tdd,
  [prefixedName("brainstorming")]: skillTemplates.brainstorming,
  [prefixedName("plan-writer")]: skillTemplates.planWriter,
  [prefixedName("worktrees")]: skillTemplates.worktrees,
  [prefixedName("branch-finish")]: skillTemplates.branchFinish,
  [prefixedName("plan-execution")]: skillTemplates.planExecution,
  [prefixedName("notebooklm")]: skillTemplates.notebooklm,
  [prefixedName("evidence-gathering")]: skillTemplates.evidenceGathering,
  [prefixedName("step-documenter")]: skillTemplates.stepDocumenter,
  [prefixedName("audit-fix")]: skillTemplates.auditFix,
  [prefixedName("guided-execution")]: skillTemplates.guidedExecution,
  [prefixedName("box-validator")]: skillTemplates.boxValidator,
  [prefixedName("html-live-inspect")]: skillTemplates.htmlLiveInspect,
};

/** Maps template names to their static asset directories (when available).
 * Values may be `null` when the template has no static assets — consumers
 * already guard against a missing staticDir. */
const STATIC_DIR_MAP: Record<string, string | null> = {
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
  [prefixedName("claude-artifacts-builder")]: skillTemplates.claudeArtifactsBuilderStaticDir,
  [prefixedName("webapp-testing")]: skillTemplates.webappTestingStaticDir,
  [prefixedName("xlsx")]: skillTemplates.xlsxStaticDir,
  [prefixedName("brand-creator")]: skillTemplates.brandCreatorStaticDir,
  [prefixedName("codi-brand")]: skillTemplates.codiBrandStaticDir,
  [prefixedName("content-factory")]: skillTemplates.contentFactoryStaticDir,
  [prefixedName("project-quality-guard")]: skillTemplates.projectQualityGuardStaticDir,
  [prefixedName("audio-transcriber")]: skillTemplates.audioTranscriberStaticDir,
  [prefixedName("code-review")]: skillTemplates.codeReviewStaticDir,
  [prefixedName("pr-review")]: skillTemplates.prReviewStaticDir,
  [prefixedName("security-scan")]: skillTemplates.securityScanStaticDir,
  [prefixedName("test-suite")]: skillTemplates.testSuiteStaticDir,
  [prefixedName("refactoring")]: skillTemplates.refactoringStaticDir,
  [prefixedName("codebase-onboarding")]: skillTemplates.codebaseOnboardingStaticDir,
  [prefixedName("project-documentation")]: skillTemplates.projectDocumentationStaticDir,
  [prefixedName("commit")]: skillTemplates.commitStaticDir,
  [prefixedName("dev-e2e-testing")]: skillTemplates.devE2eTestingStaticDir,
  [prefixedName("guided-qa-testing")]: skillTemplates.guidedQaTestingStaticDir,
  [prefixedName("frontend-design")]: skillTemplates.frontendDesignStaticDir,
  [prefixedName("mcp-ops")]: skillTemplates.mcpOpsStaticDir,
  [prefixedName("debugging")]: skillTemplates.debuggingStaticDir,
  [prefixedName("tdd")]: skillTemplates.tddStaticDir,
  [prefixedName("plan-execution")]: skillTemplates.planExecutionStaticDir,
  [prefixedName("brainstorming")]: skillTemplates.brainstormingStaticDir,
  [prefixedName("plan-writer")]: skillTemplates.planWriterStaticDir,
  [prefixedName("verification")]: skillTemplates.verificationStaticDir,
  [prefixedName("session-log")]: skillTemplates.sessionLogStaticDir,
  [prefixedName("notebooklm")]: skillTemplates.notebooklmStaticDir,
  [prefixedName("box-validator")]: skillTemplates.boxValidatorStaticDir,
  [prefixedName("html-live-inspect")]: skillTemplates.htmlLiveInspectStaticDir,
  [prefixedName("agent-creator")]: skillTemplates.agentCreatorStaticDir,
  [prefixedName("artifact-contributor")]: skillTemplates.artifactContributorStaticDir,
  [prefixedName("audit-fix")]: skillTemplates.auditFixStaticDir,
  [prefixedName("branch-finish")]: skillTemplates.branchFinishStaticDir,
  [prefixedName("codebase-explore")]: skillTemplates.codebaseExploreStaticDir,
  [prefixedName("compare-preset")]: skillTemplates.comparePresetStaticDir,
  [prefixedName("dev-docs-manager")]: skillTemplates.devDocsManagerStaticDir,
  [prefixedName("dev-operations")]: skillTemplates.devOperationsStaticDir,
  [prefixedName("evidence-gathering")]: skillTemplates.evidenceGatheringStaticDir,
  [prefixedName("graph-sync")]: skillTemplates.graphSyncStaticDir,
  [prefixedName("guided-execution")]: skillTemplates.guidedExecutionStaticDir,
  [prefixedName("humanizer")]: skillTemplates.humanizerStaticDir,
  [prefixedName("mobile-development")]: skillTemplates.mobileDevelopmentStaticDir,
  [prefixedName("preset-creator")]: skillTemplates.presetCreatorStaticDir,
  [prefixedName("refine-rules")]: skillTemplates.refineRulesStaticDir,
  [prefixedName("roadmap")]: skillTemplates.roadmapStaticDir,
  [prefixedName("rule-creator")]: skillTemplates.ruleCreatorStaticDir,
  [prefixedName("rule-feedback")]: skillTemplates.ruleFeedbackStaticDir,
  [prefixedName("session-recovery")]: skillTemplates.sessionRecoveryStaticDir,
  [prefixedName("step-documenter")]: skillTemplates.stepDocumenterStaticDir,
  [prefixedName("worktrees")]: skillTemplates.worktreesStaticDir,
};

export const AVAILABLE_SKILL_TEMPLATES = Object.keys(TEMPLATE_MAP);

function getTemplateCounts(): TemplateCounts {
  const brandSkillNames = AVAILABLE_SKILL_TEMPLATES.filter((key) => {
    const bare = key.replace(/^codi-/, "");
    return bare.endsWith("-brand") && bare !== "brand-creator" && bare !== "brand";
  }).map((key) => key.replace(/^codi-/, ""));

  // Always ensure codi-brand is first (the default)
  const codiIdx = brandSkillNames.indexOf("codi-brand");
  if (codiIdx > 0) {
    brandSkillNames.splice(codiIdx, 1);
    brandSkillNames.unshift("codi-brand");
  }

  return {
    rules: AVAILABLE_TEMPLATES.length,
    skills: AVAILABLE_SKILL_TEMPLATES.length,
    agents: AVAILABLE_AGENT_TEMPLATES.length,
    flags: Object.keys(FLAG_CATALOG).length,
    brandSkillNames,
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
  const result = loadSkillTemplateContent(templateName);
  return result.ok ? parseVersionFromFrontmatter(result.data) : undefined;
}

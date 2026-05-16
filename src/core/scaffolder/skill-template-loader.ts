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
  [prefixedName("dev-preset-creator")]: skillTemplates.presetCreator,
  [prefixedName("dev-artifact-contributor")]: skillTemplates.artifactContributor,
  [prefixedName("dev-skill-creator")]: skillTemplates.skillCreator,
  [prefixedName("dev-rule-creator")]: skillTemplates.ruleCreator,
  [prefixedName("dev-agent-creator")]: skillTemplates.agentCreator,
  [prefixedName("dev-compare-preset")]: skillTemplates.comparePreset,
  [prefixedName("guided-qa-testing")]: skillTemplates.guidedQaTesting,
  [prefixedName("dev-session-recovery")]: skillTemplates.sessionRecovery,
  [prefixedName("claude-api")]: skillTemplates.claudeApi,
  [prefixedName("webapp-testing")]: skillTemplates.webappTesting,
  [prefixedName("frontend-design")]: skillTemplates.frontendDesign,
  [prefixedName("claude-artifacts-builder")]: skillTemplates.claudeArtifactsBuilder,
  [prefixedName("dev-docs-manager")]: skillTemplates.devDocsManager,
  [prefixedName("dev-brand-creator")]: skillTemplates.brandCreator,
  [prefixedName("codi-brand")]: skillTemplates.codiBrand,
  [prefixedName("content-factory")]: skillTemplates.contentFactory,
  [prefixedName("project-quality-guard")]: skillTemplates.projectQualityGuard,
  [prefixedName("audio-transcriber")]: skillTemplates.audioTranscriber,
  [prefixedName("dev-rule-feedback")]: skillTemplates.ruleFeedback,
  [prefixedName("dev-refine-rules")]: skillTemplates.refineRules,
  [prefixedName("humanizer")]: skillTemplates.humanizer,
  [prefixedName("session-log")]: skillTemplates.sessionLog,
  [prefixedName("codebase-explore")]: skillTemplates.codebaseExplore,
  [prefixedName("dev-graph-sync")]: skillTemplates.graphSync,
  [prefixedName("roadmap")]: skillTemplates.roadmap,
  [prefixedName("debugging")]: skillTemplates.debugging,
  [prefixedName("tdd")]: skillTemplates.tdd,
  [prefixedName("brainstorming")]: skillTemplates.brainstorming,
  [prefixedName("worktrees")]: skillTemplates.worktrees,
  [prefixedName("branch-finish")]: skillTemplates.branchFinish,
  [prefixedName("plan-execution")]: skillTemplates.planExecution,
  [prefixedName("dev-step-documenter")]: skillTemplates.stepDocumenter,
  [prefixedName("audit-fix")]: skillTemplates.auditFix,
  [prefixedName("guided-execution")]: skillTemplates.guidedExecution,
  [prefixedName("html-live-inspect")]: skillTemplates.htmlLiveInspect,
  [prefixedName("receiving-code-review")]: skillTemplates.receivingCodeReview,
  [prefixedName("dev-team-charter")]: skillTemplates.teamCharter,
  [prefixedName("dev-using-codi")]: skillTemplates.usingCodi,
  [prefixedName("caveman")]: skillTemplates.caveman,
  [prefixedName("architecture-review")]: skillTemplates.architectureReview,
  [prefixedName("bug-fix-workflow")]: skillTemplates.bugFixWorkflow,
  [prefixedName("diagnose")]: skillTemplates.diagnose,
  [prefixedName("discover")]: skillTemplates.discover,
  [prefixedName("feature-workflow")]: skillTemplates.featureWorkflow,
  [prefixedName("dev-gate-deep-modules")]: skillTemplates.gateDeepModules,
  [prefixedName("dev-gate-plan-coverage")]: skillTemplates.gatePlanCoverage,
  [prefixedName("dev-init-knowledge-base")]: skillTemplates.initKnowledgeBase,
  [prefixedName("migration-workflow")]: skillTemplates.migrationWorkflow,
  [prefixedName("plan-writing")]: skillTemplates.planWriting,
  [prefixedName("project-workflow")]: skillTemplates.projectWorkflow,
  [prefixedName("quality-gates")]: skillTemplates.qualityGates,
  [prefixedName("refactor-workflow")]: skillTemplates.refactorWorkflow,
  [prefixedName("dev-sheets-sync")]: skillTemplates.sheetsSync,
  [prefixedName("subagent-orchestration")]: skillTemplates.subagentOrchestration,
  [prefixedName("dev-team-consolidation-workflow")]: skillTemplates.teamConsolidationWorkflow,
  [prefixedName("verify-evidence")]: skillTemplates.verifyEvidence,
  [prefixedName("zoom-out")]: skillTemplates.zoomOut,
  [prefixedName("dev-brain-ui")]: skillTemplates.brainUi,
};

/** Maps template names to their static asset directories (when available).
 * Values may be `null` when the template has no static assets — consumers
 * already guard against a missing staticDir. */
const STATIC_DIR_MAP: Record<string, string | null> = {
  [prefixedName("claude-api")]: skillTemplates.claudeApiStaticDir,
  [prefixedName("dev-skill-creator")]: skillTemplates.skillCreatorStaticDir,
  [prefixedName("claude-artifacts-builder")]: skillTemplates.claudeArtifactsBuilderStaticDir,
  [prefixedName("webapp-testing")]: skillTemplates.webappTestingStaticDir,
  [prefixedName("dev-brand-creator")]: skillTemplates.brandCreatorStaticDir,
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
  [prefixedName("session-log")]: skillTemplates.sessionLogStaticDir,
  [prefixedName("html-live-inspect")]: skillTemplates.htmlLiveInspectStaticDir,
  [prefixedName("dev-agent-creator")]: skillTemplates.agentCreatorStaticDir,
  [prefixedName("dev-artifact-contributor")]: skillTemplates.artifactContributorStaticDir,
  [prefixedName("audit-fix")]: skillTemplates.auditFixStaticDir,
  [prefixedName("branch-finish")]: skillTemplates.branchFinishStaticDir,
  [prefixedName("codebase-explore")]: skillTemplates.codebaseExploreStaticDir,
  [prefixedName("dev-compare-preset")]: skillTemplates.comparePresetStaticDir,
  [prefixedName("dev-docs-manager")]: skillTemplates.devDocsManagerStaticDir,
  [prefixedName("dev-operations")]: skillTemplates.devOperationsStaticDir,
  [prefixedName("dev-graph-sync")]: skillTemplates.graphSyncStaticDir,
  [prefixedName("guided-execution")]: skillTemplates.guidedExecutionStaticDir,
  [prefixedName("humanizer")]: skillTemplates.humanizerStaticDir,
  [prefixedName("mobile-development")]: skillTemplates.mobileDevelopmentStaticDir,
  [prefixedName("dev-preset-creator")]: skillTemplates.presetCreatorStaticDir,
  [prefixedName("dev-refine-rules")]: skillTemplates.refineRulesStaticDir,
  [prefixedName("roadmap")]: skillTemplates.roadmapStaticDir,
  [prefixedName("dev-rule-creator")]: skillTemplates.ruleCreatorStaticDir,
  [prefixedName("dev-rule-feedback")]: skillTemplates.ruleFeedbackStaticDir,
  [prefixedName("dev-session-recovery")]: skillTemplates.sessionRecoveryStaticDir,
  [prefixedName("dev-step-documenter")]: skillTemplates.stepDocumenterStaticDir,
  [prefixedName("worktrees")]: skillTemplates.worktreesStaticDir,
  [prefixedName("receiving-code-review")]: skillTemplates.receivingCodeReviewStaticDir,
  [prefixedName("dev-team-charter")]: skillTemplates.teamCharterStaticDir,
  [prefixedName("dev-using-codi")]: skillTemplates.usingCodiStaticDir,
  [prefixedName("caveman")]: skillTemplates.cavemanStaticDir,
  [prefixedName("architecture-review")]: skillTemplates.architectureReviewStaticDir,
  [prefixedName("bug-fix-workflow")]: skillTemplates.bugFixWorkflowStaticDir,
  [prefixedName("diagnose")]: skillTemplates.diagnoseStaticDir,
  [prefixedName("discover")]: skillTemplates.discoverStaticDir,
  [prefixedName("feature-workflow")]: skillTemplates.featureWorkflowStaticDir,
  [prefixedName("dev-gate-deep-modules")]: skillTemplates.gateDeepModulesStaticDir,
  [prefixedName("dev-gate-plan-coverage")]: skillTemplates.gatePlanCoverageStaticDir,
  [prefixedName("dev-init-knowledge-base")]: skillTemplates.initKnowledgeBaseStaticDir,
  [prefixedName("migration-workflow")]: skillTemplates.migrationWorkflowStaticDir,
  [prefixedName("plan-writing")]: skillTemplates.planWritingStaticDir,
  [prefixedName("project-workflow")]: skillTemplates.projectWorkflowStaticDir,
  [prefixedName("quality-gates")]: skillTemplates.qualityGatesStaticDir,
  [prefixedName("refactor-workflow")]: skillTemplates.refactorWorkflowStaticDir,
  [prefixedName("dev-sheets-sync")]: skillTemplates.sheetsSyncStaticDir,
  [prefixedName("subagent-orchestration")]: skillTemplates.subagentOrchestrationStaticDir,
  [prefixedName("dev-team-consolidation-workflow")]:
    skillTemplates.teamConsolidationWorkflowStaticDir,
  [prefixedName("verify-evidence")]: skillTemplates.verifyEvidenceStaticDir,
  [prefixedName("zoom-out")]: skillTemplates.zoomOutStaticDir,
  [prefixedName("dev-brain-ui")]: skillTemplates.brainUiStaticDir,
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

import { ok, err } from "../../types/result.js";
import type { Result } from "../../types/result.js";
import { createError } from "../output/errors.js";
import { prefixedName } from "#src/constants.js";
import { createVersionMap } from "../version/artifact-version.js";
import * as agentTemplates from "../../templates/agents/index.js";

const TEMPLATE_MAP: Record<string, string> = {
  [prefixedName("code-reviewer")]: agentTemplates.codeReviewer,
  [prefixedName("test-generator")]: agentTemplates.testGenerator,
  [prefixedName("security-analyzer")]: agentTemplates.securityAnalyzer,
  [prefixedName("docs-lookup")]: agentTemplates.docsLookup,
  [prefixedName("refactorer")]: agentTemplates.refactorer,
  [prefixedName("onboarding-guide")]: agentTemplates.onboardingGuide,
  [prefixedName("performance-auditor")]: agentTemplates.performanceAuditor,
  [prefixedName("api-designer")]: agentTemplates.apiDesigner,
  [prefixedName("codebase-explorer")]: agentTemplates.codebaseExplorer,
  [prefixedName("ai-engineering-expert")]: agentTemplates.aiEngineeringExpert,
  [prefixedName("data-analytics-bi-expert")]: agentTemplates.dataAnalyticsBiExpert,
  [prefixedName("data-engineering-expert")]: agentTemplates.dataEngineeringExpert,
  [prefixedName("data-intensive-architect")]: agentTemplates.dataIntensiveArchitect,
  [prefixedName("data-science-specialist")]: agentTemplates.dataScienceSpecialist,
  [prefixedName("legal-compliance-eu")]: agentTemplates.legalComplianceEu,
  [prefixedName("marketing-seo-specialist")]: agentTemplates.marketingSeoSpecialist,
  [prefixedName("mlops-engineer")]: agentTemplates.mlopsEngineer,
  [prefixedName("nextjs-researcher")]: agentTemplates.nextjsResearcher,
  [prefixedName("openai-agents-specialist")]: agentTemplates.openaiAgentsSpecialist,
  [prefixedName("payload-cms-auditor")]: agentTemplates.payloadCmsAuditor,
  [prefixedName("python-expert")]: agentTemplates.pythonExpert,
  [prefixedName("scalability-expert")]: agentTemplates.scalabilityExpert,
};

export const AVAILABLE_AGENT_TEMPLATES = Object.keys(TEMPLATE_MAP);
const TEMPLATE_VERSIONS = createVersionMap(AVAILABLE_AGENT_TEMPLATES);

export function loadAgentTemplate(templateName: string): Result<string> {
  const content = TEMPLATE_MAP[templateName];
  if (!content) {
    return err([
      createError("E_CONFIG_NOT_FOUND", {
        path: `agent-template:${templateName}`,
      }),
    ]);
  }
  return ok(content);
}

export function getAgentTemplateVersion(templateName: string): number | undefined {
  return TEMPLATE_VERSIONS[templateName];
}

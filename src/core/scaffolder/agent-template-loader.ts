import { ok, err } from "../../types/result.js";
import type { Result } from "../../types/result.js";
import { createError } from "../output/errors.js";
import { prefixedName } from "#src/constants.js";
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
};

export const AVAILABLE_AGENT_TEMPLATES = Object.keys(TEMPLATE_MAP);

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

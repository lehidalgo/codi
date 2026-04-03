import { ok, err } from "../../types/result.js";
import type { Result } from "../../types/result.js";
import { createError } from "../output/errors.js";
import { prefixedName, devArtifactName, resolveArtifactName } from "#src/constants.js";
import { parseVersionFromFrontmatter } from "../version/artifact-version.js";
import * as ruleTemplates from "../../templates/rules/index.js";

const TEMPLATE_MAP: Record<string, string> = {
  [prefixedName("security")]: ruleTemplates.security,
  [prefixedName("code-style")]: ruleTemplates.codeStyle,
  [prefixedName("testing")]: ruleTemplates.testing,
  [prefixedName("architecture")]: ruleTemplates.architecture,
  [prefixedName("git-workflow")]: ruleTemplates.gitWorkflow,
  [prefixedName("error-handling")]: ruleTemplates.errorHandling,
  [prefixedName("performance")]: ruleTemplates.performance,
  [prefixedName("documentation")]: ruleTemplates.documentation,
  [prefixedName("api-design")]: ruleTemplates.apiDesign,
  [prefixedName("typescript")]: ruleTemplates.typescript,
  [prefixedName("react")]: ruleTemplates.react,
  [prefixedName("python")]: ruleTemplates.python,
  [prefixedName("golang")]: ruleTemplates.golang,
  [prefixedName("java")]: ruleTemplates.java,
  [prefixedName("kotlin")]: ruleTemplates.kotlin,
  [prefixedName("rust")]: ruleTemplates.rust,
  [prefixedName("swift")]: ruleTemplates.swift,
  [prefixedName("csharp")]: ruleTemplates.csharp,
  [prefixedName("nextjs")]: ruleTemplates.nextjs,
  [prefixedName("django")]: ruleTemplates.django,
  [prefixedName("spring-boot")]: ruleTemplates.springBoot,
  [prefixedName("production-mindset")]: ruleTemplates.productionMindset,
  [prefixedName("simplicity-first")]: ruleTemplates.simplicityFirst,
  [prefixedName("workflow")]: ruleTemplates.workflow,
  [prefixedName("spanish-orthography")]: ruleTemplates.spanishOrthography,
  [prefixedName("agent-usage")]: ruleTemplates.agentUsage,
  [prefixedName("output-discipline")]: ruleTemplates.outputDiscipline,
  [devArtifactName("improvement")]: ruleTemplates.improvement,
};

export const AVAILABLE_TEMPLATES = Object.keys(TEMPLATE_MAP);

export function loadTemplate(templateName: string): Result<string> {
  const resolved = resolveArtifactName(templateName, AVAILABLE_TEMPLATES);
  if (!resolved) {
    return err([
      createError("E_CONFIG_NOT_FOUND", {
        path: `template:${templateName}`,
      }),
    ]);
  }
  return ok(TEMPLATE_MAP[resolved]!);
}

export function getTemplateVersion(templateName: string): number | undefined {
  const result = loadTemplate(templateName);
  return result.ok ? parseVersionFromFrontmatter(result.data) : undefined;
}

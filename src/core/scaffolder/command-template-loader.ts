import { ok, err } from "../../types/result.js";
import type { Result } from "../../types/result.js";
import { createError } from "../output/errors.js";
import { prefixedName } from "#src/constants.js";
import { parseVersionFromFrontmatter } from "../version/artifact-version.js";
import * as commandTemplates from "../../templates/commands/index.js";

const TEMPLATE_MAP: Record<string, string> = {
  [prefixedName("test-run")]: commandTemplates.testRun,
  [prefixedName("session-handoff")]: commandTemplates.sessionHandoff,
  [prefixedName("check")]: commandTemplates.check,
  [prefixedName("codebase-explore")]: commandTemplates.codebaseExplore,
  [prefixedName("index-graph")]: commandTemplates.indexGraph,
  [prefixedName("update-graph")]: commandTemplates.updateGraph,
  [prefixedName("open-day")]: commandTemplates.openDay,
  [prefixedName("close-day")]: commandTemplates.closeDay,
  [prefixedName("roadmap")]: commandTemplates.roadmap,
};

export const AVAILABLE_COMMAND_TEMPLATES = Object.keys(TEMPLATE_MAP);

export function loadCommandTemplate(templateName: string): Result<string> {
  const content = TEMPLATE_MAP[templateName];
  if (!content) {
    return err([
      createError("E_CONFIG_NOT_FOUND", {
        path: `command-template:${templateName}`,
      }),
    ]);
  }
  return ok(content);
}

export function getCommandTemplateVersion(templateName: string): number | undefined {
  const result = loadCommandTemplate(templateName);
  return result.ok ? parseVersionFromFrontmatter(result.data) : undefined;
}

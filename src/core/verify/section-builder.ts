import type { VerificationData } from "./token.js";
import {
  PROJECT_NAME_DISPLAY,
  PROJECT_CLI,
  PROJECT_DIR,
  prefixedName,
} from "#src/constants.js";

export function buildVerificationSection(data: VerificationData): string {
  const lines = [
    `## ${PROJECT_NAME_DISPLAY} Verification`,
    "",
    `This project uses ${PROJECT_NAME_DISPLAY} for unified AI agent configuration.`,
    `- Verification token: \`${data.token}\``,
  ];

  if (data.ruleNames.length > 0) {
    lines.push(`- Rules: ${data.ruleNames.join(", ")}`);
  }

  if (data.skillNames.length > 0) {
    lines.push(`- Skills: ${data.skillNames.join(", ")}`);
  }

  if (data.agentNames.length > 0) {
    lines.push(`- Agents: ${data.agentNames.join(", ")}`);
  }

  if (data.brandNames.length > 0) {
    lines.push(`- Brands: ${data.brandNames.join(", ")}`);
  }

  lines.push(`- Generated: ${data.timestamp}`);
  lines.push("");
  lines.push(
    `When asked "verify ${PROJECT_CLI}" or "${PROJECT_CLI} verify", respond with the verification token and confirm the rules, skills, and agents listed above.`,
  );
  lines.push("");
  lines.push("### Artifact Improvement");
  lines.push("");
  lines.push(
    "When you observe recurring patterns not covered by current rules or skills:",
  );
  lines.push(
    "1. Propose the improvement with evidence (2+ occurrences in the codebase)",
  );
  lines.push(
    `2. If approved, write to \`${PROJECT_DIR}/rules/\` or \`${PROJECT_DIR}/skills/\``,
  );
  lines.push(`3. Run \`${PROJECT_CLI} generate\` to propagate changes`);
  lines.push(
    `4. Use \`/${prefixedName("compare-preset")}\` to review local improvements vs upstream ${PROJECT_NAME_DISPLAY}`,
  );

  return lines.join("\n");
}

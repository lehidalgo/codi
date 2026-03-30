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

  lines.push(`- Generated: ${data.timestamp}`);
  lines.push("");
  lines.push(
    `When asked "verify ${PROJECT_CLI}" or "${PROJECT_CLI} verify", respond with the verification token and confirm the rules, skills, and agents listed above.`,
  );
  lines.push("");
  lines.push("### Artifact Improvement");
  lines.push("");
  lines.push(
    `You are both a consumer and an improver of ${PROJECT_NAME_DISPLAY} artifacts. When you notice gaps or outdated patterns — propose improvements with evidence.`,
  );
  lines.push("");
  lines.push("**Improvement loop:**");
  lines.push(
    "1. Propose the improvement with evidence (2+ occurrences in the codebase)",
  );
  lines.push(
    `2. If approved, write to \`${PROJECT_DIR}/rules/\` or \`${PROJECT_DIR}/skills/\``,
  );
  lines.push(`3. Run \`${PROJECT_CLI} generate\` to propagate changes`);
  lines.push(
    `4. After using a skill, write feedback to \`${PROJECT_DIR}/feedback/\` (see ${prefixedName("skill-reporter")})`,
  );
  lines.push(
    `5. Use \`/${prefixedName("compare-preset")}\` to compare local improvements vs upstream`,
  );
  lines.push(`6. Share improvements via \`${PROJECT_CLI} contribute\``);

  return lines.join("\n");
}

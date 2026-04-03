import fs from "node:fs/promises";
import path from "node:path";
import { collectStats } from "./stats-collector.js";
import type { ProjectStats } from "./stats-collector.js";
import { PROJECT_DIR } from "#src/constants.js";

export interface DocSyncIssue {
  file: string;
  description: string;
  expected: string;
  actual: string;
  fixable: boolean;
  action?: string;
}

interface CountCheck {
  file: string;
  pattern: RegExp;
  getStat: (s: ProjectStats) => number;
  label: string;
}

const COUNT_CHECKS: CountCheck[] = [
  // STATUS.md table rows
  {
    file: "STATUS.md",
    pattern: /\|\s*Rule templates\s*\|\s*(\d+)\s*\|/,
    getStat: (s) => s.rules.count,
    label: "Rule templates",
  },
  {
    file: "STATUS.md",
    pattern: /\|\s*Skill templates\s*\|\s*(\d+)\s*\|/,
    getStat: (s) => s.skills.count,
    label: "Skill templates",
  },
  {
    file: "STATUS.md",
    pattern: /\|\s*Agent templates\s*\|\s*(\d+)\s*\|/,
    getStat: (s) => s.agents.count,
    label: "Agent templates",
  },
  {
    file: "STATUS.md",
    pattern: /\|\s*Command templates\s*\|\s*(\d+)\s*\|/,
    getStat: (s) => s.commands.count,
    label: "Command templates",
  },
  {
    file: "STATUS.md",
    pattern: /\|\s*Error codes\s*\|\s*(\d+)\s*\|/,
    getStat: (s) => s.errorCodes,
    label: "Error codes",
  },
  {
    file: "STATUS.md",
    pattern: /\|\s*Flags\s*\|\s*(\d+)\s*\|/,
    getStat: (s) => s.flags.count,
    label: "Flags",
  },
  {
    file: "STATUS.md",
    pattern: /\|\s*Adapters\s*\|\s*(\d+)\s*\|/,
    getStat: (s) => s.adapters,
    label: "Adapters",
  },
  {
    file: "STATUS.md",
    pattern: /\|\s*CLI commands\s*\|\s*(\d+)\s*\|/,
    getStat: (s) => s.cliCommands,
    label: "CLI commands",
  },
  // CONTRIBUTING.md comment counts
  {
    file: "CONTRIBUTING.md",
    pattern: /#\s*(\d+)\s*rule templates/,
    getStat: (s) => s.rules.count,
    label: "rule templates",
  },
  {
    file: "CONTRIBUTING.md",
    pattern: /#\s*(\d+)\s*skill templates/,
    getStat: (s) => s.skills.count,
    label: "skill templates",
  },
  {
    file: "CONTRIBUTING.md",
    pattern: /#\s*(\d+)\s*agent templates/,
    getStat: (s) => s.agents.count,
    label: "agent templates",
  },
  {
    file: "CONTRIBUTING.md",
    pattern: /#\s*(\d+)\s*command templates/,
    getStat: (s) => s.commands.count,
    label: "command templates",
  },
];

const INLINE_COUNT_PATTERN =
  /(\d+)\s*rule templates,\s*(\d+)\s*skill templates,\s*(\d+)\s*agent templates,\s*(\d+)\s*command templates/g;

async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

function checkCountChecks(content: string, file: string, stats: ProjectStats): DocSyncIssue[] {
  const issues: DocSyncIssue[] = [];
  for (const check of COUNT_CHECKS) {
    if (check.file !== file) continue;
    const match = content.match(check.pattern);
    if (match && Number(match[1]) !== check.getStat(stats)) {
      issues.push({
        file,
        description: `${file} says "${check.label}: ${match[1]}" but ${check.getStat(stats)} exist`,
        expected: String(check.getStat(stats)),
        actual: match[1] ?? "",
        fixable: true,
      });
    }
  }
  return issues;
}

function checkInlineCounts(content: string, file: string, stats: ProjectStats): DocSyncIssue[] {
  const issues: DocSyncIssue[] = [];
  const match = content.match(INLINE_COUNT_PATTERN);
  if (match) {
    const singleMatch = INLINE_COUNT_PATTERN.exec(content);
    INLINE_COUNT_PATTERN.lastIndex = 0;
    if (singleMatch) {
      const [, r, s, a, c] = singleMatch.map(Number);
      if (
        r !== stats.rules.count ||
        s !== stats.skills.count ||
        a !== stats.agents.count ||
        c !== stats.commands.count
      ) {
        issues.push({
          file,
          description: `${file} says "${r} rules, ${s} skills, ${a} agents, ${c} commands" but actual is ${stats.rules.count}, ${stats.skills.count}, ${stats.agents.count}, ${stats.commands.count}`,
          expected: `${stats.rules.count}, ${stats.skills.count}, ${stats.agents.count}, ${stats.commands.count}`,
          actual: `${r}, ${s}, ${a}, ${c}`,
          fixable: true,
        });
      }
    }
  }
  return issues;
}

function checkMissingTemplateEntries(
  content: string,
  file: string,
  names: string[],
  artifactType: string,
  sourceDir: string,
): DocSyncIssue[] {
  const issues: DocSyncIssue[] = [];
  const missing = names.filter((n) => !content.includes(`\`${n}\``));
  for (const name of missing) {
    issues.push({
      file,
      description: `${file} missing ${artifactType} template '${name}'`,
      expected: `Entry for '${name}' in table`,
      actual: "Not listed",
      fixable: false,
      action: [
        `Read ${sourceDir}/${name}.ts`,
        `Extract the key topics from the template content`,
        `Write a detailed description (1-2 sentences listing main patterns)`,
        `Add row: | \`${name}\` | <detailed description> | \`${sourceDir}/${name}.ts\` |`,
      ].join("\n          "),
    });
  }
  return issues;
}

function checkExpectedCounts(content: string, file: string, stats: ProjectStats): DocSyncIssue[] {
  const pattern =
    /Expected:\s*(\d+)\s*rules,\s*(\d+)\s*skills,\s*(\d+)\s*agents,\s*(\d+)\s*commands/;
  const match = content.match(pattern);
  if (!match) return [];
  const [, r, s, a, c] = match.map(Number);
  if (
    r !== stats.rules.count ||
    s !== stats.skills.count ||
    a !== stats.agents.count ||
    c !== stats.commands.count
  ) {
    return [
      {
        file,
        description: `${file} says "Expected: ${r} rules, ${s} skills, ${a} agents, ${c} commands" but actual is ${stats.rules.count}, ${stats.skills.count}, ${stats.agents.count}, ${stats.commands.count}`,
        expected: `${stats.rules.count}, ${stats.skills.count}, ${stats.agents.count}, ${stats.commands.count}`,
        actual: `${r}, ${s}, ${a}, ${c}`,
        fixable: false,
        action: `Update the Expected counts in this source file manually`,
      },
    ];
  }
  return [];
}

export async function checkDocSync(projectRoot: string): Promise<DocSyncIssue[]> {
  const stats = collectStats();
  const issues: DocSyncIssue[] = [];

  const filesToCheck = [
    "STATUS.md",
    "CONTRIBUTING.md",
    "docs/guides/writing-rules.md",
    "src/templates/skills/dev-e2e-testing.ts",
    `${PROJECT_DIR}/skills/dev-e2e-testing.md`,
  ];

  for (const file of filesToCheck) {
    const content = await readFileIfExists(path.join(projectRoot, file));
    if (!content) continue;

    issues.push(...checkCountChecks(content, file, stats));
    issues.push(...checkInlineCounts(content, file, stats));

    if (file === "docs/guides/writing-rules.md") {
      issues.push(
        ...checkMissingTemplateEntries(
          content,
          file,
          stats.rules.names,
          "rule",
          "src/templates/rules",
        ),
      );
      issues.push(
        ...checkMissingTemplateEntries(
          content,
          file,
          stats.skills.names,
          "skill",
          "src/templates/skills",
        ),
      );
      issues.push(
        ...checkMissingTemplateEntries(
          content,
          file,
          stats.agents.names,
          "agent",
          "src/templates/agents",
        ),
      );
      issues.push(
        ...checkMissingTemplateEntries(
          content,
          file,
          stats.commands.names,
          "command",
          "src/templates/commands",
        ),
      );
    }

    if (file.includes("e2e-testing")) {
      issues.push(...checkExpectedCounts(content, file, stats));
    }
  }

  return issues;
}

export async function fixDocSync(projectRoot: string): Promise<string[]> {
  const stats = collectStats();
  const fixed: string[] = [];

  const filesToFix = ["STATUS.md", "CONTRIBUTING.md"];

  for (const file of filesToFix) {
    const fullPath = path.join(projectRoot, file);
    const content = await readFileIfExists(fullPath);
    if (!content) continue;

    let updated = content;

    for (const check of COUNT_CHECKS) {
      if (check.file !== file) continue;
      const actual = check.getStat(stats);
      updated = updated.replace(check.pattern, (match, num) => {
        return match.replace(num, String(actual));
      });
    }

    updated = updated.replace(
      INLINE_COUNT_PATTERN,
      () =>
        `${stats.rules.count} rule templates, ${stats.skills.count} skill templates, ${stats.agents.count} agent templates, ${stats.commands.count} command templates`,
    );

    if (updated !== content) {
      await fs.writeFile(fullPath, updated, "utf-8");
      fixed.push(file);
    }
  }

  return fixed;
}

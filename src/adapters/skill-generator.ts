import { readdir, readFile, access } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import type { NormalizedSkill } from "../types/config.js";
import type { GeneratedFile } from "../types/agent.js";
import { hashContent } from "../utils/hash.js";
import { addGeneratedFooter } from "./generated-header.js";
import {
  SKILL_OUTPUT_FILENAME,
  MANIFEST_FILENAME,
  PROJECT_DIR,
} from "../constants.js";

// Directories to skip when propagating skills to agent dirs
export const SKIP_DIRS = new Set(["evals", "versions"]);
export const SKIP_FILES = new Set([".gitkeep", "evals.json"]);

// Binary extensions to skip — these corrupt when read as UTF-8
const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".webp",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
]);

/** Collapse multiline descriptions to a single line for frontmatter. */
function flattenDescription(desc: string): string {
  return desc.replace(/\n\s*/g, " ").trim();
}

export function buildSkillMd(
  skill: NormalizedSkill,
  descriptionPrefix = "",
): string {
  const frontmatter: string[] = ["---"];
  frontmatter.push(`name: ${skill.name}`);
  frontmatter.push(
    `description: ${descriptionPrefix}${flattenDescription(skill.description)}`,
  );
  if (skill.disableModelInvocation) {
    frontmatter.push("disable-model-invocation: true");
  }
  if (skill.userInvocable === false) {
    frontmatter.push("user-invocable: false");
  }
  if (skill.argumentHint) {
    frontmatter.push(`argument-hint: "${skill.argumentHint}"`);
  }
  if (skill.allowedTools && skill.allowedTools.length > 0) {
    frontmatter.push(`allowed-tools: ${skill.allowedTools.join(", ")}`);
  }
  if (skill.model) {
    frontmatter.push(`model: ${skill.model}`);
  }
  if (skill.effort) {
    frontmatter.push(`effort: ${skill.effort}`);
  }
  if (skill.context) {
    frontmatter.push(`context: ${skill.context}`);
  }
  if (skill.agent) {
    frontmatter.push(`agent: ${skill.agent}`);
  }
  if (skill.paths && skill.paths.length > 0) {
    frontmatter.push(`paths: ${skill.paths.join(", ")}`);
  }
  if (skill.shell) {
    frontmatter.push(`shell: ${skill.shell}`);
  }
  if (skill.license) {
    frontmatter.push(`license: ${skill.license}`);
  }
  // Note: managed_by, compatibility, and metadata-* are NOT emitted
  // They are internal fields that consume agent context budget
  frontmatter.push("---");

  return `${frontmatter.join("\n")}\n\n${skill.content}`;
}

/** Build a metadata-only SKILL.md (Tier 1 — name + description only). */
export function buildSkillMetadataOnly(
  skill: NormalizedSkill,
  descriptionPrefix = "",
): string {
  const lines = [
    "---",
    `name: ${skill.name}`,
    `description: ${descriptionPrefix}${flattenDescription(skill.description)}`,
    "---",
    "",
    `Full skill content available at: ${PROJECT_DIR}/skills/${skill.name}/SKILL.md`,
  ];
  return lines.join("\n");
}

export type ProgressiveLoadingMode = "off" | "metadata" | "full";

/**
 * Generate skill files for an agent directory.
 *
 * For each skill:
 * 1. Generates SKILL.md from template content
 * 2. Creates the full skill skeleton (scripts/, references/, assets/ with .gitkeep)
 * 3. Scans skill directory for user-added supporting files
 * 4. Copies supporting files (scripts, references, assets, sibling .md)
 * 5. Excludes evals/ (build-time only concern)
 */
export async function generateSkillFiles(
  skills: NormalizedSkill[],
  basePath: string,
  progressiveLoading: ProgressiveLoadingMode = "off",
  projectRoot?: string,
  descriptionPrefix = "",
): Promise<GeneratedFile[]> {
  const files: GeneratedFile[] = [];
  for (const skill of skills) {
    const dirName = skill.name.toLowerCase().replace(/\s+/g, "-");
    const skillBasePath = `${basePath}/${dirName}`;

    // 1. Generate SKILL.md
    const raw =
      progressiveLoading === "off"
        ? buildSkillMd(skill, descriptionPrefix)
        : buildSkillMetadataOnly(skill, descriptionPrefix);
    const content = addGeneratedFooter(raw);
    files.push({
      path: `${skillBasePath}/${SKILL_OUTPUT_FILENAME}`,
      content,
      sources: [MANIFEST_FILENAME],
      hash: hashContent(content),
    });

    // 2. Create skeleton .gitkeep files
    for (const subdir of ["scripts", "references", "assets", "agents"]) {
      files.push({
        path: `${skillBasePath}/${subdir}/.gitkeep`,
        content: "",
        sources: [MANIFEST_FILENAME],
        hash: hashContent(""),
      });
    }

    // 3. Scan skill directory for user-added supporting files
    if (projectRoot) {
      const projectSkillDir = join(projectRoot, PROJECT_DIR, "skills", dirName);
      const supporting = await collectSupportingFiles(projectSkillDir);
      for (const sf of supporting) {
        files.push({
          path: `${skillBasePath}/${sf.relativePath}`,
          content: sf.content,
          sources: [MANIFEST_FILENAME],
          hash: hashContent(sf.content),
        });
      }
    }
  }
  return files;
}

interface SupportingFile {
  relativePath: string;
  content: string;
}

/** Scan a skill directory for supporting files to propagate. */
async function collectSupportingFiles(
  skillDir: string,
): Promise<SupportingFile[]> {
  const results: SupportingFile[] = [];
  try {
    await access(skillDir);
  } catch {
    return results;
  }

  await scanDir(skillDir, skillDir, results);
  return results;
}

async function scanDir(
  rootDir: string,
  currentDir: string,
  results: SupportingFile[],
): Promise<void> {
  let entries;
  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);
    const relativePath = relative(rootDir, fullPath);
    const topDir = relativePath.split("/")[0] ?? "";

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await scanDir(rootDir, fullPath, results);
      continue;
    }

    // Skip SKILL.md (generated from template), .gitkeep, evals, binary files
    if (entry.name === SKILL_OUTPUT_FILENAME) continue;
    if (SKIP_FILES.has(entry.name)) continue;
    if (topDir === "evals") continue;
    if (BINARY_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;

    try {
      const content = await readFile(fullPath, "utf-8");
      results.push({ relativePath, content });
    } catch {
      // Skip unreadable files
    }
  }
}

/** Build an inline skill catalog for agents without separate file discovery. */
export function buildSkillCatalog(skills: NormalizedSkill[]): string | null {
  if (skills.length === 0) return null;
  const lines = [
    "## Available Skills",
    "",
    "| Skill | Description |",
    "|-------|-------------|",
  ];
  for (const skill of skills) {
    const desc = skill.description.split("\n")[0]?.trim() ?? "";
    lines.push(`| ${skill.name} | ${desc} |`);
  }
  lines.push("");
  lines.push(`Full skill content: \`${PROJECT_DIR}/skills/<name>/SKILL.md\``);
  return lines.join("\n");
}

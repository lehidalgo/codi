import { readdir, readFile, access } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { stringify as stringifyYaml, parse as yamlParse } from "yaml";
import type { NormalizedSkill } from "../types/config.js";
import type { GeneratedFile } from "../types/agent.js";
import { hashContent } from "../utils/hash.js";
import { sanitizeNameForPath } from "../utils/path-guard.js";
import { Logger } from "../core/output/logger.js";
import { fmStr } from "../utils/yaml-serialize.js";
import { addGeneratedFooter } from "./generated-header.js";
import {
  SKILL_OUTPUT_FILENAME,
  MANIFEST_FILENAME,
  PROJECT_DIR,
  SUPPORTED_PLATFORMS,
} from "../constants.js";

export type PlatformId = (typeof SUPPORTED_PLATFORMS)[number];

/**
 * Frontmatter fields each platform supports in SKILL.md files.
 * Claude Code is the canonical (richest) format; others are subsets.
 */
const PLATFORM_SKILL_FIELDS: Record<PlatformId, Set<string>> = {
  "claude-code": new Set([
    "name",
    "description",
    "user-invocable",
    "disable-model-invocation",
    "argument-hint",
    "allowed-tools",
    "model",
    "effort",
    "context",
    "agent",
    "paths",
    "shell",
    "license",
    "metadata",
    "hooks",
  ]),
  cursor: new Set([
    "name",
    "description",
    "user-invocable",
    "disable-model-invocation",
    "allowed-tools",
    "model",
    "license",
    "metadata",
  ]),
  codex: new Set(["name", "description", "license", "allowed-tools", "metadata"]),
  windsurf: new Set([
    "name",
    "description",
    "disable-model-invocation",
    "allowed-tools",
    "license",
    "metadata",
  ]),
  cline: new Set([
    "name",
    "description",
    "disable-model-invocation",
    "allowed-tools",
    "license",
    "metadata",
  ]),
  copilot: new Set([
    "name",
    "description",
    "allowed-tools",
    "model",
    "argument-hint",
    "license",
    "metadata",
  ]),
};

// Directories to skip when propagating skills to agent dirs
export const SKIP_DIRS = new Set(["evals", "versions", "__pycache__"]);
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
  return desc
    .replace(/\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Resolve [[/path]] markers and the Claude-Code-specific ${CLAUDE_SKILL_DIR} env var.
 *
 * Claude Code: strip [[]] markers — ${CLAUDE_SKILL_DIR} is expanded by the agent at runtime.
 * All other platforms: keep [[]] markers so the skill-resource-check hook can validate them;
 * strip ${CLAUDE_SKILL_DIR} prefix so paths stay relative to the skill directory.
 * Inner whitespace is normalized in both cases: [[ /path ]] → [[/path]] or /path.
 */
function warnStrippedFields(skill: NormalizedSkill, platformId: PlatformId): void {
  const allowed = PLATFORM_SKILL_FIELDS[platformId];
  const lossy = (
    [
      skill.model && "model",
      skill.effort && "effort",
      skill.context && "context",
      skill.agent && "agent",
      skill.paths?.length && "paths",
      skill.shell && "shell",
      skill.hooks !== undefined && "hooks",
      skill.argumentHint && "argument-hint",
      skill.disableModelInvocation && "disable-model-invocation",
      skill.allowedTools?.length && "allowed-tools",
      skill.license && "license",
      skill.metadata && Object.keys(skill.metadata).length > 0 && "metadata",
    ] as (string | false | undefined)[]
  ).filter((f): f is string => typeof f === "string" && !allowed.has(f));

  if (lossy.length > 0) {
    Logger.getInstance().warn(
      `Skill "${skill.name}" (${platformId}): stripping unsupported fields: ${lossy.join(", ")}`,
    );
  }
}

function resolveSkillRefsForPlatform(content: string, platformId: PlatformId): string {
  if (platformId === "claude-code") {
    return content.replace(/\[\[\s*(\/[^\]]+?)\s*\]\]/g, "$1");
  }
  return content
    .replace(/\$\{CLAUDE_SKILL_DIR\}/g, "")
    .replace(/\[\[\s*(\/[^\]]+?)\s*\]\]/g, "[[$1]]");
}

export function buildSkillMd(
  skill: NormalizedSkill,
  descriptionPrefix = "",
  platformId: PlatformId = "claude-code",
): string {
  const allowed = PLATFORM_SKILL_FIELDS[platformId];
  warnStrippedFields(skill, platformId);
  const frontmatter: string[] = ["---"];

  // name and description are required on all platforms
  frontmatter.push(`name: ${fmStr(skill.name)}`);
  frontmatter.push(
    `description: ${fmStr(descriptionPrefix + flattenDescription(skill.description))}`,
  );

  if (allowed.has("disable-model-invocation") && skill.disableModelInvocation) {
    frontmatter.push("disable-model-invocation: true");
  }
  if (allowed.has("user-invocable")) {
    const invocable = skill.userInvocable !== false;
    frontmatter.push(`user-invocable: ${invocable}`);
  }
  if (allowed.has("argument-hint") && skill.argumentHint) {
    frontmatter.push(`argument-hint: ${fmStr(skill.argumentHint)}`);
  }
  if (allowed.has("allowed-tools") && skill.allowedTools && skill.allowedTools.length > 0) {
    frontmatter.push(`allowed-tools: ${skill.allowedTools.join(", ")}`);
  }
  if (allowed.has("model") && skill.model) {
    frontmatter.push(`model: ${skill.model}`);
  }
  if (allowed.has("effort") && skill.effort) {
    frontmatter.push(`effort: ${skill.effort}`);
  }
  if (allowed.has("context") && skill.context) {
    frontmatter.push(`context: ${skill.context}`);
  }
  if (allowed.has("agent") && skill.agent) {
    frontmatter.push(`agent: ${skill.agent}`);
  }
  if (allowed.has("paths") && skill.paths && skill.paths.length > 0) {
    frontmatter.push(`paths: ${skill.paths.join(", ")}`);
  }
  if (allowed.has("shell") && skill.shell) {
    frontmatter.push(`shell: ${skill.shell}`);
  }
  if (allowed.has("license") && skill.license) {
    frontmatter.push(`license: ${fmStr(skill.license)}`);
  }
  if (allowed.has("metadata") && skill.metadata && Object.keys(skill.metadata).length > 0) {
    const metadataLines = Object.entries(skill.metadata)
      .map(([k, v]) => `  ${k}: ${fmStr(v)}`)
      .join("\n");
    frontmatter.push(`metadata:\n${metadataLines}`);
  }
  if (allowed.has("hooks") && skill.hooks !== undefined) {
    const hooksYaml = stringifyYaml({ hooks: skill.hooks }).trimEnd();
    for (const line of hooksYaml.split("\n")) {
      frontmatter.push(line);
    }
  }
  // Note: managed_by, compatibility, category, version are never emitted —
  // they are Codi-internal fields that consume agent context budget
  frontmatter.push("---");

  // Validate generated frontmatter is valid YAML before writing to disk.
  // Guards against regressions in fmStr() or edge cases in hook/metadata serialization.
  const fmInner = frontmatter.slice(1, -1).join("\n");
  try {
    yamlParse(fmInner);
  } catch (err) {
    throw new Error(
      `Invalid YAML frontmatter for skill "${skill.name}" (platform: ${platformId}): ${String(err)}`,
    );
  }

  const resolvedContent = resolveSkillRefsForPlatform(skill.content, platformId);
  return `${frontmatter.join("\n")}\n\n${resolvedContent}`;
}

/**
 * Generate skill files for an agent directory.
 *
 * For each skill:
 * 1. Generates SKILL.md with full content (agents read their own directories)
 * 2. Creates the full skill skeleton (scripts/, references/, assets/ with .gitkeep)
 * 3. Scans skill directory for user-added supporting files
 * 4. Copies supporting files (scripts, references, assets, sibling .md)
 * 5. Excludes evals/ (build-time only concern)
 */
export async function generateSkillFiles(
  skills: NormalizedSkill[],
  basePath: string,
  projectRoot?: string,
  descriptionPrefix = "",
  platformId: PlatformId = "claude-code",
): Promise<GeneratedFile[]> {
  const files: GeneratedFile[] = [];
  for (const skill of skills) {
    const dirName = sanitizeNameForPath(skill.name);
    const skillBasePath = `${basePath}/${dirName}`;

    // 1. Generate SKILL.md — filtered to platform-supported fields
    const raw = buildSkillMd(skill, descriptionPrefix, platformId);
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

    // 2b. Codex sidecar: agents/openai.yaml
    // Maps CC's disable-model-invocation to Codex's policy.allow_implicit_invocation (inverted).
    // Always emitted for Codex skills so the policy is explicit regardless of Codex defaults.
    if (platformId === "codex") {
      const allowImplicit = skill.disableModelInvocation !== true;
      const sidecarContent = `policy:\n  allow_implicit_invocation: ${allowImplicit}\n`;
      files.push({
        path: `${skillBasePath}/agents/openai.yaml`,
        content: sidecarContent,
        sources: [MANIFEST_FILENAME],
        hash: hashContent(sidecarContent),
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
          ...(sf.binarySrc ? { binarySrc: sf.binarySrc } : {}),
        });
      }
    }
  }
  return files;
}

interface SupportingFile {
  relativePath: string;
  content: string;
  /** Absolute source path for binary files (copied as-is, not read as text). */
  binarySrc?: string;
}

/** Scan a skill directory for supporting files to propagate. */
async function collectSupportingFiles(skillDir: string): Promise<SupportingFile[]> {
  const results: SupportingFile[] = [];
  try {
    await access(skillDir);
  } catch (cause) {
    Logger.getInstance().debug("Skill directory not accessible", cause);
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

    // Skip SKILL.md (generated from template), .gitkeep, evals
    if (entry.name === SKILL_OUTPUT_FILENAME) continue;
    if (SKIP_FILES.has(entry.name)) continue;
    if (topDir === "evals") continue;

    // Binary files: record source path for copy (not text-readable)
    if (BINARY_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      results.push({ relativePath, content: "", binarySrc: fullPath });
      continue;
    }

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
  const lines = ["## Available Skills", "", "| Skill | Description |", "|-------|-------------|"];
  for (const skill of skills) {
    const desc = skill.description.split("\n")[0]?.trim() ?? "";
    lines.push(`| ${skill.name} | ${desc} |`);
  }
  lines.push("");
  lines.push(`Full skill content: \`${PROJECT_DIR}/skills/<name>/SKILL.md\``);
  return lines.join("\n");
}

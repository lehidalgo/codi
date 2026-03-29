import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { ok, err } from "../../types/result.js";
import type { Result } from "../../types/result.js";
import type { ProjectError } from "../output/types.js";
import { PresetManifestSchema } from "../../schemas/preset.js";
import type { PresetManifest } from "../../schemas/preset.js";
import {
  PRESET_MANIFEST_FILENAME,
  SKILL_OUTPUT_FILENAME,
} from "../../constants.js";
import { createError } from "../output/errors.js";
import { parseFrontmatter } from "../../utils/frontmatter.js";

export interface PresetValidationResult {
  manifest: PresetManifest;
  warnings: ProjectError[];
  artifactCounts: {
    rules: number;
    skills: number;
    agents: number;
    commands: number;
    brands: number;
  };
}

/**
 * Validates a preset directory structure and contents.
 *
 * Checks:
 * 1. preset.yaml exists and is valid
 * 2. All .md files in artifact dirs have valid frontmatter
 * 3. No circular extends (shallow check - single level)
 * 4. Version format is semver-like
 */
export async function validatePreset(
  presetDir: string,
): Promise<Result<PresetValidationResult>> {
  const errors: ProjectError[] = [];
  const warnings: ProjectError[] = [];

  // 1. Check preset.yaml exists
  const manifestPath = path.join(presetDir, PRESET_MANIFEST_FILENAME);
  let manifestRaw: string;
  try {
    manifestRaw = await fs.readFile(manifestPath, "utf8");
  } catch {
    return err([
      createError("E_PRESET_INVALID", {
        name: path.basename(presetDir),
        reason: `Missing ${PRESET_MANIFEST_FILENAME}`,
      }),
    ]);
  }

  // 2. Parse and validate manifest
  let parsed: Record<string, unknown>;
  try {
    parsed = parseYaml(manifestRaw) as Record<string, unknown>;
  } catch (cause) {
    return err([
      createError(
        "E_PRESET_INVALID",
        {
          name: path.basename(presetDir),
          reason: "Invalid YAML in preset.yaml",
        },
        cause instanceof Error ? cause : undefined,
      ),
    ]);
  }

  const validated = PresetManifestSchema.safeParse(parsed);
  if (!validated.success) {
    const issues = validated.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return err([
      createError("E_PRESET_INVALID", {
        name: path.basename(presetDir),
        reason: `Schema validation failed: ${issues}`,
      }),
    ]);
  }

  const manifest = validated.data;

  // 3. Validate version format (loose semver)
  if (manifest.version && !isValidVersion(manifest.version)) {
    warnings.push(
      createError("W_PRESET_SIZE", {
        message: `Preset "${manifest.name}" version "${manifest.version}" does not follow semver format`,
      }),
    );
  }

  // 4. Count and validate artifacts in each directory
  const artifactDirs = [
    "rules",
    "skills",
    "agents",
    "commands",
    "brands",
  ] as const;
  const artifactCounts = {
    rules: 0,
    skills: 0,
    agents: 0,
    commands: 0,
    brands: 0,
  };

  for (const dir of artifactDirs) {
    const dirPath = path.join(presetDir, dir);
    const count = await validateArtifactDir(
      dirPath,
      dir,
      manifest.name,
      errors,
      warnings,
    );
    artifactCounts[dir] = count;
  }

  if (errors.length > 0) {
    return err(errors);
  }

  return ok({ manifest, warnings, artifactCounts });
}

async function validateArtifactDir(
  dirPath: string,
  dirName: string,
  presetName: string,
  errors: ProjectError[],
  _warnings: ProjectError[],
): Promise<number> {
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return 0; // Directory doesn't exist — that's fine
  }

  let count = 0;

  // Validate flat .md files (rules, agents, commands)
  for (const entry of entries) {
    if (entry.isDirectory() || !entry.name.endsWith(".md")) continue;
    const filePath = path.join(dirPath, entry.name);
    try {
      const raw = await fs.readFile(filePath, "utf8");
      parseFrontmatter<Record<string, unknown>>(raw);
      count++;
    } catch {
      errors.push(
        createError("E_PRESET_INVALID", {
          name: presetName,
          reason: `Invalid frontmatter in ${dirName}/${entry.name}`,
        }),
      );
    }
  }

  // Validate directory-based artifacts (skills with SKILL.md, brands with BRAND.md)
  const dirBasedFiles: Record<string, string> = {
    skills: SKILL_OUTPUT_FILENAME,
    brands: "BRAND.md",
  };
  const indexFile = dirBasedFiles[dirName];
  if (indexFile) {
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const mdPath = path.join(dirPath, entry.name, indexFile);
      try {
        const raw = await fs.readFile(mdPath, "utf8");
        parseFrontmatter<Record<string, unknown>>(raw);
        count++;
      } catch {
        errors.push(
          createError("E_PRESET_INVALID", {
            name: presetName,
            reason: `Invalid or missing ${indexFile} in ${dirName}/${entry.name}/`,
          }),
        );
      }
    }
  }

  return count;
}

function isValidVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+/.test(version);
}

/**
 * Checks for circular extends chains in preset configurations.
 */
export async function detectCircularExtends(
  presetName: string,
  presetsDir: string,
  visited: Set<string> = new Set(),
): Promise<Result<void>> {
  if (visited.has(presetName)) {
    const chain = [...visited, presetName].join(" → ");
    return err([createError("E_PRESET_CIRCULAR_EXTENDS", { chain })]);
  }

  visited.add(presetName);

  const manifestPath = path.join(
    presetsDir,
    presetName,
    PRESET_MANIFEST_FILENAME,
  );
  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    const parsed = parseYaml(raw) as Record<string, unknown>;
    const parentName = parsed["extends"] as string | undefined;

    if (parentName) {
      return detectCircularExtends(parentName, presetsDir, visited);
    }
  } catch {
    // Can't read manifest — not a circular extends issue
  }

  return ok(undefined);
}

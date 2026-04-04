import fs from "node:fs/promises";
import path from "node:path";
import { fileExists } from "#src/utils/fs.js";

export interface HookSetup {
  runner: "husky" | "pre-commit" | "lefthook" | "none";
  version?: string;
  configPath?: string;
}

interface DetectionRule {
  runner: HookSetup["runner"];
  check: (
    projectRoot: string,
  ) => Promise<{ found: boolean; configPath?: string; version?: string }>;
}

async function detectHusky(
  projectRoot: string,
): Promise<{ found: boolean; configPath?: string; version?: string }> {
  const huskyDir = path.join(projectRoot, ".husky");
  if (await fileExists(huskyDir)) {
    let version: string | undefined;
    try {
      const pkgPath = path.join(projectRoot, "node_modules", "husky", "package.json");
      const raw = await fs.readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(raw) as { version?: string };
      version = pkg.version;
    } catch {
      // version unknown
    }
    return { found: true, configPath: huskyDir, version };
  }
  return { found: false };
}

async function detectPreCommit(
  projectRoot: string,
): Promise<{ found: boolean; configPath?: string }> {
  const configPath = path.join(projectRoot, ".pre-commit-config.yaml");
  if (await fileExists(configPath)) {
    return { found: true, configPath };
  }
  return { found: false };
}

async function detectLefthook(
  projectRoot: string,
): Promise<{ found: boolean; configPath?: string }> {
  const configPath = path.join(projectRoot, ".lefthook.yml");
  if (await fileExists(configPath)) {
    return { found: true, configPath };
  }
  const altPath = path.join(projectRoot, "lefthook.yml");
  if (await fileExists(altPath)) {
    return { found: true, configPath: altPath };
  }
  return { found: false };
}

const DETECTION_RULES: DetectionRule[] = [
  { runner: "husky", check: detectHusky },
  { runner: "pre-commit", check: detectPreCommit },
  { runner: "lefthook", check: detectLefthook },
];

export async function detectHookSetup(projectRoot: string): Promise<HookSetup> {
  for (const rule of DETECTION_RULES) {
    const result = await rule.check(projectRoot);
    if (result.found) {
      return {
        runner: rule.runner,
        version: result.version,
        configPath: result.configPath,
      };
    }
  }
  return { runner: "none" };
}

import fs from "node:fs/promises";
import path from "node:path";

/**
 * Maps project indicator files to programming language keys
 * that match the hook-registry language entries.
 */
const STACK_INDICATORS: Record<string, string[]> = {
  "tsconfig.json": ["typescript"],
  "package.json": ["javascript"],
  "pyproject.toml": ["python"],
  "requirements.txt": ["python"],
  "go.mod": ["go"],
  "Cargo.toml": ["rust"],
  "pom.xml": ["java"],
  "build.gradle": ["kotlin"],
  "build.gradle.kts": ["kotlin"],
  "Package.swift": ["swift"],
  "composer.json": ["php"],
  Gemfile: ["ruby"],
  "pubspec.yaml": ["dart"],
  "CMakeLists.txt": ["cpp"],
};

const SCAN_SKIP = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage"]);

async function findShellFile(dir: string, depth = 0): Promise<boolean> {
  if (depth > 4) return false;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SCAN_SKIP.has(entry.name)) continue;
      if (await findShellFile(path.join(dir, entry.name), depth + 1)) return true;
    } else if (entry.name.endsWith(".sh")) {
      return true;
    }
  }
  return false;
}

export async function detectStack(projectRoot: string): Promise<string[]> {
  const detected = new Set<string>();
  for (const [file, languages] of Object.entries(STACK_INDICATORS)) {
    try {
      await fs.access(path.join(projectRoot, file));
      for (const lang of languages) detected.add(lang);
    } catch {
      // File not found, skip
    }
  }

  // C# detection: project files have variable names (*.csproj, *.sln)
  try {
    const entries = await fs.readdir(projectRoot);
    if (entries.some((e) => e.endsWith(".csproj") || e.endsWith(".sln"))) {
      detected.add("csharp");
    }
  } catch {
    // readdir failed, skip
  }

  // Shell detection: scan for .sh files recursively (excluding node_modules, .git)
  try {
    const hasSh = await findShellFile(projectRoot);
    if (hasSh) detected.add("shell");
  } catch {
    // scan failed, skip
  }

  return [...detected];
}

import { existsSync } from "node:fs";
import { join } from "node:path";
import { execFileAsync } from "#src/utils/exec.js";
import type { HookEntry } from "./hook-registry.js";

export interface DependencyCheck {
  name: string;
  available: boolean;
  installHint: string;
  /** Whether this is an npm package resolvable via npx */
  isNodePackage: boolean;
}

const INSTALL_HINTS: Record<string, string> = {
  eslint: "npm install -D eslint",
  prettier: "npm install -D prettier",
  tsc: "npm install -D typescript",
  ruff: "pip install ruff",
  pyright: "npm install -D pyright",
  "golangci-lint": "go install github.com/golangci-lint/golangci-lint/cmd/golangci-lint@latest",
  gofmt: "(included with Go)",
  cargo: "(included with Rust)",
  "cargo-clippy": "rustup component add clippy",
  "cargo-fmt": "rustup component add rustfmt",
  "google-java-format": "brew install google-java-format (or download from GitHub)",
  checkstyle: "brew install checkstyle (or download jar)",
  ktfmt: "brew install ktfmt",
  detekt: "brew install detekt",
  swiftformat: "brew install swiftformat",
  swiftlint: "brew install swiftlint",
  dotnet: "Install .NET SDK from https://dot.net",
  "clang-format": "brew install clang-format (or apt install clang-format)",
  "clang-tidy": "brew install llvm (or apt install clang-tidy)",
  "php-cs-fixer": "composer global require friendsofphp/php-cs-fixer",
  phpstan: "composer global require phpstan/phpstan",
  rubocop: "gem install rubocop",
  dart: "Install Dart SDK from https://dart.dev",
  bandit: "pip install bandit",
  gosec: "go install github.com/securego/gosec/v2/cmd/gosec@latest",
  brakeman: "gem install brakeman",
  "phpcs-security": "composer global require pheromone/phpcs-security-audit",
};

/** Tools that are npm packages and can be installed via npm/npx */
const NODE_PACKAGES = new Set(["eslint", "prettier", "tsc", "pyright"]);

function extractToolName(command: string): string {
  const parts = command.split(/\s+/);
  // Skip 'npx' prefix to get the actual tool name
  if (parts[0] === "npx" && parts[1]) {
    return parts[1];
  }
  return parts[0] ?? command;
}

async function isToolOnPath(tool: string): Promise<boolean> {
  try {
    await execFileAsync("which", [tool]);
    return true;
  } catch {
    return false;
  }
}

function isToolInNodeModules(tool: string, projectRoot: string): boolean {
  return existsSync(join(projectRoot, "node_modules", ".bin", tool));
}

export async function checkHookDependencies(
  hooks: HookEntry[],
  projectRoot?: string,
): Promise<DependencyCheck[]> {
  // Deduplicate tools
  const seen = new Set<string>();
  const uniqueTools: { tool: string; isNodePkg: boolean }[] = [];

  for (const hook of hooks) {
    const tool = extractToolName(hook.command);
    if (seen.has(tool)) continue;
    seen.add(tool);
    uniqueTools.push({ tool, isNodePkg: NODE_PACKAGES.has(tool) });
  }

  // Check all tools in parallel for speed
  const results = await Promise.all(
    uniqueTools.map(async ({ tool, isNodePkg }) => {
      let available = false;
      if (isNodePkg && projectRoot) {
        available = isToolInNodeModules(tool, projectRoot);
      }
      if (!available) {
        available = await isToolOnPath(tool);
      }
      return { tool, isNodePkg, available };
    }),
  );

  return results
    .filter((r) => !r.available)
    .map((r) => ({
      name: r.tool,
      available: false,
      installHint: INSTALL_HINTS[r.tool] ?? `Install ${r.tool}`,
      isNodePackage: r.isNodePkg,
    }));
}

export { extractToolName, NODE_PACKAGES };

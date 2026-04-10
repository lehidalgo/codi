import { existsSync } from "node:fs";
import { join } from "node:path";
import { execFileAsync } from "#src/utils/exec.js";
import type { HookEntry, InstallHint } from "./hook-registry.js";

export interface DependencyDiagnostic {
  name: string;
  /** true when the tool was found on PATH or in node_modules/.bin */
  found: boolean;
  /** "error" when required=true and tool missing; "warning" when required=false and tool missing; "ok" when found */
  severity: "ok" | "warning" | "error";
  category: HookEntry["category"];
  installHint: InstallHint | undefined;
  /** Full path to the resolved binary, or undefined if not found */
  resolvedPath?: string;
  /** Whether this is an npm package resolvable via npx */
  isNodePackage: boolean;
}

/** @deprecated Use DependencyDiagnostic. Kept for backward-compat with callers that expect only missing tools. */
export interface DependencyCheck {
  name: string;
  available: boolean;
  installHint: string;
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
  "google-java-format": "brew install google-java-format",
  checkstyle: "brew install checkstyle",
  ktfmt: "brew install ktfmt",
  detekt: "brew install detekt",
  swiftformat: "brew install swiftformat",
  swiftlint: "brew install swiftlint",
  dotnet: "Install .NET SDK from https://dot.net",
  "clang-format": "brew install clang-format",
  "clang-tidy": "brew install llvm",
  "php-cs-fixer": "composer global require friendsofphp/php-cs-fixer",
  phpstan: "composer global require phpstan/phpstan",
  rubocop: "gem install rubocop",
  dart: "Install Dart SDK from https://dart.dev",
  bandit: "pip install bandit",
  gosec: "go install github.com/securego/gosec/v2/cmd/gosec@latest",
  brakeman: "gem install brakeman",
  "phpcs-security": "composer global require pheromone/phpcs-security-audit",
  gitleaks: "brew install gitleaks",
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

async function resolveToolPath(tool: string): Promise<string | undefined> {
  try {
    const result = await execFileAsync("which", [tool]);
    const path = (result as unknown as { stdout: string }).stdout?.trim();
    return path || undefined;
  } catch {
    return undefined;
  }
}

function isToolInNodeModules(tool: string, projectRoot: string): boolean {
  return existsSync(join(projectRoot, "node_modules", ".bin", tool));
}

export async function checkHookDependencies(
  hooks: HookEntry[],
  projectRoot?: string,
): Promise<DependencyDiagnostic[]> {
  // Deduplicate tools
  const seen = new Set<string>();
  const uniqueEntries: { tool: string; hook: HookEntry; isNodePkg: boolean }[] = [];

  for (const hook of hooks) {
    const tool = extractToolName(hook.command);
    if (seen.has(tool)) continue;
    seen.add(tool);
    uniqueEntries.push({ tool, hook, isNodePkg: NODE_PACKAGES.has(tool) });
  }

  // Check all tools in parallel for speed
  const results = await Promise.all(
    uniqueEntries.map(async ({ tool, hook, isNodePkg }) => {
      let resolvedPath: string | undefined;
      if (isNodePkg && projectRoot && isToolInNodeModules(tool, projectRoot)) {
        resolvedPath = join(projectRoot, "node_modules", ".bin", tool);
      }
      if (!resolvedPath) {
        resolvedPath = await resolveToolPath(tool);
      }
      const found = resolvedPath !== undefined;

      // Build installHint: prefer hook's own installHint, fall back to INSTALL_HINTS record
      const installHint: InstallHint | undefined =
        hook.installHint ?? (INSTALL_HINTS[tool] ? { command: INSTALL_HINTS[tool]! } : undefined);

      let severity: DependencyDiagnostic["severity"] = "ok";
      if (!found) {
        severity = hook.required === true ? "error" : "warning";
      }

      return {
        name: tool,
        found,
        severity,
        category: hook.category,
        installHint,
        resolvedPath,
        isNodePackage: isNodePkg,
      } satisfies DependencyDiagnostic;
    }),
  );

  return results;
}

/** Convenience helper for callers that only need missing tools (backward compat with DependencyCheck). */
export function filterMissing(diagnostics: DependencyDiagnostic[]): DependencyCheck[] {
  return diagnostics
    .filter((d) => !d.found)
    .map((d) => ({
      name: d.name,
      available: false,
      installHint: d.installHint?.command ?? `Install ${d.name}`,
      isNodePackage: d.isNodePackage,
    }));
}

export { extractToolName, NODE_PACKAGES };

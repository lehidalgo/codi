import * as p from "@clack/prompts";
import { execFileAsync } from "#src/utils/exec.js";
import type { DependencyCheck } from "./hook-dependency-checker.js";
import type { Logger } from "../output/logger.js";

export interface InstallGroup {
  label: string;
  command: string;
  args: string[];
  deps: DependencyCheck[];
}

export type PackageManager = "npm" | "pip" | "brew" | "gem" | "go" | "cargo" | "rustup" | "manual";

/**
 * Infer the package manager from an installHint command string.
 * Returns "manual" for hints that don't match a known prefix.
 *
 * cargo and rustup are kept separate because their command surfaces
 * are not interchangeable (rustup components are not crates).
 */
export function inferPackageManager(installHint: string): PackageManager {
  const trimmed = installHint.trimStart();
  if (trimmed.startsWith("pip install ") || trimmed.startsWith("pip3 install ")) return "pip";
  if (trimmed.startsWith("brew install ")) return "brew";
  if (trimmed.startsWith("gem install ")) return "gem";
  if (trimmed.startsWith("go install ")) return "go";
  if (trimmed.startsWith("cargo install ")) return "cargo";
  if (trimmed.startsWith("rustup component add ")) return "rustup";
  return "manual";
}

/**
 * Extract package names from an installHint given its inferred manager.
 * Returns empty array when the manager is "manual" or "npm" (npm is handled separately).
 */
export function extractPackagesFromHint(installHint: string, pm: PackageManager): string[] {
  if (pm === "manual" || pm === "npm") return [];
  const trimmed = installHint.trimStart();
  const prefixes: Record<Exclude<PackageManager, "manual" | "npm">, string[]> = {
    pip: ["pip install ", "pip3 install "],
    brew: ["brew install "],
    gem: ["gem install "],
    go: ["go install "],
    cargo: ["cargo install "],
    rustup: ["rustup component add "],
  };
  const list = prefixes[pm];
  for (const p of list) {
    if (trimmed.startsWith(p)) {
      return trimmed.slice(p.length).split(/\s+/).filter(Boolean);
    }
  }
  return [];
}

function pmCommandPrefix(pm: PackageManager): string {
  switch (pm) {
    case "pip":
      return "pip install";
    case "brew":
      return "brew install";
    case "gem":
      return "gem install";
    case "go":
      return "go install";
    case "cargo":
      return "cargo install";
    case "rustup":
      return "rustup component add";
    default:
      return "";
  }
}

/**
 * Groups missing dependencies by their package manager for batch installation.
 * npm deps are batched into a single `npm install -D` command. Non-npm deps
 * are batched per package manager (pip / brew / gem / go / cargo / rustup);
 * unknown hints are kept as separate manual entries.
 */
export function groupByPackageManager(deps: DependencyCheck[]): InstallGroup[] {
  const npmDeps = deps.filter((d) => d.isNodePackage);
  const otherDeps = deps.filter((d) => !d.isNodePackage);

  const groups: InstallGroup[] = [];

  if (npmDeps.length > 0) {
    const packages = npmDeps.map((d) => (d.name === "tsc" ? "typescript" : d.name));
    groups.push({
      label: `npm install -D ${packages.join(" ")}`,
      command: "npm",
      args: ["install", "-D", ...packages],
      deps: npmDeps,
    });
  }

  // Group non-npm deps by inferred package manager
  const byPm = new Map<PackageManager, DependencyCheck[]>();
  for (const dep of otherDeps) {
    const pm = inferPackageManager(dep.installHint);
    const list = byPm.get(pm) ?? [];
    list.push(dep);
    byPm.set(pm, list);
  }

  for (const [pm, batchDeps] of byPm.entries()) {
    if (pm === "manual") {
      for (const dep of batchDeps) {
        groups.push({ label: dep.installHint, command: "", args: [], deps: [dep] });
      }
      continue;
    }
    const allPackages = batchDeps.flatMap((d) => extractPackagesFromHint(d.installHint, pm));
    groups.push({
      label: `${pmCommandPrefix(pm)} ${allPackages.join(" ")}`,
      command: "",
      args: [],
      deps: batchDeps,
    });
  }

  return groups;
}

/**
 * Prompts the user to install missing hook dependencies.
 * For npm packages, offers automatic installation.
 * For system tools, shows manual install instructions.
 */
export async function installMissingDeps(
  deps: DependencyCheck[],
  projectRoot: string,
  log: Logger,
  interactive = true,
): Promise<void> {
  if (deps.length === 0) return;

  // Non-interactive mode: just log warnings and return
  if (!interactive) {
    logMissingDeps(deps, log);
    return;
  }

  const groups = groupByPackageManager(deps);
  const npmGroup = groups.find((g) => g.command === "npm");
  const systemDeps = groups.filter((g) => g.command !== "npm");

  // Auto-installable npm packages
  if (npmGroup) {
    p.log.warning(
      `Missing npm packages required by pre-commit hooks: ${npmGroup.deps.map((d) => d.name).join(", ")}`,
    );

    const shouldInstall = await p.confirm({
      message: `Install them now? (${npmGroup.label})`,
      initialValue: true,
    });

    if (p.isCancel(shouldInstall)) {
      log.warn("Skipped dependency installation. Install manually before committing.");
      return;
    }

    if (shouldInstall) {
      const spinner = p.spinner();
      spinner.start("Installing npm packages...");
      try {
        await execFileAsync(npmGroup.command, npmGroup.args, {
          cwd: projectRoot,
          timeout: 60_000,
        });
        spinner.stop("Dependencies installed successfully");
      } catch (error) {
        spinner.stop("Installation failed");
        log.warn(`Failed to install: ${(error as Error).message}`);
        log.warn(`Run manually: ${npmGroup.label}`);
      }
    } else {
      log.warn(`Install before committing: ${npmGroup.label}`);
    }
  }

  // System-level tools that need manual installation
  if (systemDeps.length > 0) {
    log.warn("Missing system tools — install manually before committing:");
    for (const group of systemDeps) {
      for (const dep of group.deps) {
        log.warn(`  ${dep.name}: ${dep.installHint}`);
      }
    }
  }
}

/**
 * Non-interactive version for CI/agent contexts.
 * Logs warnings for all missing dependencies.
 */
export function logMissingDeps(deps: DependencyCheck[], log: Logger): void {
  if (deps.length === 0) return;

  log.warn("Missing hook dependencies — install before committing:");
  for (const dep of deps) {
    log.warn(`  ${dep.name}: ${dep.installHint}`);
  }
}

import * as p from "@clack/prompts";
import { execFileAsync } from "../../utils/exec.js";
import type { DependencyCheck } from "./hook-dependency-checker.js";
import type { Logger } from "../output/logger.js";

interface InstallGroup {
  label: string;
  command: string;
  args: string[];
  deps: DependencyCheck[];
}

/**
 * Groups missing dependencies by their package manager for batch installation.
 */
function groupByPackageManager(deps: DependencyCheck[]): InstallGroup[] {
  const npmDeps = deps.filter((d) => d.isNodePackage);
  const otherDeps = deps.filter((d) => !d.isNodePackage);

  const groups: InstallGroup[] = [];

  if (npmDeps.length > 0) {
    const packages = npmDeps.map((d) => {
      // tsc is the binary, but the npm package is 'typescript'
      if (d.name === "tsc") return "typescript";
      return d.name;
    });
    groups.push({
      label: `npm install -D ${packages.join(" ")}`,
      command: "npm",
      args: ["install", "-D", ...packages],
      deps: npmDeps,
    });
  }

  // Non-npm deps can't be batch-installed — list them separately
  for (const dep of otherDeps) {
    groups.push({
      label: dep.installHint,
      command: "",
      args: [],
      deps: [dep],
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
      log.warn(
        "Skipped dependency installation. Install manually before committing.",
      );
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

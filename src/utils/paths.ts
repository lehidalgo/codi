import path from "node:path";
import os from "node:os";
import { PROJECT_DIR } from "../constants.js";

export function resolveCodiDir(projectRoot: string): string {
  return path.join(projectRoot, PROJECT_DIR);
}

export function resolveUserDir(): string {
  return path.join(os.homedir(), PROJECT_DIR);
}

export function resolveOrgFile(): string {
  return path.join(os.homedir(), PROJECT_DIR, "org.yaml");
}

export function resolveTeamFile(teamName: string): string {
  return path.join(os.homedir(), PROJECT_DIR, "teams", `${teamName}.yaml`);
}

export function normalizePath(p: string): string {
  return p.split(path.sep).join("/");
}

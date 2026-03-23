import path from 'node:path';
import os from 'node:os';

export function resolveCodiDir(projectRoot: string): string {
  return path.join(projectRoot, '.codi');
}

export function resolveUserDir(): string {
  return path.join(os.homedir(), '.codi');
}

export function resolveOrgFile(): string {
  return path.join(os.homedir(), '.codi', 'org.yaml');
}

export function resolveTeamFile(teamName: string): string {
  return path.join(os.homedir(), '.codi', 'teams', `${teamName}.yaml`);
}

export function normalizePath(p: string): string {
  return p.split(path.sep).join('/');
}

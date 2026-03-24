import path from 'node:path';

export function isPathSafe(projectRoot: string, targetPath: string): boolean {
  const resolved = path.resolve(projectRoot, targetPath);
  const relative = path.relative(projectRoot, resolved);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

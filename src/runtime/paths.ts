/**
 * Filesystem layout helpers for the manifest event log.
 *
 * Layout:
 *   .workflow/
 *     active/
 *       workflow-id.txt              ← ID of the currently active workflow
 *       .lock                        ← prevents concurrent writes
 *       staging/                     ← non-commitable events pending merge
 *     archives/
 *       <workflow-id>/
 *         000_init.json              ← committable event, lives in git
 *         002_phase_completed.json
 *         ...
 *         reduced-state.json         ← reducer snapshot, regenerated
 */

import { resolve, join } from "node:path";

export interface DevloopPaths {
  cwd: string;
  workflowDir: string;
  activeDir: string;
  activeIdFile: string;
  lockFile: string;
  stagingDir: string;
  archivesDir: string;
}

export function devloopPaths(cwd: string): DevloopPaths {
  const root = resolve(cwd, ".workflow");
  return {
    cwd: resolve(cwd),
    workflowDir: root,
    activeDir: join(root, "active"),
    activeIdFile: join(root, "active", "workflow-id.txt"),
    lockFile: join(root, "active", ".lock"),
    stagingDir: join(root, "active", "staging"),
    archivesDir: join(root, "archives"),
  };
}

export function archiveDir(paths: DevloopPaths, workflowId: string): string {
  return join(paths.archivesDir, workflowId);
}

export function reducedStatePath(paths: DevloopPaths, workflowId: string): string {
  return join(archiveDir(paths, workflowId), "reduced-state.json");
}

export function eventFilename(sequence: number, eventType: string): string {
  return `${String(sequence).padStart(3, "0")}_${eventType}.json`;
}

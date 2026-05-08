/**
 * Append-only writer and reader for manifest events.
 *
 * Commitable events go to .workflow/archives/<workflow-id>/NNN_<event-type>.json
 * directly (commit responsibility lives in the CLI, not here).
 *
 * Non-commitable events go to .workflow/active/staging/NNN_<event-type>.json
 * and are NOT committed. They survive across reads of the active workflow but
 * may be lost on filesystem corruption — by design.
 *
 * The combined view (archive + staging) is the full event log of the active
 * workflow. Reducer consumes that view.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  rmSync,
  openSync,
  closeSync,
} from "node:fs";
import { join } from "node:path";
import { archiveDir, devloopPaths, eventFilename, type DevloopPaths } from "./paths.js";
import type { ManifestEvent } from "./types.js";

export class WorkflowAlreadyActiveError extends Error {
  constructor(public readonly activeId: string) {
    super(`Another workflow is already active: ${activeId}`);
    this.name = "WorkflowAlreadyActiveError";
  }
}

export class NoActiveWorkflowError extends Error {
  constructor() {
    super("No active workflow. Run `devloop run <type> '<task>'` first.");
    this.name = "NoActiveWorkflowError";
  }
}

export class LockHeldError extends Error {
  constructor() {
    super("Lock file is held by another devloop process.");
    this.name = "LockHeldError";
  }
}

export class EventLog {
  private constructor(public readonly paths: DevloopPaths) {}

  static fromCwd(cwd: string): EventLog {
    return new EventLog(devloopPaths(cwd));
  }

  // ─── Active workflow ID ──────────────────────────────────────────────

  getActiveWorkflowId(): string | null {
    if (!existsSync(this.paths.activeIdFile)) return null;
    const id = readFileSync(this.paths.activeIdFile, "utf-8").trim();
    return id.length > 0 ? id : null;
  }

  setActiveWorkflowId(workflowId: string): void {
    mkdirSync(this.paths.activeDir, { recursive: true });
    writeFileSync(this.paths.activeIdFile, workflowId, "utf-8");
  }

  clearActiveWorkflowId(): void {
    if (existsSync(this.paths.activeIdFile)) {
      rmSync(this.paths.activeIdFile);
    }
  }

  // ─── Lock management ─────────────────────────────────────────────────

  acquireLock(): void {
    mkdirSync(this.paths.activeDir, { recursive: true });
    if (existsSync(this.paths.lockFile)) {
      throw new LockHeldError();
    }
    const fd = openSync(this.paths.lockFile, "wx");
    closeSync(fd);
  }

  releaseLock(): void {
    if (existsSync(this.paths.lockFile)) {
      rmSync(this.paths.lockFile);
    }
  }

  // ─── Initialize a new workflow ───────────────────────────────────────

  initWorkflow(workflowId: string, initEvent: ManifestEvent): void {
    const existingId = this.getActiveWorkflowId();
    if (existingId !== null && existingId !== workflowId) {
      throw new WorkflowAlreadyActiveError(existingId);
    }
    if (initEvent.event_type !== "init") {
      throw new Error(`First event must be 'init', got '${initEvent.event_type}'`);
    }
    const dir = archiveDir(this.paths, workflowId);
    if (existsSync(dir) && readdirSync(dir).length > 0) {
      throw new Error(`Archive for workflow ${workflowId} already exists.`);
    }
    mkdirSync(dir, { recursive: true });
    mkdirSync(this.paths.stagingDir, { recursive: true });
    this.setActiveWorkflowId(workflowId);
    const filename = eventFilename(0, "init");
    writeFileSync(join(dir, filename), JSON.stringify(initEvent, null, 2), "utf-8");
  }

  // ─── Append events ──────────────────────────────────────────────────

  /**
   * Append an event. Commitable events go to the archive; non-commitable
   * events go to staging. Returns the path written and the assigned sequence.
   */
  append(
    workflowId: string,
    event: ManifestEvent,
  ): {
    path: string;
    sequence: number;
    commitable: boolean;
  } {
    const archive = archiveDir(this.paths, workflowId);
    if (!existsSync(archive)) {
      throw new Error(`No archive for workflow ${workflowId}. Run init first.`);
    }
    const sequence = this.nextSequence(workflowId);
    const filename = eventFilename(sequence, event.event_type);
    const targetDir = event.commitable ? archive : this.paths.stagingDir;
    mkdirSync(targetDir, { recursive: true });
    const path = join(targetDir, filename);
    if (existsSync(path)) {
      throw new Error(`Event file already exists at ${path}.`);
    }
    writeFileSync(path, JSON.stringify(event, null, 2), "utf-8");
    return { path, sequence, commitable: event.commitable };
  }

  // ─── Read events ────────────────────────────────────────────────────

  /**
   * Loads all events for the workflow: archived (committed) + staging
   * (non-commitable, local only). Sorted by sequence prefix.
   */
  loadEvents(workflowId: string): ManifestEvent[] {
    const archive = archiveDir(this.paths, workflowId);
    const events: { sequence: number; event: ManifestEvent }[] = [];

    if (existsSync(archive)) {
      for (const entry of readdirSync(archive)) {
        if (!this.isEventFile(entry)) continue;
        const sequence = this.parseSequence(entry);
        const data = readFileSync(join(archive, entry), "utf-8");
        events.push({ sequence, event: JSON.parse(data) as ManifestEvent });
      }
    }

    if (existsSync(this.paths.stagingDir)) {
      for (const entry of readdirSync(this.paths.stagingDir)) {
        if (!this.isEventFile(entry)) continue;
        const sequence = this.parseSequence(entry);
        const data = readFileSync(join(this.paths.stagingDir, entry), "utf-8");
        const event = JSON.parse(data) as ManifestEvent;
        // Staging files are tied to the active workflow only; ignore stale
        // staging that doesn't belong (e.g. after `recover` from corruption).
        if (event.event_type === "init") continue;
        events.push({ sequence, event });
      }
    }

    events.sort((a, b) => a.sequence - b.sequence);
    return events.map((e) => e.event);
  }

  loadArchivedEvents(workflowId: string): ManifestEvent[] {
    const archive = archiveDir(this.paths, workflowId);
    if (!existsSync(archive)) return [];
    const events: { sequence: number; event: ManifestEvent }[] = [];
    for (const entry of readdirSync(archive)) {
      if (!this.isEventFile(entry)) continue;
      const sequence = this.parseSequence(entry);
      const data = readFileSync(join(archive, entry), "utf-8");
      events.push({ sequence, event: JSON.parse(data) as ManifestEvent });
    }
    events.sort((a, b) => a.sequence - b.sequence);
    return events.map((e) => e.event);
  }

  // ─── Sequence and naming ────────────────────────────────────────────

  private nextSequence(workflowId: string): number {
    const archive = archiveDir(this.paths, workflowId);
    let max = -1;
    for (const dir of [archive, this.paths.stagingDir]) {
      if (!existsSync(dir)) continue;
      for (const entry of readdirSync(dir)) {
        if (!this.isEventFile(entry)) continue;
        const seq = this.parseSequence(entry);
        if (seq > max) max = seq;
      }
    }
    return max + 1;
  }

  private isEventFile(filename: string): boolean {
    return /^\d{3}_[a-z_]+\.json$/.test(filename);
  }

  private parseSequence(filename: string): number {
    const match = filename.match(/^(\d{3})_/);
    if (!match || !match[1]) {
      throw new Error(`Invalid event filename: ${filename}`);
    }
    return parseInt(match[1], 10);
  }
}

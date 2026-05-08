/**
 * codi brain-ui server (Sprint 4).
 *
 * Hono-based HTTP server that exposes a read-only window into the brain DB.
 * Read-only WAL connection + busy_timeout prevents lock contention with the
 * agent's writers; the server never mutates the brain.
 *
 * Lifecycle: spawn-or-attach via pidfile at ~/.codi/brain-ui.pid. The
 * `brain-ui` CLI command checks the pidfile + healthz before spawning.
 */

import { Hono } from "hono";
import type { Context, Hono as HonoApp } from "hono";
import { openBrain, applyMigrations, type BrainHandle } from "../brain/index.js";
import { registerApiRoutes } from "./routes-api.js";
import { registerPages } from "./pages.js";

export interface BuildAppOptions {
  /** Path to the brain DB. Default: `~/.codi/brain.db`. */
  readonly brainPath?: string;
}

export interface AppHandle {
  readonly app: HonoApp;
  readonly brain: BrainHandle;
  close(): void;
}

/**
 * Build the Hono app + open the brain DB. Caller is responsible for
 * mounting the app on a server (e.g. `serve` from @hono/node-server).
 */
export function buildApp(opts: BuildAppOptions = {}): AppHandle {
  const brain = openBrain({ dbPath: opts.brainPath, readonly: false });
  // Migrate is idempotent — running it on attach is safe.
  applyMigrations(brain.raw);
  // Bound the time we wait for SQLite locks rather than hanging forever.
  brain.raw.pragma("busy_timeout = 5000");

  const app = new Hono();

  app.get("/healthz", (c: Context) => {
    const versionRow = brain.raw
      .prepare("SELECT MAX(version) as v FROM _codi_schema_version")
      .get() as { v: number | null };
    return c.json({
      ok: true,
      schema_version: versionRow.v ?? 0,
      brain_path: brain.path,
      now: Date.now(),
    });
  });

  registerApiRoutes(app, brain);
  registerPages(app, brain);

  return {
    app,
    brain,
    close: () => brain.close(),
  };
}

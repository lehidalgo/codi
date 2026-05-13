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
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { openBrain, type BrainHandle } from "#src/runtime/brain/db.js";
import { applyMigrations } from "#src/runtime/brain/migrate.js";
import { registerApiRoutes } from "./routes-api.js";
import { registerPages } from "./pages.js";
import { registerSseRoute } from "./sse.js";

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
  // Migrate is idempotent — running it on attach is safe. busy_timeout is
  // set inside openBrain (ISSUE-060).
  applyMigrations(brain.raw);

  const app = new Hono();

  // ISSUE-061: serve vendored htmx + alpine from `/static/` instead of
  // pulling them from unpkg.com. Resolves htmx.min.js / alpine.min.js from
  // dist/static/ (production) or node_modules (dev). The handler is
  // strictly read-only and only resolves a closed allowlist of files.
  const STATIC_FILES = resolveStaticFiles();
  app.get("/static/:file", (c: Context) => {
    const file = c.req.param("file");
    const fsPath = file ? STATIC_FILES.get(file) : undefined;
    if (!fsPath) return c.notFound();
    return new Response(readFileSync(fsPath), {
      headers: { "content-type": "application/javascript; charset=utf-8" },
    });
  });

  // Origin guard for state-changing /api/v1/* requests (ISSUE-009).
  //
  // brain-ui binds to loopback (see cli-server.ts), so the only realistic
  // threat model for this tool is a browser tab on another origin firing
  // fetch() at 127.0.0.1:4477. Browsers always send the Origin header on
  // cross-origin requests, so requiring a loopback Origin on every mutating
  // request closes that gap. Authenticated tokens (bearer / OAuth) would be
  // over-engineering for a same-user local dev tool: any process that can
  // reach the loopback port can also read brain.db directly with sqlite3.
  //
  // Earlier the middleware contained `if (origin === undefined) return next()`
  // to keep curl/CLI tooling unblocked, but that bypass lets any local
  // process — npm postinstall scripts, IDE background tasks, browser
  // extensions via fetch tricks — issue mutating requests without going
  // through a browser. Origin is now mandatory for non-GET requests.
  const LOOPBACK_ORIGIN_RE = /^https?:\/\/(127\.0\.0\.1|\[::1\]|localhost)(:\d+)?$/;
  app.use("/api/v1/*", async (c, next) => {
    const m = c.req.method;
    if (m === "GET" || m === "HEAD" || m === "OPTIONS") return next();
    const origin = c.req.header("origin");
    if (origin === undefined || !LOOPBACK_ORIGIN_RE.test(origin)) {
      return c.json({ error: { code: "E_CSRF_ORIGIN", message: "Origin not allowed" } }, 403);
    }
    return next();
  });

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
  registerSseRoute(app, brain);

  return {
    app,
    brain,
    close: () => brain.close(),
  };
}

/**
 * Build the allowlist of `/static/<file>` → absolute fs path. Production
 * resolves files alongside the compiled brain-ui-server.js bundle in
 * `dist/static/`. Dev (running `tsx src/runtime/brain-ui/cli-server.ts`)
 * walks up to the repo root and resolves files from `node_modules`.
 */
function resolveStaticFiles(): Map<string, string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const distStatic = join(here, "static");
  if (existsSync(join(distStatic, "htmx.min.js"))) {
    return new Map([
      ["htmx.min.js", join(distStatic, "htmx.min.js")],
      ["alpine.min.js", join(distStatic, "alpine.min.js")],
    ]);
  }
  const repoRoot = resolve(here, "..", "..", "..");
  return new Map([
    ["htmx.min.js", join(repoRoot, "node_modules/htmx.org/dist/htmx.min.js")],
    ["alpine.min.js", join(repoRoot, "node_modules/alpinejs/dist/cdn.min.js")],
  ]);
}

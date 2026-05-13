/**
 * codi brain-ui server entrypoint.
 *
 * Run via the `codi brain ui` CLI command. Args:
 *   --port <n>          Port to bind. Default: 4477.
 *   --brain-path <p>    Override brain DB path.
 *   --foreground        Stay attached to terminal (skip pidfile check).
 *
 * The CLI wrapper handles spawn-or-attach via lifecycle.ts before invoking
 * this script. This script trusts that it owns the port.
 */

import { serve } from "@hono/node-server";
import { buildApp } from "./server.js";
import { resolveDefaultBrainUiPort, writePidfile, clearPidfile } from "./lifecycle.js";
import { Logger } from "#src/core/output/logger.js";

interface ParsedArgs {
  port: number;
  brainPath: string | undefined;
  foreground: boolean;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  // ISSUE-084 — env override has lower precedence than explicit --port.
  const args: ParsedArgs = {
    port: resolveDefaultBrainUiPort(),
    brainPath: undefined,
    foreground: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--port" && i + 1 < argv.length) {
      args.port = Number(argv[++i]);
    } else if (a === "--brain-path" && i + 1 < argv.length) {
      args.brainPath = argv[++i];
    } else if (a === "--foreground") {
      args.foreground = true;
    }
  }
  if (!Number.isFinite(args.port) || args.port <= 0) {
    throw new Error(`Invalid --port: ${args.port}`);
  }
  return args;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const handle = buildApp({ brainPath: args.brainPath });
  const hostname = process.env["CODI_BRAIN_UI_BIND"] ?? "127.0.0.1";
  const server = serve({ fetch: handle.app.fetch, port: args.port, hostname });

  if (!args.foreground) {
    writePidfile({ pid: process.pid, port: args.port, startedAt: Date.now() });
  }

  const shutdown = (signal: string) => {
    Logger.getInstance().info(`[brain-ui] received ${signal}, shutting down…`);
    server.close(() => {
      handle.close();
      if (!args.foreground) clearPidfile();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  Logger.getInstance().info(
    `[brain-ui] listening on http://${hostname}:${args.port} (brain=${handle.brain.path})`,
  );
}

main();

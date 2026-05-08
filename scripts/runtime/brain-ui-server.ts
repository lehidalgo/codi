#!/usr/bin/env tsx
/**
 * codi brain-ui server entrypoint (Sprint 4).
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
import { buildApp } from "#src/runtime/brain-ui/index.js";
import {
  DEFAULT_BRAIN_UI_PORT,
  defaultPidfilePath,
  writePidfile,
  clearPidfile,
} from "#src/runtime/brain-ui/index.js";

interface ParsedArgs {
  port: number;
  brainPath: string | undefined;
  foreground: boolean;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const args: ParsedArgs = {
    port: DEFAULT_BRAIN_UI_PORT,
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
  const server = serve({ fetch: handle.app.fetch, port: args.port });

  if (!args.foreground) {
    writePidfile({ pid: process.pid, port: args.port, startedAt: Date.now() });
  }

  const shutdown = (signal: string) => {
    console.error(`[brain-ui] received ${signal}, shutting down…`);
    server.close(() => {
      handle.close();
      if (!args.foreground) clearPidfile();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  console.error(
    `[brain-ui] listening on http://127.0.0.1:${args.port} (brain=${handle.brain.path})`,
  );
}

main();

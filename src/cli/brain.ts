import type { Command } from "commander";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { Logger } from "../core/output/logger.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import { initFromOptions, handleOutput } from "./shared.js";
import { resolveAttachOrSpawn, DEFAULT_BRAIN_UI_PORT } from "../runtime/brain-ui/index.js";
import { openBrain, applyMigrations, defaultBrainPath } from "../runtime/brain/index.js";
import { generatePackage, packageToJson } from "../runtime/consolidate/index.js";
import type { GlobalOptions } from "./shared.js";
import type { CommandResult } from "../core/output/types.js";

interface BrainUiData {
  readonly action: "attach" | "spawn";
  readonly port: number;
  readonly url: string;
  readonly pid?: number;
}

interface BrainUiFlags {
  readonly port?: string;
  readonly brainPath?: string;
  readonly foreground?: boolean;
}

export async function brainUiHandler(flags: BrainUiFlags): Promise<CommandResult<BrainUiData>> {
  const log = Logger.getInstance();
  const port = flags.port ? Number(flags.port) : DEFAULT_BRAIN_UI_PORT;
  const decision = await resolveAttachOrSpawn();

  if (decision.action === "attach") {
    const url = `http://127.0.0.1:${decision.record.port}`;
    log.info(`Brain UI already running — attached at ${url} (pid ${decision.record.pid})`);
    return createCommandResult({
      success: true,
      command: "brain ui",
      data: {
        action: "attach",
        port: decision.record.port,
        url,
        pid: decision.record.pid,
      },
      exitCode: EXIT_CODES.SUCCESS,
    });
  }

  // Sprint 4.c — spawn detached so the parent CLI exits cleanly.
  const args: string[] = [
    resolve(process.cwd(), "scripts", "runtime", "brain-ui-server.ts"),
    "--port",
    String(port),
  ];
  if (flags.brainPath) {
    args.push("--brain-path", flags.brainPath);
  }
  if (flags.foreground) {
    args.push("--foreground");
  }

  const child = spawn(process.execPath, ["--experimental-strip-types", ...args], {
    detached: !flags.foreground,
    stdio: flags.foreground ? "inherit" : "ignore",
  });
  if (!flags.foreground) child.unref();

  const url = `http://127.0.0.1:${port}`;
  log.info(`Spawning brain UI at ${url}${flags.foreground ? " (foreground)" : ""}`);
  return createCommandResult({
    success: true,
    command: "brain ui",
    data: { action: "spawn", port, url, pid: child.pid ?? -1 },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

interface BrainExportData {
  readonly path: string;
  readonly proposalsExported: number;
}

interface BrainExportFlags {
  readonly out?: string;
}

export async function brainExportHandler(
  flags: BrainExportFlags,
): Promise<CommandResult<BrainExportData>> {
  const log = Logger.getInstance();
  const out = flags.out ?? "codi-consolidation-package.json";
  const handle = openBrain({ dbPath: defaultBrainPath() });
  try {
    applyMigrations(handle.raw);
    const manifest = generatePackage(handle.raw);
    const text = packageToJson(manifest);
    const fs = await import("node:fs");
    fs.writeFileSync(out, text);
    log.info(`Wrote ${manifest.counts.total} accepted proposals → ${out}`);
    return createCommandResult({
      success: true,
      command: "brain export",
      data: { path: out, proposalsExported: manifest.counts.total },
      exitCode: EXIT_CODES.SUCCESS,
    });
  } finally {
    handle.close();
  }
}

export function registerBrainCommand(program: Command): void {
  const brain = program.command("brain").description("Brain DB inspection + export");

  brain
    .command("ui")
    .description("Launch or attach to the brain-ui server (default port 4477)")
    .option("--port <port>", "port to bind", String(DEFAULT_BRAIN_UI_PORT))
    .option("--brain-path <path>", "override brain DB path")
    .option("--foreground", "stay attached to terminal")
    .action(async (opts: BrainUiFlags) => {
      const globalOpts = program.opts() as GlobalOptions;
      initFromOptions(globalOpts);
      const result = await brainUiHandler(opts);
      handleOutput(result, globalOpts);
    });

  brain
    .command("export")
    .description("Export the consolidation package (accepted proposals) as JSON")
    .option("--out <path>", "output path", "codi-consolidation-package.json")
    .action(async (opts: BrainExportFlags) => {
      const globalOpts = program.opts() as GlobalOptions;
      initFromOptions(globalOpts);
      const result = await brainExportHandler(opts);
      handleOutput(result, globalOpts);
    });
}

import type { Command } from "commander";
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { Logger } from "../core/output/logger.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import { initFromOptions, handleOutput } from "./shared.js";
import { resolveAttachOrSpawn, DEFAULT_BRAIN_UI_PORT } from "../runtime/brain-ui/index.js";
import { openBrain, applyMigrations, defaultBrainPath } from "../runtime/brain/index.js";
import { generatePackage, packageToJson } from "../runtime/consolidate/index.js";
import {
  ingestMemoryFile,
  SUPPORTED_AGENT_TYPES,
  isSupportedAgentType,
} from "../runtime/capture/agent-memory.js";
import { ensureSession, openTurn, recordPrompt } from "../runtime/capture/session.js";
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

// ─── Retroactive memory ingestion ─────────────────────────────────────────

interface IngestMemoryFlags {
  readonly agent?: string;
  readonly dryRun?: boolean;
  readonly brainPath?: string;
}

interface IngestMemoryData {
  readonly scanned: number;
  readonly inserted: number;
  readonly duplicates: number;
  readonly perAgent: Record<string, { scanned: number; inserted: number; duplicates: number }>;
  readonly dryRun: boolean;
}

interface AgentMemorySource {
  readonly agentType: (typeof SUPPORTED_AGENT_TYPES)[number];
  /** Returns absolute paths to .md / .json memory files. */
  readonly listFiles: () => string[];
}

/**
 * Walk the per-agent memory layouts for the closed set of supported
 * agents (claude-code, codex). Other agents in the codi matrix
 * (gemini / cursor / windsurf / copilot) do not expose a structured
 * per-project memory layout we can ingest losslessly — they degrade
 * gracefully here by simply not contributing a source.
 */
function discoverAgentMemorySources(filterAgent?: string): AgentMemorySource[] {
  const sources: AgentMemorySource[] = [];

  // Claude Code: ~/.claude/projects/<slug>/memory/*.md  (skip MEMORY.md indices)
  const claudeRoot = join(homedir(), ".claude", "projects");
  sources.push({
    agentType: "claude-code",
    listFiles: () => {
      if (!existsSync(claudeRoot)) return [];
      const out: string[] = [];
      for (const slug of readdirSync(claudeRoot)) {
        const memoryDir = join(claudeRoot, slug, "memory");
        if (!existsSync(memoryDir)) continue;
        for (const f of readdirSync(memoryDir)) {
          if (!f.endsWith(".md")) continue;
          if (f === "MEMORY.md") continue;
          out.push(join(memoryDir, f));
        }
      }
      return out;
    },
  });

  // Codex: ~/.codex/memories/*.{md,json}
  const codexRoot = join(homedir(), ".codex", "memories");
  sources.push({
    agentType: "codex",
    listFiles: () => {
      if (!existsSync(codexRoot)) return [];
      return readdirSync(codexRoot)
        .filter((f) => f.endsWith(".md") || f.endsWith(".json"))
        .map((f) => join(codexRoot, f));
    },
  });

  return filterAgent ? sources.filter((s) => s.agentType === filterAgent) : sources;
}

export async function brainIngestMemoryHandler(
  flags: IngestMemoryFlags,
): Promise<CommandResult<IngestMemoryData>> {
  const log = Logger.getInstance();

  if (flags.agent !== undefined && !isSupportedAgentType(flags.agent)) {
    return createCommandResult({
      success: false,
      command: "brain ingest-memory",
      data: {
        scanned: 0,
        inserted: 0,
        duplicates: 0,
        perAgent: {},
        dryRun: flags.dryRun ?? false,
      },
      errors: [
        {
          code: "UNSUPPORTED_AGENT",
          message: `Agent '${flags.agent}' does not expose a structured memory layout. Supported: ${SUPPORTED_AGENT_TYPES.join(", ")}.`,
          hint: "Pass --agent claude-code or --agent codex, or omit --agent to scan both.",
          severity: "error",
          context: { requested: flags.agent, supported: [...SUPPORTED_AGENT_TYPES] },
        },
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const handle = openBrain({ ...(flags.brainPath ? { dbPath: flags.brainPath } : {}) });
  try {
    applyMigrations(handle.raw);

    // Synthesise a session + prompt + turn so the captures have anchors.
    // The retroactive scan is treated as one bulk import "session".
    const sessionId = `ingest-memory-${Date.now()}`;
    if (!flags.dryRun) {
      ensureSession(handle.raw, {
        sessionId,
        projectId: "_retroactive_",
        agentType: "codi-cli",
        workingDir: process.cwd(),
      });
    }
    const promptInfo = flags.dryRun
      ? { promptId: 0, turnNo: 0 }
      : recordPrompt(handle.raw, {
          sessionId,
          text: `(retroactive memory ingest at ${new Date().toISOString()})`,
        });
    const turnId = flags.dryRun
      ? 0
      : openTurn(handle.raw, {
          sessionId,
          promptId: promptInfo.promptId,
          turnNo: promptInfo.turnNo,
        });

    let totalScanned = 0;
    let totalInserted = 0;
    let totalDup = 0;
    const perAgent: Record<string, { scanned: number; inserted: number; duplicates: number }> = {};

    for (const src of discoverAgentMemorySources(flags.agent)) {
      const stats = { scanned: 0, inserted: 0, duplicates: 0 };
      for (const filePath of src.listFiles()) {
        if (!statSync(filePath).isFile()) continue;
        stats.scanned += 1;
        if (flags.dryRun) continue;
        const content = readFileSync(filePath, "utf-8");
        const result = ingestMemoryFile(handle.raw, {
          sessionId,
          turnId,
          promptId: promptInfo.promptId,
          agentType: src.agentType,
          filePath,
          content,
        });
        if (result.ingested) stats.inserted += 1;
        else if (result.skippedReason === "duplicate") stats.duplicates += 1;
      }
      perAgent[src.agentType] = stats;
      totalScanned += stats.scanned;
      totalInserted += stats.inserted;
      totalDup += stats.duplicates;
      log.info(
        `${src.agentType}: scanned ${stats.scanned}, inserted ${stats.inserted}, duplicates ${stats.duplicates}` +
          (flags.dryRun ? " (dry-run)" : ""),
      );
    }

    log.info(
      `Total: scanned ${totalScanned}, inserted ${totalInserted}, duplicates ${totalDup}` +
        (flags.dryRun ? " (dry-run)" : ""),
    );

    return createCommandResult({
      success: true,
      command: "brain ingest-memory",
      data: {
        scanned: totalScanned,
        inserted: totalInserted,
        duplicates: totalDup,
        perAgent,
        dryRun: flags.dryRun ?? false,
      },
      exitCode: EXIT_CODES.SUCCESS,
    });
  } finally {
    handle.close();
  }
}

// ─── Command registration ─────────────────────────────────────────────────

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

  brain
    .command("ingest-memory")
    .description(
      `Retroactively scan agent memory directories and import any unseen entries into captures. Supported agents: ${SUPPORTED_AGENT_TYPES.join(", ")}. Other agents (gemini / cursor / windsurf / copilot) degrade gracefully — they do not expose a structured memory layout.`,
    )
    .option(
      "--agent <agent>",
      `limit to one of: ${SUPPORTED_AGENT_TYPES.join(" | ")}. Default: scan all supported agents`,
    )
    .option("--brain-path <path>", "override brain DB path")
    .option("--dry-run", "scan + report counts but do not insert into captures")
    .action(async (opts: IngestMemoryFlags) => {
      const globalOpts = program.opts() as GlobalOptions;
      initFromOptions(globalOpts);
      const result = await brainIngestMemoryHandler(opts);
      handleOutput(result, globalOpts);
    });
}

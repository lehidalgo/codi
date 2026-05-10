import type { Command } from "commander";
import { spawn } from "node:child_process";
import { PROJECT_CLI } from "../constants.js";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Logger } from "../core/output/logger.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import { initFromOptions, handleOutput } from "./shared.js";
import {
  resolveAttachOrSpawn,
  DEFAULT_BRAIN_UI_PORT,
  probeHealthz,
} from "../runtime/brain-ui/index.js";
import { openBrain, applyMigrations } from "../runtime/brain/index.js";
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

/**
 * Resolve the brain-ui server entrypoint and its runner.
 *
 * Production (the cli.js was built with tsup): a bundled sibling
 * `brain-ui-server.js` is colocated next to the compiled cli.js. Plain Node
 * can run it without any experimental flag.
 *
 * Development (running `tsx src/cli.ts` directly): there is no dist sibling,
 * so we fall back to the source `.ts` script driven by the locally installed
 * tsx binary. This avoids depending on Node 24's `--experimental-strip-types`
 * which does not resolve `.js` import specifiers to `.ts` source files.
 */
function resolveBrainUiRunner(): { runner: string; script: string } {
  const distSibling = fileURLToPath(new URL("./brain-ui-server.js", import.meta.url));
  if (existsSync(distSibling)) {
    return { runner: process.execPath, script: distSibling };
  }
  const repoRoot = resolve(fileURLToPath(import.meta.url), "..", "..", "..");
  const srcScript = resolve(repoRoot, "src", "runtime", "brain-ui", "cli-server.ts");
  const tsxBin = resolve(repoRoot, "node_modules", ".bin", "tsx");
  if (!existsSync(tsxBin)) {
    throw new Error(
      `Brain UI runner unavailable: dist sibling not found at ${distSibling} and tsx not installed at ${tsxBin}. Run \`pnpm build\` or \`pnpm install\`.`,
    );
  }
  return { runner: tsxBin, script: srcScript };
}

interface BrainUiFlags {
  readonly port?: string;
  readonly brainPath?: string;
  readonly background?: boolean;
}

export async function brainUiHandler(flags: BrainUiFlags): Promise<CommandResult<BrainUiData>> {
  const log = Logger.getInstance();
  const port = flags.port ? Number(flags.port) : DEFAULT_BRAIN_UI_PORT;
  // Foreground is the default — user runs `codi brain ui` and the terminal
  // stays attached until they Ctrl+C. Pass `--background` for the legacy
  // detached-daemon behavior.
  const isForeground = flags.background !== true;
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

  // Resolve runner + script path. Production: bundled sibling in dist (plain
  // .js, runs on plain node). Dev: source .ts via local tsx. This keeps the
  // spawn flag-free and decouples it from process.cwd().
  const resolved = resolveBrainUiRunner();
  const args: string[] = [resolved.script, "--port", String(port)];
  if (flags.brainPath) {
    args.push("--brain-path", flags.brainPath);
  }
  if (isForeground) {
    args.push("--foreground");
  }

  const url = `http://127.0.0.1:${port}`;
  log.info(`Spawning brain UI at ${url}${isForeground ? " (foreground)" : ""}`);

  const child = spawn(resolved.runner, args, {
    detached: !isForeground,
    stdio: isForeground ? "inherit" : ["ignore", "ignore", "pipe"],
  });

  // Capture stderr for background spawns so we can surface the real error
  // if the daemon dies before healthz reports green. Bounded buffer prevents
  // a runaway child from filling memory.
  let stderrBuf = "";
  if (!isForeground && child.stderr) {
    child.stderr.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString("utf-8");
      if (stderrBuf.length > 8 * 1024) stderrBuf = stderrBuf.slice(-8 * 1024);
    });
  }

  if (isForeground) {
    // Foreground attaches stdio: caller blocks on the child. Returning a
    // CommandResult here is informational; the parent process will exit
    // when the child does.
    return createCommandResult({
      success: true,
      command: "brain ui",
      data: { action: "spawn", port, url, pid: child.pid ?? -1 },
      exitCode: EXIT_CODES.SUCCESS,
    });
  }

  // Background spawn: verify the daemon actually came up before reporting
  // success. Without this, a child that crashes inside main() (e.g.
  // missing native binding, port conflict, permission error) leaves the
  // CLI claiming "spawn OK" while nothing listens.
  const SPAWN_DEADLINE_MS = 5000;
  const POLL_INTERVAL_MS = 200;
  const deadline = Date.now() + SPAWN_DEADLINE_MS;
  let healthy = false;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    const probe = await probeHealthz(port, 500);
    if (probe?.ok) {
      healthy = true;
      break;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  if (!healthy) {
    if (child.exitCode === null) child.kill("SIGKILL");
    const stderrTail = stderrBuf.trim();
    return createCommandResult({
      success: false,
      command: "brain ui",
      data: { action: "spawn", port, url, pid: child.pid ?? -1 },
      errors: [
        {
          code: "E_BRAIN_UI_SPAWN_FAILED",
          message: `Brain UI failed to start within ${SPAWN_DEADLINE_MS / 1000}s.${
            stderrTail.length > 0 ? `\n\nChild stderr:\n${stderrTail}` : ""
          }`,
          hint: `Run \`${PROJECT_CLI} doctor\` to diagnose. Most common cause: missing better-sqlite3 native binding (run \`pnpm rebuild better-sqlite3\` or equivalent).`,
          severity: "error",
          context: { port },
        },
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  child.unref();
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
  _flags: BrainExportFlags,
): Promise<CommandResult<BrainExportData>> {
  const log = Logger.getInstance();
  log.warn(
    "`codi brain export` is deprecated. The legacy consolidation pipeline has been removed. Use the team-consolidation workflow instead: `codi run team-consolidation`.",
  );
  return createCommandResult({
    success: true,
    command: "brain export",
    data: { path: "", proposalsExported: 0 },
    exitCode: EXIT_CODES.SUCCESS,
  });
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
    .option("--background", "run as detached daemon (default: stay attached to terminal)")
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

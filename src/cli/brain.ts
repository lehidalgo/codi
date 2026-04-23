import type { Command } from "commander";
import os from "node:os";
import { Logger } from "../core/output/logger.js";
import {
  resolveBrainConfig,
  createBrainClient,
  BrainNetworkError,
  BrainClientError,
} from "../brain-client/index.js";

export interface BrainCommandContext {
  projectRoot: string;
}

export interface BrainStatusResult {
  success: boolean;
  data: {
    status: string;
    url?: string;
    auth: "configured" | "not-configured";
    checks?: Record<string, string>;
    version?: string;
    error?: string;
  };
}

export async function brainStatusHandler(ctx: BrainCommandContext): Promise<BrainStatusResult> {
  const cfg = await resolveBrainConfig({
    projectRoot: ctx.projectRoot,
    homeDir: os.homedir(),
  });
  if (!cfg.token) {
    return {
      success: false,
      data: {
        status: "unconfigured",
        url: cfg.url,
        auth: "not-configured",
        error: "BRAIN_BEARER_TOKEN not set; configure via env or .codi/config.yaml",
      },
    };
  }
  const client = createBrainClient({
    url: cfg.url,
    token: cfg.token,
    projectRoot: ctx.projectRoot,
    sessionId: "cli",
  });
  try {
    const h = await client.health();
    return {
      success: h.status === "ok",
      data: {
        status: h.status,
        url: cfg.url,
        auth: "configured",
        checks: h.checks,
        version: h.version,
      },
    };
  } catch (e) {
    const msg =
      e instanceof BrainNetworkError
        ? `network error: ${e.message}`
        : e instanceof BrainClientError
          ? `${e.code}: ${e.message}`
          : (e as Error).message;
    return {
      success: false,
      data: {
        status: "error",
        url: cfg.url,
        auth: "configured",
        error: msg,
      },
    };
  }
}

export interface BrainSearchResult {
  success: boolean;
  data: { hits?: unknown[]; error?: string };
}

export async function brainSearchHandler(
  ctx: BrainCommandContext & {
    q: string;
    kind?: "decision" | "hot";
    tag?: string[];
    limit?: number;
  },
): Promise<BrainSearchResult> {
  const cfg = await resolveBrainConfig({
    projectRoot: ctx.projectRoot,
    homeDir: os.homedir(),
  });
  if (!cfg.token) return { success: false, data: { error: "BRAIN_BEARER_TOKEN not set" } };
  const client = createBrainClient({
    url: cfg.url,
    token: cfg.token,
    projectRoot: ctx.projectRoot,
    sessionId: "cli",
  });
  try {
    const hits = await client.searchNotes({
      q: ctx.q,
      kind: ctx.kind,
      tag: ctx.tag,
      limit: ctx.limit,
    });
    return { success: true, data: { hits } };
  } catch (e) {
    return { success: false, data: { error: (e as Error).message } };
  }
}

export interface BrainDecideResult {
  success: boolean;
  data: { id?: string; error?: string };
}

export async function brainDecideHandler(
  ctx: BrainCommandContext & {
    title: string;
    body: string;
    tags: string[];
  },
): Promise<BrainDecideResult> {
  const cfg = await resolveBrainConfig({
    projectRoot: ctx.projectRoot,
    homeDir: os.homedir(),
  });
  if (!cfg.token) return { success: false, data: { error: "BRAIN_BEARER_TOKEN not set" } };
  const client = createBrainClient({
    url: cfg.url,
    token: cfg.token,
    projectRoot: ctx.projectRoot,
    sessionId: "cli",
  });
  try {
    const r = await client.createNote({
      kind: "decision",
      title: ctx.title,
      body: ctx.body,
      tags: ctx.tags,
      links: [],
      session_id: null,
    });
    return { success: true, data: { id: r.id } };
  } catch (e) {
    return { success: false, data: { error: (e as Error).message } };
  }
}

export interface BrainHotResult {
  success: boolean;
  data: {
    hot?: { body: string; updated_at: string | null };
    error?: string;
  };
}

export async function brainHotHandler(
  ctx: BrainCommandContext & { set?: string },
): Promise<BrainHotResult> {
  const cfg = await resolveBrainConfig({
    projectRoot: ctx.projectRoot,
    homeDir: os.homedir(),
  });
  if (!cfg.token) return { success: false, data: { error: "BRAIN_BEARER_TOKEN not set" } };
  const client = createBrainClient({
    url: cfg.url,
    token: cfg.token,
    projectRoot: ctx.projectRoot,
    sessionId: "cli",
  });
  try {
    const r = ctx.set !== undefined ? await client.putHot(ctx.set) : await client.getHot();
    return { success: true, data: { hot: r } };
  } catch (e) {
    return { success: false, data: { error: (e as Error).message } };
  }
}

export interface BrainOutboxResult {
  success: boolean;
  data: {
    count?: number;
    drained?: number;
    failed?: number;
    quarantined?: number;
    error?: string;
  };
}

export async function brainOutboxHandler(
  ctx: BrainCommandContext & { flush?: boolean },
): Promise<BrainOutboxResult> {
  const fs = await import("node:fs/promises");
  const pathMod = await import("node:path");
  const dir = pathMod.join(ctx.projectRoot, ".codi", "brain-outbox");
  let count = 0;
  try {
    const files = await fs.readdir(dir);
    count = files.filter((f) => f.endsWith(".json")).length;
  } catch {
    count = 0;
  }

  if (!ctx.flush) return { success: true, data: { count } };

  const cfg = await resolveBrainConfig({
    projectRoot: ctx.projectRoot,
    homeDir: os.homedir(),
  });
  if (!cfg.token) return { success: false, data: { error: "BRAIN_BEARER_TOKEN not set" } };
  const client = createBrainClient({
    url: cfg.url,
    token: cfg.token,
    projectRoot: ctx.projectRoot,
    sessionId: "cli",
  });

  const { drainOutbox } = await import("../brain-client/outbox.js");
  const result = await drainOutbox(ctx.projectRoot, async (entry) => {
    try {
      if (entry.method === "POST" && entry.path === "/notes") {
        await client.createNote(entry.body as Parameters<typeof client.createNote>[0]);
      } else if (entry.method === "PUT" && entry.path === "/hot") {
        await client.putHot((entry.body as { body: string }).body);
      }
      return { ok: true };
    } catch {
      return { ok: false, retryable: true };
    }
  });
  return { success: result.failed === 0, data: result };
}

export interface BrainUndoSessionResult {
  success: boolean;
  data: { tombstoned?: number; error?: string };
}

export async function brainUndoSessionHandler(
  ctx: BrainCommandContext & { sessionId: string },
): Promise<BrainUndoSessionResult> {
  const cfg = await resolveBrainConfig({
    projectRoot: ctx.projectRoot,
    homeDir: os.homedir(),
  });
  if (!cfg.token) return { success: false, data: { error: "BRAIN_BEARER_TOKEN not set" } };
  const client = createBrainClient({
    url: cfg.url,
    token: cfg.token,
    projectRoot: ctx.projectRoot,
    sessionId: "cli",
  });
  try {
    const hits = await client.searchNotes({
      tag: [`auto-extract-${ctx.sessionId}`],
      limit: 50,
    });
    const rec = await client.reconcile(hits.map((h) => h.vault_path));
    return { success: true, data: { tombstoned: rec.tombstoned } };
  } catch (e) {
    return { success: false, data: { error: (e as Error).message } };
  }
}

export function registerBrainCommand(program: Command): void {
  const brain = program.command("brain").description("Codi Brain client commands");

  brain
    .command("status")
    .description("Check Brain API reachability and auth")
    .action(async () => {
      const logger = Logger.getInstance();
      const result = await brainStatusHandler({ projectRoot: process.cwd() });
      logger.info(JSON.stringify(result.data, null, 2));
      process.exit(result.success ? 0 : 1);
    });

  brain
    .command("search <query>")
    .description("Search Brain notes")
    .option("-k, --kind <kind>", "filter by kind (decision|hot)")
    .option("-t, --tag <tag...>", "filter by tag (repeatable)")
    .option("-l, --limit <n>", "max results", "10")
    .action(
      async (query: string, opts: { kind?: "decision" | "hot"; tag?: string[]; limit: string }) => {
        const logger = Logger.getInstance();
        const result = await brainSearchHandler({
          projectRoot: process.cwd(),
          q: query,
          kind: opts.kind,
          tag: opts.tag,
          limit: Number(opts.limit),
        });
        logger.info(JSON.stringify(result.data, null, 2));
        process.exit(result.success ? 0 : 1);
      },
    );

  brain
    .command("decide <title>")
    .description("Record a decision note")
    .option("-b, --body <text>", "decision body", "")
    .option("-t, --tags <tags>", "comma-separated tags", "")
    .action(async (title: string, opts: { body: string; tags: string }) => {
      const logger = Logger.getInstance();
      const r = await brainDecideHandler({
        projectRoot: process.cwd(),
        title,
        body: opts.body,
        tags: opts.tags
          ? opts.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      });
      logger.info(JSON.stringify(r.data, null, 2));
      process.exit(r.success ? 0 : 1);
    });

  brain
    .command("hot")
    .description("Get or set hot state")
    .option("-s, --set <text>", "set hot state to text")
    .action(async (opts: { set?: string }) => {
      const logger = Logger.getInstance();
      const r = await brainHotHandler({
        projectRoot: process.cwd(),
        set: opts.set,
      });
      logger.info(JSON.stringify(r.data, null, 2));
      process.exit(r.success ? 0 : 1);
    });

  brain
    .command("outbox")
    .description("Inspect or flush the brain outbox")
    .option("-f, --flush", "flush the outbox to the brain")
    .action(async (opts: { flush?: boolean }) => {
      const logger = Logger.getInstance();
      const r = await brainOutboxHandler({
        projectRoot: process.cwd(),
        flush: !!opts.flush,
      });
      logger.info(JSON.stringify(r.data, null, 2));
      process.exit(r.success ? 0 : 1);
    });

  brain
    .command("undo-session <id>")
    .description("Soft-delete all notes tagged auto-extract-<id>")
    .action(async (id: string) => {
      const logger = Logger.getInstance();
      const r = await brainUndoSessionHandler({
        projectRoot: process.cwd(),
        sessionId: id,
      });
      logger.info(JSON.stringify(r.data, null, 2));
      process.exit(r.success ? 0 : 1);
    });
}

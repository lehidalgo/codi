import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";
import pc from "picocolors";

const PACKAGE_NAME = "codi-cli";
const CACHE_DIR = join(homedir(), ".codi-cli");
const CACHE_FILE = join(CACHE_DIR, "update-cache.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;
const FETCH_TIMEOUT_MS = 3000;

interface UpdateCache {
  checkedAt: number;
  latest: string;
}

type PackageManager = "pnpm" | "yarn" | "bun" | "npm";

async function readCache(): Promise<UpdateCache | null> {
  try {
    const raw = await readFile(CACHE_FILE, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as UpdateCache).checkedAt === "number" &&
      typeof (parsed as UpdateCache).latest === "string"
    ) {
      return parsed as UpdateCache;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeCache(cache: UpdateCache): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
  } catch {
    // cache write failure is non-fatal
  }
}

function isNewer(latest: string, current: string): boolean {
  const parse = (v: string): [number, number, number] => {
    const base = v.replace(/^v/, "").split("-")[0] ?? "";
    const parts = base.split(".");
    return [
      Number.parseInt(parts[0] ?? "0", 10) || 0,
      Number.parseInt(parts[1] ?? "0", 10) || 0,
      Number.parseInt(parts[2] ?? "0", 10) || 0,
    ];
  };
  const [la, lb, lc] = parse(latest);
  const [ca, cb, cc] = parse(current);
  if (la !== ca) return la > ca;
  if (lb !== cb) return lb > cb;
  return lc > cc;
}

async function fetchLatest(): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(REGISTRY_URL, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: unknown };
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

function detectPackageManager(): PackageManager {
  const modulePath = fileURLToPath(import.meta.url);
  const lower = modulePath.toLowerCase();
  if (lower.includes("/pnpm/") || lower.includes("\\pnpm\\")) return "pnpm";
  if (lower.includes("/yarn/") || lower.includes("\\yarn\\")) return "yarn";
  if (lower.includes("/bun/") || lower.includes("\\bun\\")) return "bun";
  return "npm";
}

function installCommand(pm: PackageManager): { cmd: string; args: string[] } {
  const target = `${PACKAGE_NAME}@latest`;
  switch (pm) {
    case "pnpm":
      return { cmd: "pnpm", args: ["add", "-g", target] };
    case "yarn":
      return { cmd: "yarn", args: ["global", "add", target] };
    case "bun":
      return { cmd: "bun", args: ["add", "-g", target] };
    default:
      return { cmd: "npm", args: ["install", "-g", target] };
  }
}

async function runInstall(pm: PackageManager): Promise<boolean> {
  const { cmd, args } = installCommand(pm);
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}

export async function checkForUpdate(currentVersion: string): Promise<void> {
  if (!process.stdout.isTTY || !process.stdin.isTTY) return;
  if (process.env.CI === "true") return;

  let cache = await readCache();
  const stale = !cache || Date.now() - cache.checkedAt >= CACHE_TTL_MS;
  if (stale) {
    const latest = await fetchLatest();
    if (latest) {
      cache = { checkedAt: Date.now(), latest };
      await writeCache(cache);
    }
  }

  if (!cache || !isNewer(cache.latest, currentVersion)) return;

  p.log.info(
    `${pc.bold("Update available")}: ${pc.dim(currentVersion)} ${pc.dim("→")} ${pc.green(cache.latest)}`,
  );

  const answer = await p.confirm({
    message: "Update codi now?",
    initialValue: true,
  });

  if (p.isCancel(answer) || !answer) return;

  const pm = detectPackageManager();
  const ok = await runInstall(pm);

  if (ok) {
    p.log.success(`Updated to ${cache.latest}. Re-run ${pc.cyan("codi")} to use the new version.`);
    p.log.info(
      `Your installed presets may have new artifacts — run ${pc.cyan("codi update")} after re-launching to refresh them.`,
    );
    process.exit(0);
  }

  const { cmd, args } = installCommand(pm);
  p.log.warn(`Install failed. Run this manually: ${pc.cyan(`${cmd} ${args.join(" ")}`)}`);
}

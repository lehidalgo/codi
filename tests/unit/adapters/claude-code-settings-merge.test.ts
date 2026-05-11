import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { claudeCodeAdapter } from "#src/adapters/claude-code.js";
import { PROJECT_NAME } from "#src/constants.js";
import { createMockConfig } from "./mock-config.js";

/**
 * Regression coverage for the deep-merge behavior added to the claude-code
 * adapter. Before the merge, `codi init` / `codi generate` overwrote the
 * user's `.claude/settings.json` greenfield style — any pre-existing user
 * hooks (PreToolUse, PostToolUse, etc.) survived only by accident through
 * the line-based conflict resolver, and codi's own runtime hooks (Stop,
 * UserPromptSubmit) silently went missing for users who already had a
 * settings.json from a non-codi template (FastAPI starters, custom
 * tooling). The brain `captures` table stayed at zero rows.
 */

interface ClaudeHookCommand {
  type: "command";
  command: string;
  timeout: number;
  async?: true;
}
interface ClaudeHookEntry {
  matcher: string;
  hooks: ClaudeHookCommand[];
}
interface ClaudeSettings {
  permissions?: { deny?: string[] };
  hooks?: Record<string, ClaudeHookEntry[]>;
  [k: string]: unknown;
}

async function generateAndReadSettings(
  projectRoot: string,
  config = createMockConfig(),
): Promise<ClaudeSettings> {
  const files = await claudeCodeAdapter.generate(config, { projectRoot });
  const settingsFile = files.find((f) => f.path === ".claude/settings.json");
  if (!settingsFile) throw new Error("settings.json not produced by adapter");
  return JSON.parse(settingsFile.content) as ClaudeSettings;
}

describe("claude-code adapter — settings.json deep merge", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(
      tmpdir(),
      `${PROJECT_NAME}-test-merge-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(join(tmpDir, ".claude"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("greenfield (no existing settings.json) emits codi hooks unchanged", async () => {
    const settings = await generateAndReadSettings(tmpDir);

    expect(settings.hooks?.Stop).toBeDefined();
    expect(settings.hooks?.UserPromptSubmit).toBeDefined();
    expect(settings.hooks?.PreToolUse).toBeDefined();
    expect(settings.hooks?.PostToolUse).toBeDefined();

    const stopCmds = settings.hooks?.Stop?.[0]?.hooks.map((h) => h.command) ?? [];
    expect(stopCmds.some((c) => c.includes("codi hook stop"))).toBe(true);
  });

  it("merges into a FastAPI-style settings.json without dropping user hooks", async () => {
    const userSettings: ClaudeSettings = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command: "/path/to/user-guard-bash.sh",
                timeout: 5,
              },
            ],
          },
        ],
        PostToolUse: [
          {
            matcher: "Edit|Write",
            hooks: [
              {
                type: "command",
                command: "/path/to/user-auto-format.sh",
                timeout: 10,
              },
            ],
          },
        ],
      },
    };
    await writeFile(
      join(tmpDir, ".claude", "settings.json"),
      JSON.stringify(userSettings, null, 2),
      "utf8",
    );

    const merged = await generateAndReadSettings(tmpDir);

    // Stop hook is the canary — without merge, it was missing entirely.
    const stopCmds = merged.hooks?.Stop?.[0]?.hooks.map((h) => h.command) ?? [];
    expect(stopCmds.some((c) => c.includes("codi hook stop"))).toBe(true);

    // UserPromptSubmit also wired
    const upsCmds = merged.hooks?.UserPromptSubmit?.[0]?.hooks.map((h) => h.command) ?? [];
    expect(upsCmds.some((c) => c.includes("codi hook user-prompt-submit"))).toBe(true);

    // User's PreToolUse(Bash) entry survives on its own matcher
    const userBashEntry = merged.hooks?.PreToolUse?.find((e) => e.matcher === "Bash");
    expect(userBashEntry).toBeDefined();
    expect(userBashEntry?.hooks.some((h) => h.command === "/path/to/user-guard-bash.sh")).toBe(
      true,
    );

    // Codi's PreToolUse(Edit|Write|NotebookEdit|Bash) is added as separate matcher
    const codiPreEntry = merged.hooks?.PreToolUse?.find(
      (e) => e.matcher === "Edit|Write|NotebookEdit|Bash",
    );
    expect(codiPreEntry).toBeDefined();
    expect(codiPreEntry?.hooks.some((h) => h.command.includes("codi hook pre-tool-use"))).toBe(
      true,
    );

    // User's PostToolUse(Edit|Write) command survives within its matcher
    const postEntry = merged.hooks?.PostToolUse?.find((e) => e.matcher === "Edit|Write");
    expect(postEntry?.hooks.some((h) => h.command === "/path/to/user-auto-format.sh")).toBe(true);
  });

  it("preserves user-added hooks on event keys codi never touches", async () => {
    const userSettings: ClaudeSettings = {
      hooks: {
        SessionStart: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command: "/path/to/session-start.sh",
                timeout: 5,
              },
            ],
          },
        ],
      },
    };
    await writeFile(
      join(tmpDir, ".claude", "settings.json"),
      JSON.stringify(userSettings, null, 2),
      "utf8",
    );

    const merged = await generateAndReadSettings(tmpDir);

    expect(merged.hooks?.SessionStart).toBeDefined();
    expect(merged.hooks?.SessionStart?.[0]?.hooks[0]?.command).toBe("/path/to/session-start.sh");
    // codi's own events still present
    expect(merged.hooks?.Stop).toBeDefined();
  });

  it("refreshes a stale codi-managed command without duplicating it", async () => {
    // Simulate an older codi version's command landing in the user file —
    // the merge must replace it with the current command, not append a
    // duplicate (otherwise every codi release would balloon the hooks
    // list with stale entries).
    const userSettings: ClaudeSettings = {
      hooks: {
        Stop: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command: "cd . && codi hook stop --agent claude-code --legacy-flag",
                timeout: 30,
              },
            ],
          },
        ],
      },
    };
    await writeFile(
      join(tmpDir, ".claude", "settings.json"),
      JSON.stringify(userSettings, null, 2),
      "utf8",
    );

    const merged = await generateAndReadSettings(tmpDir);
    const stopHooks = merged.hooks?.Stop?.[0]?.hooks ?? [];
    const stopCodiCmds = stopHooks.filter((h) => h.command.includes("codi hook stop"));
    expect(stopCodiCmds.length).toBe(1);
    expect(stopCodiCmds[0]?.command).not.toContain("--legacy-flag");
  });

  it("unions permissions.deny across user and codi without duplicates", async () => {
    const userSettings: ClaudeSettings = {
      permissions: {
        deny: ["Bash(rm -rf /)", "Bash(git push --force *)"],
      },
    };
    await writeFile(
      join(tmpDir, ".claude", "settings.json"),
      JSON.stringify(userSettings, null, 2),
      "utf8",
    );

    const merged = await generateAndReadSettings(tmpDir);
    const deny = merged.permissions?.deny ?? [];
    expect(deny).toContain("Bash(rm -rf /)");
    expect(deny).toContain("Bash(git push --force *)");
    // Codi's own deny entry added by allow_force_push: false flag is also present
    expect(deny.filter((d) => d === "Bash(git push --force *)").length).toBe(1);
  });

  it("preserves unknown top-level keys (statusLine, model, env) the user added", async () => {
    const userSettings: Record<string, unknown> = {
      statusLine: { type: "command", command: "/usr/local/bin/my-status" },
      model: "opus-4.7",
      env: { MY_VAR: "value" },
    };
    await writeFile(
      join(tmpDir, ".claude", "settings.json"),
      JSON.stringify(userSettings, null, 2),
      "utf8",
    );

    const merged = (await generateAndReadSettings(tmpDir)) as Record<string, unknown>;
    expect(merged.statusLine).toEqual({
      type: "command",
      command: "/usr/local/bin/my-status",
    });
    expect(merged.model).toBe("opus-4.7");
    expect(merged.env).toEqual({ MY_VAR: "value" });
  });

  it("malformed existing settings.json falls back to greenfield (does not crash)", async () => {
    await writeFile(join(tmpDir, ".claude", "settings.json"), "{ this is not valid json", "utf8");

    const merged = await generateAndReadSettings(tmpDir);
    // Adapter must still emit codi hooks rather than throw.
    expect(merged.hooks?.Stop).toBeDefined();
  });
});

/**
 * Plugin manifest + publishPlugin (Sprint 6.b).
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildPluginManifest,
  manifestPathForTarget,
  serializeManifest,
  publishPlugin,
  type PluginArtifact,
} from "#src/core/capabilities/index.js";

const sampleArtifacts: PluginArtifact[] = [
  { name: "codi-security", type: "rule", path: "rules/security.md" },
  { name: "codi-tdd", type: "skill", path: "skills/tdd/" },
  { name: "codi-code-reviewer", type: "agent", path: "agents/code-reviewer.md" },
  { name: "session-start", type: "hook", path: "hooks/session-start.sh" },
  { name: "/codi:commit", type: "slash-command", path: "commands/commit.md" },
  { name: "memory", type: "mcp-server", path: "mcp/memory.json" },
];

describe("buildPluginManifest", () => {
  it("emits all 6 artifact kinds for Claude Code (Tier 1A)", () => {
    const m = buildPluginManifest({
      target: "claude-code",
      codiVersion: "3.0.0",
      artifacts: sampleArtifacts,
    });
    expect(m.tier).toBe("1A");
    expect(m.artifacts).toHaveLength(6);
    expect(m.capabilitiesUsed).toEqual({
      skills: true,
      rules: true,
      agents: true,
      hooks: true,
      slashCommands: true,
      mcp: true,
    });
  });

  it("Codex CLI (Tier 1B) gets every artifact too (uiIntegration is not artifact-scoped)", () => {
    const m = buildPluginManifest({
      target: "codex-cli",
      codiVersion: "3.0.0",
      artifacts: sampleArtifacts,
    });
    expect(m.tier).toBe("1B");
    expect(m.artifacts).toHaveLength(6);
  });

  it("throws when called for a Tier 2 target", () => {
    expect(() =>
      buildPluginManifest({
        target: "cursor",
        codiVersion: "3.0.0",
        artifacts: sampleArtifacts,
      }),
    ).toThrow(/Tier 2 targets do not get a plugin manifest/);
  });
});

describe("manifestPathForTarget", () => {
  it("maps to the per-target hidden plugin directory", () => {
    expect(manifestPathForTarget("claude-code")).toBe(".claude-plugin/plugin.json");
    expect(manifestPathForTarget("codex-cli")).toBe(".codex-plugin/plugin.json");
  });
});

describe("serializeManifest", () => {
  it("produces stable, trailing-newline JSON", () => {
    const m = buildPluginManifest({
      target: "claude-code",
      codiVersion: "3.0.0",
      artifacts: sampleArtifacts.slice(0, 1),
    });
    const text = serializeManifest(m);
    expect(text.endsWith("\n")).toBe(true);
    const parsed = JSON.parse(text);
    expect(parsed.codiVersion).toBe("3.0.0");
    expect(parsed.target).toBe("claude-code");
  });
});

describe("publishPlugin", () => {
  it("writes a manifest for every Tier 1 target by default (track=local)", () => {
    const root = mkdtempSync(join(tmpdir(), "codi-pub-"));
    try {
      const result = publishPlugin({
        track: "local",
        repoRoot: root,
        codiVersion: "3.0.0",
        artifacts: sampleArtifacts,
      });
      expect(result.published.map((p) => p.target).sort()).toEqual(["claude-code", "codex-cli"]);
      expect(existsSync(join(root, ".claude-plugin", "plugin.json"))).toBe(true);
      expect(existsSync(join(root, ".codex-plugin", "plugin.json"))).toBe(true);
      const claude = JSON.parse(readFileSync(join(root, ".claude-plugin", "plugin.json"), "utf8"));
      expect(claude.target).toBe("claude-code");
      expect(claude.artifacts.length).toBe(6);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("skips Tier 2 targets with a clear reason", () => {
    const root = mkdtempSync(join(tmpdir(), "codi-pub-"));
    try {
      const result = publishPlugin({
        track: "local",
        repoRoot: root,
        codiVersion: "3.0.0",
        artifacts: sampleArtifacts,
        targets: ["claude-code", "cursor"],
      });
      expect(result.published.map((p) => p.target)).toEqual(["claude-code"]);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]!.target).toBe("cursor");
      expect(result.skipped[0]!.reason).toContain("Tier 2");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("marketplace track does not write to disk", () => {
    const root = mkdtempSync(join(tmpdir(), "codi-pub-"));
    try {
      const result = publishPlugin({
        track: "marketplace",
        repoRoot: root,
        codiVersion: "3.0.0",
        artifacts: sampleArtifacts,
      });
      expect(result.track).toBe("marketplace");
      expect(result.published.length).toBeGreaterThan(0);
      expect(existsSync(join(root, ".claude-plugin", "plugin.json"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

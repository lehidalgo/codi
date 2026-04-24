import { describe, it, expect } from "vitest";
import path from "node:path";
import { discoverArtifacts } from "#src/core/external-source/discovery.js";

const FIXTURE_ROOT = path.resolve(__dirname, "../../../fixtures/external-presets/sample-a");

describe("external-source discovery", () => {
  it("walks the standard codi layout and finds artifacts of every type", async () => {
    const artifacts = await discoverArtifacts(FIXTURE_ROOT);

    const byType = artifacts.reduce<Record<string, string[]>>((acc, a) => {
      (acc[a.type] ??= []).push(a.name);
      return acc;
    }, {});

    expect(byType["rule"]).toEqual(["sample-rule"]);
    expect(byType["agent"]).toEqual(["sample-agent"]);
    expect(byType["skill"]).toEqual(["sample-skill"]);
    expect(byType["mcp-server"]).toEqual(["sample-server"]);
  });

  it("returns absolute paths and source-relative paths", async () => {
    const artifacts = await discoverArtifacts(FIXTURE_ROOT);
    const rule = artifacts.find((a) => a.name === "sample-rule");
    expect(rule).toBeDefined();
    expect(rule!.absPath).toBe(path.join(FIXTURE_ROOT, "rules", "sample-rule.md"));
    expect(rule!.relPath).toBe(path.join("rules", "sample-rule.md"));
  });

  it("skips entries with invalid frontmatter via onSkip callback", async () => {
    const skipped: Array<{ rel: string; reason: string }> = [];
    const artifacts = await discoverArtifacts(FIXTURE_ROOT, (rel, reason) =>
      skipped.push({ rel, reason }),
    );

    expect(artifacts.find((a) => a.name === "_invalid-no-frontmatter")).toBeUndefined();
    expect(skipped).toContainEqual({
      rel: path.join("rules", "_invalid-no-frontmatter.md"),
      reason: "missing 'name' in frontmatter",
    });
  });

  it("returns an empty array for a directory with no codi-layout subdirs", async () => {
    // Use the test fixtures parent dir which has no rules/skills/agents/mcp-servers
    const parent = path.dirname(FIXTURE_ROOT);
    const artifacts = await discoverArtifacts(parent);
    expect(artifacts).toEqual([]);
  });
});

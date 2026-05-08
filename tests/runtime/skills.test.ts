import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const repoRoot = resolve(process.cwd());
const pluginManifestPath = join(repoRoot, ".claude-plugin", "plugin.json");

interface PluginManifest {
  name: string;
  version: string;
  skills: string[];
}

interface SkillFrontmatter {
  name: string;
  description: string;
  when_to_use?: string;
  "allowed-tools"?: string[];
}

interface SkillContract {
  skill_name: string;
  skill_type: string;
  workflow_type?: string;
  version: string;
  manifest_required: boolean;
  phases?: Array<{
    id: string;
    next?: string[];
    gate?: string;
    reference?: string;
    terminal?: boolean;
  }>;
  events_emitted?: string[];
}

function parseFrontmatter(skillMd: string): SkillFrontmatter {
  const match = skillMd.match(/^---\n([\s\S]+?)\n---/);
  if (!match || !match[1]) throw new Error("SKILL.md missing frontmatter");
  const raw = match[1];
  const fm: Record<string, unknown> = {};

  const lines = raw.split("\n");
  let currentKey: string | null = null;
  let currentList: string[] | null = null;

  for (const line of lines) {
    const listItem = line.match(/^\s+-\s+(.+)$/);
    if (listItem && currentList && listItem[1]) {
      currentList.push(listItem[1].trim());
      continue;
    }
    const kv = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (kv && kv[1]) {
      currentKey = kv[1];
      const value = (kv[2] ?? "").trim();
      if (value === "") {
        currentList = [];
        fm[currentKey] = currentList;
      } else {
        fm[currentKey] = value;
        currentList = null;
      }
    }
  }
  return fm as unknown as SkillFrontmatter;
}

describe("plugin manifest", () => {
  it("plugin.json exists and is valid JSON with required fields", () => {
    expect(existsSync(pluginManifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(pluginManifestPath, "utf-8")) as {
      name: string;
      description?: string;
      version?: string;
      author?: { name: string };
    };
    expect(manifest.name).toBe("devloop");
    expect(typeof manifest.description).toBe("string");
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.author?.name).toBeTruthy();
  });

  it("plugin.json does not include unsupported $schema URL", () => {
    const manifest = JSON.parse(readFileSync(pluginManifestPath, "utf-8")) as Record<
      string,
      unknown
    >;
    expect(manifest["$schema"]).toBeUndefined();
  });

  it("plugin.json does not declare hooks (those live in hooks/hooks.json)", () => {
    const manifest = JSON.parse(readFileSync(pluginManifestPath, "utf-8")) as Record<
      string,
      unknown
    >;
    expect(manifest["hooks"]).toBeUndefined();
  });

  it("every skill directory under skills/ contains a SKILL.md", () => {
    const skillsRoot = join(repoRoot, "skills");
    expect(existsSync(skillsRoot)).toBe(true);

    function walkSkillDirs(dir: string): string[] {
      const found: string[] = [];
      const fs = require("node:fs") as typeof import("node:fs");
      for (const entry of fs.readdirSync(dir)) {
        const fullPath = join(dir, entry);
        if (!statSync(fullPath).isDirectory()) continue;
        const skillMd = join(fullPath, "SKILL.md");
        if (existsSync(skillMd)) {
          found.push(fullPath);
        } else {
          found.push(...walkSkillDirs(fullPath));
        }
      }
      return found;
    }

    const skillDirs = walkSkillDirs(skillsRoot);
    expect(skillDirs.length).toBeGreaterThan(0);
    for (const dir of skillDirs) {
      expect(existsSync(join(dir, "SKILL.md")), `Missing SKILL.md in ${dir}`).toBe(true);
    }
  });
});

describe("hooks manifest", () => {
  const hooksJsonPath = join(repoRoot, "hooks", "hooks.json");

  it("hooks/hooks.json exists and is valid JSON", () => {
    expect(existsSync(hooksJsonPath)).toBe(true);
    const hooks = JSON.parse(readFileSync(hooksJsonPath, "utf-8")) as {
      hooks: Record<string, unknown[]>;
    };
    expect(typeof hooks.hooks).toBe("object");
  });

  it("only registers events from the official closed list", () => {
    const officialEvents = new Set([
      "SessionStart",
      "Setup",
      "SessionEnd",
      "UserPromptSubmit",
      "UserPromptExpansion",
      "Stop",
      "StopFailure",
      "PreToolUse",
      "PermissionRequest",
      "PermissionDenied",
      "PostToolUse",
      "PostToolUseFailure",
      "PostToolBatch",
      "FileChanged",
      "ConfigChange",
      "InstructionsLoaded",
      "CwdChanged",
      "PreCompact",
      "PostCompact",
      "Notification",
      "SubagentStart",
      "SubagentStop",
      "TaskCreated",
      "TaskCompleted",
      "WorktreeCreate",
      "WorktreeRemove",
      "Elicitation",
      "ElicitationResult",
      "TeammateIdle",
    ]);
    const hooks = JSON.parse(readFileSync(hooksJsonPath, "utf-8")) as {
      hooks: Record<string, unknown[]>;
    };
    for (const event of Object.keys(hooks.hooks)) {
      expect(officialEvents.has(event), `Unknown event: ${event}`).toBe(true);
    }
  });

  it("does not register PrePush (event does not exist)", () => {
    const hooks = JSON.parse(readFileSync(hooksJsonPath, "utf-8")) as {
      hooks: Record<string, unknown[]>;
    };
    expect(hooks.hooks["PrePush"]).toBeUndefined();
  });

  it("hook commands reference $CLAUDE_PLUGIN_ROOT for portability", () => {
    const hooks = JSON.parse(readFileSync(hooksJsonPath, "utf-8")) as {
      hooks: Record<string, Array<{ hooks: Array<{ command?: string }> }>>;
    };
    for (const eventEntries of Object.values(hooks.hooks)) {
      for (const entry of eventEntries) {
        for (const hook of entry.hooks) {
          if (hook.command) {
            expect(
              hook.command.includes("CLAUDE_PLUGIN_ROOT"),
              `Hook command should use CLAUDE_PLUGIN_ROOT: ${hook.command}`,
            ).toBe(true);
          }
        }
      }
    }
  });
});

describe("bin/devloop wrapper", () => {
  const binPath = join(repoRoot, "bin", "devloop");

  it("bin/devloop exists and is executable", () => {
    expect(existsSync(binPath)).toBe(true);
    const stat = statSync(binPath);
    // Owner execute bit (octal 0o100)
    expect((stat.mode & 0o100) !== 0).toBe(true);
  });

  it("bin/devloop references tsx and scripts/devloop.ts", () => {
    const content = readFileSync(binPath, "utf-8");
    expect(content).toContain("tsx");
    expect(content).toContain("scripts/devloop.ts");
  });
});

describe("init-knowledge-base skill", () => {
  const skillDir = join(repoRoot, "skills", "init-knowledge-base");
  const skillMdPath = join(skillDir, "SKILL.md");

  it("has SKILL.md with valid frontmatter", () => {
    const md = readFileSync(skillMdPath, "utf-8");
    const fm = parseFrontmatter(md);
    expect(fm.name).toBe("init-knowledge-base");
    expect(fm.description.length).toBeGreaterThan(0);
    expect(fm.description.length).toBeLessThanOrEqual(1024);
  });

  it("declares fork policy in contract.json (not frontmatter)", () => {
    // Per skill standard, only name/description/allowed-tools/disable-model-invocation
    // belong in frontmatter. Fork policy lives in contract.json.
    const contractPath = join(skillDir, "contract.json");
    expect(existsSync(contractPath)).toBe(true);
    const contract = JSON.parse(readFileSync(contractPath, "utf-8"));
    expect(contract.fork_policy).toBeDefined();
  });

  it("does not use reserved words in name", () => {
    const md = readFileSync(skillMdPath, "utf-8");
    const fm = parseFrontmatter(md);
    expect(fm.name.toLowerCase().includes("anthropic")).toBe(false);
    expect(fm.name.toLowerCase().includes("claude")).toBe(false);
  });

  it("CHANGELOG.md exists for the skill", () => {
    expect(existsSync(join(skillDir, "CHANGELOG.md"))).toBe(true);
  });
});

describe("feature-workflow skill", () => {
  const skillDir = join(repoRoot, "skills", "feature-workflow");
  const skillMdPath = join(skillDir, "SKILL.md");
  const contractPath = join(skillDir, "contract.json");

  it("has SKILL.md with valid frontmatter", () => {
    const md = readFileSync(skillMdPath, "utf-8");
    const fm = parseFrontmatter(md);
    expect(fm.name).toBe("feature-workflow");
    expect(typeof fm.description).toBe("string");
    expect(fm.description.length).toBeGreaterThan(0);
    expect(fm.description.length).toBeLessThanOrEqual(1024);
  });

  it("description plus when_to_use stays under 1536 chars", () => {
    const md = readFileSync(skillMdPath, "utf-8");
    const fm = parseFrontmatter(md);
    const combined = (fm.description ?? "").length + (fm.when_to_use ?? "").length;
    expect(combined).toBeLessThanOrEqual(1536);
  });

  it("description includes trigger phrases", () => {
    const md = readFileSync(skillMdPath, "utf-8");
    const fm = parseFrontmatter(md);
    const desc = fm.description.toLowerCase();
    expect(desc.includes("use when") || desc.includes("triggers")).toBe(true);
  });

  it("does not use reserved words in name", () => {
    const md = readFileSync(skillMdPath, "utf-8");
    const fm = parseFrontmatter(md);
    expect(fm.name.toLowerCase().includes("anthropic")).toBe(false);
    expect(fm.name.toLowerCase().includes("claude")).toBe(false);
  });

  it("contract.json is valid and declares feature workflow type", () => {
    const contract = JSON.parse(readFileSync(contractPath, "utf-8")) as SkillContract;
    expect(contract.skill_name).toBe("feature-workflow");
    expect(contract.skill_type).toBe("workflow");
    expect(contract.workflow_type).toBe("feature");
    expect(contract.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(contract.manifest_required).toBe(true);
  });

  it("declares 6 phases with correct ids", () => {
    const contract = JSON.parse(readFileSync(contractPath, "utf-8")) as SkillContract;
    expect(contract.phases).toBeDefined();
    expect(contract.phases?.length).toBe(6);
    const ids = contract.phases?.map((p) => p.id) ?? [];
    expect(ids).toEqual(["intent", "plan", "decompose", "execute", "verify", "done"]);
  });

  it("phases have correct next pointers", () => {
    const contract = JSON.parse(readFileSync(contractPath, "utf-8")) as SkillContract;
    const phases = contract.phases ?? [];
    expect(phases[0]?.next).toEqual(["plan"]);
    expect(phases[1]?.next).toEqual(["decompose"]);
    expect(phases[2]?.next).toEqual(["execute"]);
    expect(phases[3]?.next).toEqual(["verify"]);
    expect(phases[4]?.next).toEqual(["done"]);
    expect(phases[5]?.terminal).toBe(true);
  });

  it("references for each non-terminal phase exist", () => {
    const contract = JSON.parse(readFileSync(contractPath, "utf-8")) as SkillContract;
    for (const phase of contract.phases ?? []) {
      if (phase.terminal) continue;
      expect(phase.reference, `Phase ${phase.id} missing reference`).toBeDefined();
      const refPath = join(skillDir, phase.reference!);
      expect(existsSync(refPath), `Reference missing: ${phase.reference}`).toBe(true);
    }
  });

  it("declared events are all canonical event types", () => {
    const contract = JSON.parse(readFileSync(contractPath, "utf-8")) as SkillContract;
    const schema = JSON.parse(
      readFileSync(join(repoRoot, "schemas", "manifest-event.schema.json"), "utf-8"),
    );
    const canonicalTypes = new Set(
      (schema.oneOf as Array<{ properties: { event_type: { const: string } } }>).map(
        (v) => v.properties.event_type.const,
      ),
    );
    for (const eventType of contract.events_emitted ?? []) {
      expect(
        canonicalTypes.has(eventType),
        `Event ${eventType} is not in canonical vocabulary`,
      ).toBe(true);
    }
  });

  it("every reference file referenced by name exists", () => {
    const referenceFiles = [
      "references/phase-intent.md",
      "references/phase-plan.md",
      "references/phase-decompose.md",
      "references/phase-execute.md",
      "references/phase-verify.md",
      "references/tracer-bullets.md",
      "references/gate-feedback-format.md",
    ];
    for (const ref of referenceFiles) {
      expect(existsSync(join(skillDir, ref)), `Missing reference: ${ref}`).toBe(true);
    }
  });

  it("SKILL.md body is under 5k tokens (rough estimate by char count under 20k)", () => {
    // Anthropic guidance: SKILL.md body under 5k tokens for Level 2 loading.
    // Rough estimate: 1 token ≈ 4 chars. 5k tokens ≈ 20k chars upper bound.
    const md = readFileSync(skillMdPath, "utf-8");
    const body = md.replace(/^---\n[\s\S]+?\n---\n/, "");
    expect(body.length).toBeLessThanOrEqual(20000);
  });

  it("CHANGELOG.md exists for the skill", () => {
    expect(existsSync(join(skillDir, "CHANGELOG.md"))).toBe(true);
  });
});

# Artifact Catalog Site Integration — Implementation Plan

> **For agentic workers:** Use `codi-subagent-dev` (recommended) or `codi-plan-executor` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate all Codi artifact templates (rules, skills, agents, presets) into the Astro docs site as browsable, filterable, searchable catalog pages with individual URLs per artifact.

**Architecture:** A build-time generator writes individual `.md` files into `docs/src/content/docs/catalog/`. Astro's glob content collection renders them natively. A metadata JSON drives the client-side filter UI on the catalog index page. Skills also include their `references/*.md` content.

**Tech Stack:** TypeScript, Astro 6, `fast-glob`, existing codi CSS variables (`site/style.css`).

---

## Task 1: Add rule, agent, and preset collectors to `skill-docs-generator.ts`

**Files**: `src/core/docs/skill-docs-generator.ts`
**Est**: 4 min

**Steps**:
- [ ] 1. Write failing test in `src/core/docs/__tests__/artifact-collectors.test.ts`:
  ```typescript
  import { describe, it, expect } from "vitest";
  import {
    collectRuleEntries,
    collectAgentEntries,
    collectPresetEntries,
  } from "../skill-docs-generator.js";

  describe("collectRuleEntries", () => {
    it("returns at least 10 rules with required fields", () => {
      const entries = collectRuleEntries();
      expect(entries.length).toBeGreaterThanOrEqual(10);
      for (const e of entries) {
        expect(e.type).toBe("rule");
        expect(e.name).toBeTruthy();
        expect(e.description).toBeTruthy();
        expect(e.body).toBeTruthy();
        expect(typeof e.alwaysApply).toBe("boolean");
      }
    });
  });

  describe("collectAgentEntries", () => {
    it("returns at least 10 agents with required fields", () => {
      const entries = collectAgentEntries();
      expect(entries.length).toBeGreaterThanOrEqual(10);
      for (const e of entries) {
        expect(e.type).toBe("agent");
        expect(e.name).toBeTruthy();
        expect(e.description).toBeTruthy();
        expect(e.body).toBeTruthy();
        expect(Array.isArray(e.tools)).toBe(true);
      }
    });
  });

  describe("collectPresetEntries", () => {
    it("returns all builtin presets with required fields", () => {
      const entries = collectPresetEntries();
      expect(entries.length).toBeGreaterThanOrEqual(4);
      for (const e of entries) {
        expect(e.type).toBe("preset");
        expect(e.name).toBeTruthy();
        expect(e.description).toBeTruthy();
        expect(Array.isArray(e.tags)).toBe(true);
        expect(Array.isArray(e.rules)).toBe(true);
        expect(Array.isArray(e.skills)).toBe(true);
      }
    });
  });
  ```
- [ ] 2. Verify test fails: `pnpm test src/core/docs/__tests__/artifact-collectors.test.ts` — expected: "collectRuleEntries is not a function"
- [ ] 3. Add the following exports at the bottom of `src/core/docs/skill-docs-generator.ts`:
  ```typescript
  // ---------------------------------------------------------------------------
  // Rule entries
  // ---------------------------------------------------------------------------

  export interface RuleDocEntry {
    type: "rule";
    name: string;
    description: string;
    priority: string;
    alwaysApply: boolean;
    version: number;
    body: string;
  }

  export function collectRuleEntries(): RuleDocEntry[] {
    const entries: RuleDocEntry[] = [];

    for (const templateName of AVAILABLE_TEMPLATES) {
      const result = loadRuleTemplate(templateName);
      if (!result.ok) continue;

      const raw = result.data.replace(/\{\{name\}\}/g, templateName);
      const { data, content } = parseFrontmatter<{
        name?: string;
        description?: string;
        priority?: string;
        alwaysApply?: boolean;
        version?: number;
      }>(raw);

      entries.push({
        type: "rule",
        name: data.name ?? templateName,
        description: flattenDescription(data.description ?? ""),
        priority: data.priority ?? "medium",
        alwaysApply: data.alwaysApply !== false,
        version: data.version ?? 1,
        body: unescapeTemplateOutput(content),
      });
    }

    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }

  // ---------------------------------------------------------------------------
  // Agent entries
  // ---------------------------------------------------------------------------

  export interface AgentDocEntry {
    type: "agent";
    name: string;
    description: string;
    tools: string[];
    model: string;
    version: number;
    body: string;
  }

  export function collectAgentEntries(): AgentDocEntry[] {
    const entries: AgentDocEntry[] = [];

    for (const templateName of AVAILABLE_AGENT_TEMPLATES) {
      const result = loadAgentTemplate(templateName);
      if (!result.ok) continue;

      const raw = result.data.replace(/\{\{name\}\}/g, templateName);
      const { data, content } = parseFrontmatter<{
        name?: string;
        description?: string;
        tools?: string | string[];
        model?: string;
        version?: number;
      }>(raw);

      // tools may be YAML inline array "[Read, Grep]" or parsed array
      let tools: string[] = [];
      if (Array.isArray(data.tools)) {
        tools = data.tools as string[];
      } else if (typeof data.tools === "string") {
        tools = data.tools
          .replace(/[\[\]]/g, "")
          .split(",")
          .map((t: string) => t.trim())
          .filter(Boolean);
      }

      entries.push({
        type: "agent",
        name: data.name ?? templateName,
        description: flattenDescription(data.description ?? ""),
        tools,
        model: data.model ?? "inherit",
        version: data.version ?? 1,
        body: unescapeTemplateOutput(content),
      });
    }

    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }

  // ---------------------------------------------------------------------------
  // Preset entries
  // ---------------------------------------------------------------------------

  export interface PresetDocEntry {
    type: "preset";
    name: string;
    description: string;
    version: string;
    tags: string[];
    compatibilityAgents: string[];
    rules: string[];
    skills: string[];
    flagCount: number;
  }

  export function collectPresetEntries(): PresetDocEntry[] {
    return BUILTIN_PRESETS.map((preset) => ({
      type: "preset" as const,
      name: preset.name,
      description: preset.description,
      version: preset.version,
      tags: preset.tags ?? [],
      compatibilityAgents: preset.compatibility?.agents ?? [],
      rules: preset.rules ?? [],
      skills: preset.skills ?? [],
      flagCount: Object.keys(preset.flags ?? {}).length,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }
  ```
- [ ] 4. Add the missing imports at the top of `skill-docs-generator.ts` (after existing imports):
  ```typescript
  import { AVAILABLE_TEMPLATES, loadRuleTemplate } from "../scaffolder/template-loader.js";
  import { AVAILABLE_AGENT_TEMPLATES, loadAgentTemplate } from "../scaffolder/agent-template-loader.js";
  import { BUILTIN_PRESETS } from "#src/templates/presets/index.js";
  ```
  Note: verify `loadRuleTemplate` exists in `template-loader.ts`. If the function is named differently, use the correct name.
- [ ] 5. Verify test passes: `pnpm test src/core/docs/__tests__/artifact-collectors.test.ts` — expected: 3 passing
- [ ] 6. Commit: `git add src/core/docs/skill-docs-generator.ts src/core/docs/__tests__/artifact-collectors.test.ts && git commit -m "feat(catalog): add rule, agent, and preset collectors to skill-docs-generator"`

**Verification**: `pnpm test src/core/docs/__tests__/artifact-collectors.test.ts` — all 3 passing

---

## Task 2: Create `artifact-catalog-generator.ts` — markdown file writer + meta JSON

**Files**: `src/core/docs/artifact-catalog-generator.ts`
**Est**: 5 min

**Steps**:
- [ ] 1. Write failing test in `src/core/docs/__tests__/artifact-catalog-generator.test.ts`:
  ```typescript
  import { describe, it, expect, beforeAll, afterAll } from "vitest";
  import { mkdtemp, rm, readdir, readFile } from "node:fs/promises";
  import { join } from "node:path";
  import { tmpdir } from "node:os";
  import {
    generateCatalogMarkdownFiles,
    exportCatalogMetaJson,
  } from "../artifact-catalog-generator.js";

  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "catalog-test-"));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("generateCatalogMarkdownFiles", () => {
    it("writes markdown files for all artifact types", async () => {
      await generateCatalogMarkdownFiles(tmpDir);

      const skillsDir = join(tmpDir, "docs/src/content/docs/catalog/skills");
      const rulesDir = join(tmpDir, "docs/src/content/docs/catalog/rules");
      const agentsDir = join(tmpDir, "docs/src/content/docs/catalog/agents");
      const presetsDir = join(tmpDir, "docs/src/content/docs/catalog/presets");

      const skills = await readdir(skillsDir);
      const rules = await readdir(rulesDir);
      const agents = await readdir(agentsDir);
      const presets = await readdir(presetsDir);

      expect(skills.length).toBeGreaterThanOrEqual(40);
      expect(rules.length).toBeGreaterThanOrEqual(10);
      expect(agents.length).toBeGreaterThanOrEqual(10);
      expect(presets.length).toBeGreaterThanOrEqual(4);
    });

    it("skill markdown contains frontmatter and body", async () => {
      const skillsDir = join(tmpDir, "docs/src/content/docs/catalog/skills");
      const files = await readdir(skillsDir);
      const content = await readFile(join(skillsDir, files[0]!), "utf-8");
      expect(content).toMatch(/^---/);
      expect(content).toMatch(/artifactType: skill/);
      expect(content).toMatch(/description:/);
    });
  });

  describe("exportCatalogMetaJson", () => {
    it("returns valid JSON with all artifact types and counts", () => {
      const json = exportCatalogMetaJson();
      const data = JSON.parse(json) as {
        counts: Record<string, number>;
        artifacts: Array<{ type: string; name: string }>;
      };
      expect(data.counts.skills).toBeGreaterThanOrEqual(40);
      expect(data.counts.rules).toBeGreaterThanOrEqual(10);
      expect(data.counts.agents).toBeGreaterThanOrEqual(10);
      expect(data.counts.presets).toBeGreaterThanOrEqual(4);
      expect(data.artifacts.every((a) => a.type && a.name)).toBe(true);
    });
  });
  ```
- [ ] 2. Verify test fails: `pnpm test src/core/docs/__tests__/artifact-catalog-generator.test.ts` — expected: "Cannot find module"
- [ ] 3. Create `src/core/docs/artifact-catalog-generator.ts`:
  ```typescript
  /**
   * Generates the artifact catalog for the Astro docs site.
   *
   * Writes one Markdown file per artifact into
   * `docs/src/content/docs/catalog/{type}/{name}.md`.
   * Skills include their `references/*.md` content as appended sections.
   * Also writes a metadata-only JSON to `docs/generated/catalog-meta.json`
   * for use by the catalog index filter UI.
   */
  import { writeFile, mkdir, readdir, readFile, rm } from "node:fs/promises";
  import { join, resolve } from "node:path";
  import {
    collectSkillEntries,
    collectRuleEntries,
    collectAgentEntries,
    collectPresetEntries,
    type SkillDocEntry,
    type RuleDocEntry,
    type AgentDocEntry,
    type PresetDocEntry,
  } from "./skill-docs-generator.js";
  import { BUILTIN_PRESETS } from "#src/templates/presets/index.js";

  // ---------------------------------------------------------------------------
  // Markdown builders
  // ---------------------------------------------------------------------------

  const TEMPLATES_ROOT = resolve(
    new URL(import.meta.url).pathname,
    "../../../templates/skills",
  );

  async function readReferences(skillName: string): Promise<Array<{ filename: string; content: string }>> {
    // Strip "codi-" prefix to get the template directory name
    const dirName = skillName.replace(/^codi-/, "");
    const refsDir = join(TEMPLATES_ROOT, dirName, "references");
    try {
      const files = await readdir(refsDir);
      const mdFiles = files.filter((f) => f.endsWith(".md"));
      return Promise.all(
        mdFiles.map(async (filename) => ({
          filename,
          content: await readFile(join(refsDir, filename), "utf-8"),
        })),
      );
    } catch {
      return [];
    }
  }

  function yamlList(items: string[]): string {
    if (items.length === 0) return "[]";
    return "\n" + items.map((i) => `  - ${i}`).join("\n");
  }

  async function buildSkillMarkdown(entry: SkillDocEntry): Promise<string> {
    const references = await readReferences(entry.name);
    const compat = entry.compatibility.length > 0 ? yamlList(entry.compatibility) : "[]";

    let md = `---
title: ${entry.name}
description: >
  ${entry.description.replace(/\n/g, "\n  ")}
sidebar:
  label: "${entry.name}"
artifactType: skill
artifactCategory: ${entry.category}
userInvocable: ${entry.userInvocable}
compatibility:${compat}
version: ${entry.version}
---

${entry.body}`;

    for (const ref of references) {
      const heading = ref.filename.replace(/\.md$/, "").replace(/-/g, " ");
      md += `\n\n---\n\n## Reference: ${heading}\n\n${ref.content}`;
    }

    return md;
  }

  function buildRuleMarkdown(entry: RuleDocEntry): string {
    return `---
title: ${entry.name}
description: >
  ${entry.description.replace(/\n/g, "\n  ")}
sidebar:
  label: "${entry.name}"
artifactType: rule
priority: ${entry.priority}
alwaysApply: ${entry.alwaysApply}
version: ${entry.version}
---

${entry.body}`;
  }

  function buildAgentMarkdown(entry: AgentDocEntry): string {
    const tools = entry.tools.length > 0 ? yamlList(entry.tools) : "[]";
    return `---
title: ${entry.name}
description: >
  ${entry.description.replace(/\n/g, "\n  ")}
sidebar:
  label: "${entry.name}"
artifactType: agent
tools:${tools}
model: ${entry.model}
version: ${entry.version}
---

${entry.body}`;
  }

  function buildPresetMarkdown(entry: PresetDocEntry): string {
    const preset = BUILTIN_PRESETS.find((p) => p.name === entry.name);
    const flagRows = preset
      ? Object.entries(preset.flags ?? {})
          .map(([key, def]) => `| \`${key}\` | \`${String(def.value)}\` |`)
          .join("\n")
      : "";

    const body = [
      "## Included Rules\n",
      entry.rules.length > 0
        ? entry.rules.map((r) => `\`${r}\``).join(", ")
        : "_none_",
      "\n## Included Skills\n",
      entry.skills.length > 0
        ? entry.skills.map((s) => `\`${s}\``).join(", ")
        : "_none_",
      "\n## Flag Configuration\n",
      "| Flag | Value |",
      "|------|-------|",
      flagRows,
    ].join("\n");

    const agents = entry.compatibilityAgents.length > 0
      ? yamlList(entry.compatibilityAgents)
      : "[]";
    const tags = entry.tags.length > 0 ? yamlList(entry.tags) : "[]";

    return `---
title: ${entry.name}
description: >
  ${entry.description.replace(/\n/g, "\n  ")}
sidebar:
  label: "${entry.name}"
artifactType: preset
version: "${entry.version}"
tags:${tags}
compatibilityAgents:${agents}
---

${body}`;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Write all artifact markdown files to `<projectRoot>/docs/src/content/docs/catalog/`.
   * Clears the catalog directory first to remove stale files from previous runs.
   */
  export async function generateCatalogMarkdownFiles(projectRoot: string): Promise<void> {
    const catalogRoot = join(projectRoot, "docs/src/content/docs/catalog");

    // Clear stale files
    await rm(catalogRoot, { recursive: true, force: true });

    const subdirs = ["skills", "rules", "agents", "presets"];
    await Promise.all(subdirs.map((d) => mkdir(join(catalogRoot, d), { recursive: true })));

    const skillEntries = collectSkillEntries();
    const ruleEntries = collectRuleEntries();
    const agentEntries = collectAgentEntries();
    const presetEntries = collectPresetEntries();

    await Promise.all([
      ...skillEntries.map(async (e) => {
        const content = await buildSkillMarkdown(e);
        return writeFile(join(catalogRoot, "skills", `${e.name}.md`), content, "utf-8");
      }),
      ...ruleEntries.map((e) =>
        writeFile(join(catalogRoot, "rules", `${e.name}.md`), buildRuleMarkdown(e), "utf-8"),
      ),
      ...agentEntries.map((e) =>
        writeFile(join(catalogRoot, "agents", `${e.name}.md`), buildAgentMarkdown(e), "utf-8"),
      ),
      ...presetEntries.map((e) =>
        writeFile(join(catalogRoot, "presets", `${e.name}.md`), buildPresetMarkdown(e), "utf-8"),
      ),
    ]);
  }

  /**
   * Export metadata-only JSON catalog (no bodies) for the filter UI.
   */
  export function exportCatalogMetaJson(): string {
    const skills = collectSkillEntries();
    const rules = collectRuleEntries();
    const agents = collectAgentEntries();
    const presets = collectPresetEntries();

    const allCategories = [...new Set(skills.map((s) => s.category))].sort();
    const allCompatibilities = [
      ...new Set(skills.flatMap((s) => s.compatibility)),
    ].sort();

    const artifacts = [
      ...skills.map((e) => ({
        type: "skill",
        name: e.name,
        description: e.description,
        slug: `catalog/skills/${e.name}`,
        category: e.category,
        userInvocable: e.userInvocable,
        compatibility: e.compatibility,
        version: e.version,
      })),
      ...rules.map((e) => ({
        type: "rule",
        name: e.name,
        description: e.description,
        slug: `catalog/rules/${e.name}`,
        priority: e.priority,
        alwaysApply: e.alwaysApply,
        version: e.version,
      })),
      ...agents.map((e) => ({
        type: "agent",
        name: e.name,
        description: e.description,
        slug: `catalog/agents/${e.name}`,
        tools: e.tools,
        model: e.model,
        version: e.version,
      })),
      ...presets.map((e) => ({
        type: "preset",
        name: e.name,
        description: e.description,
        slug: `catalog/presets/${e.name}`,
        tags: e.tags,
        compatibilityAgents: e.compatibilityAgents,
        version: e.version,
      })),
    ];

    return JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        counts: {
          skills: skills.length,
          rules: rules.length,
          agents: agents.length,
          presets: presets.length,
        },
        categories: allCategories,
        compatibilities: allCompatibilities,
        artifacts,
      },
      null,
      2,
    );
  }

  /**
   * Write `docs/generated/catalog-meta.json` to disk.
   */
  export async function writeCatalogMetaJson(projectRoot: string): Promise<string> {
    const outDir = join(projectRoot, "docs/generated");
    await mkdir(outDir, { recursive: true });
    const outPath = join(outDir, "catalog-meta.json");
    await writeFile(outPath, exportCatalogMetaJson(), "utf-8");
    return outPath;
  }
  ```
- [ ] 4. Verify test passes: `pnpm test src/core/docs/__tests__/artifact-catalog-generator.test.ts` — expected: 4 passing
- [ ] 5. Run TypeScript check: `npx tsc --noEmit` — expected: no errors
- [ ] 6. Commit: `git add src/core/docs/artifact-catalog-generator.ts src/core/docs/__tests__/artifact-catalog-generator.test.ts && git commit -m "feat(catalog): add artifact-catalog-generator with markdown file writer and meta JSON"`

**Verification**: `pnpm test src/core/docs/__tests__/artifact-catalog-generator.test.ts` — all 4 passing

---

## Task 3: Wire `--catalog` flag into `codi docs` CLI

**Files**: `src/cli/docs.ts`
**Est**: 3 min

**Steps**:
- [ ] 1. Write failing test in `src/cli/__tests__/docs-catalog.test.ts`:
  ```typescript
  import { describe, it, expect, vi } from "vitest";
  import { docsHandler } from "../docs.js";

  vi.mock("../../core/docs/artifact-catalog-generator.js", () => ({
    generateCatalogMarkdownFiles: vi.fn().mockResolvedValue(undefined),
    writeCatalogMetaJson: vi.fn().mockResolvedValue("/tmp/catalog-meta.json"),
  }));

  describe("docsHandler --catalog", () => {
    it("calls catalog generators and returns success", async () => {
      const result = await docsHandler("/tmp/test-project", { catalog: true });
      expect(result.success).toBe(true);
      expect(result.data?.outputPath).toBeTruthy();
    });
  });
  ```
- [ ] 2. Verify test fails: `pnpm test src/cli/__tests__/docs-catalog.test.ts` — expected: "catalog is not a valid option"
- [ ] 3. In `src/cli/docs.ts`, add `catalog?: boolean` to `DocsCommandOptions`:
  ```typescript
  interface DocsCommandOptions extends GlobalOptions {
    output?: string;
    json?: boolean;
    html?: boolean;
    generate?: boolean;
    validate?: boolean;
    catalog?: boolean;  // add this
  }
  ```
- [ ] 4. In `docsHandler`, add the `--catalog` branch before the `--validate` branch:
  ```typescript
  // --catalog: generate markdown pages + meta JSON
  if (options.catalog) {
    const { generateCatalogMarkdownFiles, writeCatalogMetaJson } = await import(
      "../core/docs/artifact-catalog-generator.js"
    );
    await generateCatalogMarkdownFiles(projectRoot);
    const metaPath = await writeCatalogMetaJson(projectRoot);
    return createCommandResult({
      success: true,
      command: "docs",
      data: { outputPath: metaPath, totalSkills: 0 },
      exitCode: EXIT_CODES.SUCCESS,
    });
  }
  ```
- [ ] 5. In `registerDocsCommand`, add the new option:
  ```typescript
  .option("--catalog", "Generate artifact catalog markdown pages and meta JSON")
  ```
- [ ] 6. Verify test passes: `pnpm test src/cli/__tests__/docs-catalog.test.ts` — expected: 1 passing
- [ ] 7. Run TypeScript check: `npx tsc --noEmit` — expected: no errors
- [ ] 8. Commit: `git add src/cli/docs.ts src/cli/__tests__/docs-catalog.test.ts && git commit -m "feat(catalog): add --catalog flag to codi docs command"`

**Verification**: `pnpm test src/cli/__tests__/docs-catalog.test.ts` — 1 passing

---

## Task 4: Update `.gitignore`, `content.config.ts`, and `docs:build` script

**Files**: `.gitignore`, `docs/src/content.config.ts`, `package.json`
**Est**: 2 min

**Steps**:
- [ ] 1. Add to `.gitignore` (after existing doc-related entries):
  ```
  # Artifact catalog — generated at build time
  docs/src/content/docs/catalog/
  docs/generated/
  ```
- [ ] 2. In `docs/src/content.config.ts`, extend the schema to include artifact fields:
  ```typescript
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    sidebar: z.object({
      order: z.number().optional(),
      label: z.string().optional(),
    }).optional(),
    // Artifact catalog fields
    artifactType: z.enum(["skill", "rule", "agent", "preset"]).optional(),
    artifactCategory: z.string().optional(),
    userInvocable: z.boolean().optional(),
    compatibility: z.array(z.string()).optional(),
    compatibilityAgents: z.array(z.string()).optional(),
    priority: z.string().optional(),
    alwaysApply: z.boolean().optional(),
    tools: z.array(z.string()).optional(),
    model: z.string().optional(),
    tags: z.array(z.string()).optional(),
    version: z.union([z.number(), z.string()]).optional(),
  }).passthrough(),
  ```
- [ ] 3. In `package.json`, update `docs:build` to run catalog generation first:
  ```json
  "docs:build": "node dist/cli.js docs --catalog && typedoc && astro build"
  ```
  Note: `dist/cli.js` must exist (run `pnpm build` first). The final pipeline order is: catalog → typedoc → astro build.
- [ ] 4. Verify `.gitignore` works: `git check-ignore -v docs/src/content/docs/catalog/` — expected: prints the ignore rule
- [ ] 5. Run TypeScript check: `npx tsc --noEmit` — expected: no errors
- [ ] 6. Commit: `git add .gitignore docs/src/content.config.ts package.json && git commit -m "chore(catalog): gitignore generated catalog dir, extend content schema, update docs:build script"`

**Verification**: `npx tsc --noEmit` — no errors; `git check-ignore docs/src/content/docs/catalog/` — ignored

---

## Task 5: Create `docs/src/pages/catalog.astro` — catalog index with filter UI

**Files**: `docs/src/pages/catalog.astro`
**Est**: 5 min

**Steps**:
- [ ] 1. First generate the meta JSON so the page can import it:
  ```bash
  pnpm build && node dist/cli.js docs --catalog
  ```
  Expected: `docs/generated/catalog-meta.json` exists with 120+ artifacts.
- [ ] 2. Create `docs/src/pages/catalog.astro`:
  ```astro
  ---
  import DocsLayout from '../layouts/DocsLayout.astro';
  import catalogMeta from '../../generated/catalog-meta.json';

  const base = import.meta.env.BASE_URL;
  const { counts, artifacts, categories, compatibilities } = catalogMeta as {
    counts: Record<string, number>;
    categories: string[];
    compatibilities: string[];
    artifacts: Array<{
      type: string;
      name: string;
      description: string;
      slug: string;
      category?: string;
      userInvocable?: boolean;
      compatibility?: string[];
      priority?: string;
      tools?: string[];
      tags?: string[];
      version: number | string;
    }>;
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  ---

  <DocsLayout title="Artifact Catalog" description="Browse all Codi rules, skills, agents, and presets">
    <div class="catalog-header">
      <h1>Artifact Catalog</h1>
      <p class="catalog-subtitle">{total} artifacts — rules, skills, agents, and presets</p>
    </div>

    <div class="catalog-controls">
      <!-- Type tabs -->
      <div class="type-tabs" role="tablist" aria-label="Artifact type">
        <button class="type-tab active" data-type="all" role="tab">All <span class="tab-count">{total}</span></button>
        <button class="type-tab" data-type="skill" role="tab">Skills <span class="tab-count">{counts.skills}</span></button>
        <button class="type-tab" data-type="rule" role="tab">Rules <span class="tab-count">{counts.rules}</span></button>
        <button class="type-tab" data-type="agent" role="tab">Agents <span class="tab-count">{counts.agents}</span></button>
        <button class="type-tab" data-type="preset" role="tab">Presets <span class="tab-count">{counts.presets}</span></button>
      </div>

      <!-- Search -->
      <input
        type="search"
        id="catalog-search"
        class="catalog-search"
        placeholder="Search artifacts..."
        aria-label="Search artifacts"
      />

      <!-- Category chips (hidden unless skill/rule tab active) -->
      <div class="filter-row" id="category-row">
        <span class="filter-label">Category</span>
        <div class="chips">
          {categories.map((cat) => (
            <button class="chip" data-filter="category" data-value={cat}>{cat.replace(/_/g, ' ')}</button>
          ))}
        </div>
      </div>

      <!-- Compatibility chips (hidden unless skill/agent tab) -->
      <div class="filter-row" id="compat-row">
        <span class="filter-label">Compatibility</span>
        <div class="chips">
          {compatibilities.map((c) => (
            <button class="chip" data-filter="compat" data-value={c}>{c}</button>
          ))}
        </div>
      </div>

      <!-- User-invocable toggle -->
      <div class="filter-row" id="invocable-row">
        <label class="toggle-label">
          <input type="checkbox" id="invocable-toggle" />
          User-invocable skills only
        </label>
      </div>
    </div>

    <!-- Results count -->
    <p class="results-count" id="results-count"></p>

    <!-- Artifact cards -->
    <div class="catalog-grid" id="catalog-grid">
      {artifacts.map((a) => (
        <a
          href={`${base}${a.slug}/`}
          class="artifact-card"
          data-type={a.type}
          data-category={a.category ?? ''}
          data-compat={(a.compatibility ?? []).join(',')}
          data-invocable={String(a.userInvocable ?? false)}
        >
          <div class="card-top">
            <span class={`type-badge type-${a.type}`}>{a.type}</span>
            {a.category && <span class="cat-badge">{a.category.replace(/_/g, ' ')}</span>}
          </div>
          <h3 class="card-name">{a.name}</h3>
          <p class="card-desc">{a.description}</p>
          {(a.compatibility ?? []).length > 0 && (
            <div class="compat-badges">
              {(a.compatibility ?? []).slice(0, 4).map((c) => (
                <span class="compat-badge">{c}</span>
              ))}
            </div>
          )}
          {(a.tags ?? []).length > 0 && (
            <div class="compat-badges">
              {(a.tags ?? []).map((t) => (
                <span class="compat-badge">{t}</span>
              ))}
            </div>
          )}
        </a>
      ))}
    </div>
  </DocsLayout>

  <style>
    .catalog-header { margin-bottom: 1.5rem; }
    .catalog-header h1 { font-size: 2rem; margin-bottom: 0.25rem; }
    .catalog-subtitle { color: var(--text-2); font-size: 0.95rem; }

    .catalog-controls { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; }

    .type-tabs { display: flex; gap: 0.25rem; flex-wrap: wrap; }
    .type-tab {
      padding: 0.4rem 0.9rem; border-radius: 6px; font-size: 0.85rem;
      background: var(--surface-2); border: 1px solid var(--border);
      color: var(--text-2); cursor: pointer; transition: all 0.15s;
    }
    .type-tab:hover { border-color: var(--c0); color: var(--text-1); }
    .type-tab.active { background: var(--surface-3); border-color: var(--c0); color: var(--c0); }
    .tab-count { opacity: 0.7; margin-left: 0.3rem; }

    .catalog-search {
      width: 100%; padding: 0.6rem 1rem; border-radius: 8px;
      background: var(--surface-2); border: 1px solid var(--border);
      color: var(--text-1); font-size: 0.95rem; outline: none;
    }
    .catalog-search:focus { border-color: var(--c0); }

    .filter-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .filter-label { font-size: 0.8rem; color: var(--text-2); white-space: nowrap; }

    .chips { display: flex; gap: 0.3rem; flex-wrap: wrap; }
    .chip {
      padding: 0.2rem 0.65rem; border-radius: 20px; font-size: 0.75rem;
      background: var(--surface-2); border: 1px solid var(--border);
      color: var(--text-2); cursor: pointer; transition: all 0.15s;
    }
    .chip:hover { border-color: var(--c0); color: var(--text-1); }
    .chip.active { background: color-mix(in srgb, var(--c0) 15%, transparent); border-color: var(--c0); color: var(--c0); }

    .toggle-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--text-2); cursor: pointer; }

    .results-count { font-size: 0.85rem; color: var(--text-2); margin-bottom: 1rem; }

    .catalog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }

    .artifact-card {
      display: block; padding: 1.25rem; border-radius: 10px;
      background: var(--surface-2); border: 1px solid var(--border);
      transition: border-color 0.15s, transform 0.1s; text-decoration: none;
    }
    .artifact-card:hover { border-color: var(--c0); transform: translateY(-1px); }
    .artifact-card[hidden] { display: none; }

    .card-top { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.6rem; }
    .type-badge {
      font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 4px;
      font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
    }
    .type-skill  { background: color-mix(in srgb, var(--c0) 15%, transparent); color: var(--c0); }
    .type-rule   { background: color-mix(in srgb, var(--green) 15%, transparent); color: var(--green); }
    .type-agent  { background: color-mix(in srgb, var(--c1) 15%, transparent); color: var(--c1); }
    .type-preset { background: color-mix(in srgb, var(--yellow) 15%, transparent); color: var(--yellow); }

    .cat-badge { font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 4px; background: var(--surface-3); color: var(--text-2); }

    .card-name { font-size: 0.95rem; font-weight: 600; margin-bottom: 0.4rem; color: var(--text-1); }
    .card-desc { font-size: 0.82rem; color: var(--text-2); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

    .compat-badges { display: flex; gap: 0.25rem; flex-wrap: wrap; margin-top: 0.6rem; }
    .compat-badge { font-size: 0.68rem; padding: 0.1rem 0.45rem; border-radius: 12px; background: var(--surface-3); color: var(--text-2); }
  </style>

  <script>
    const grid = document.getElementById('catalog-grid')!;
    const cards = Array.from(grid.querySelectorAll<HTMLAnchorElement>('.artifact-card'));
    const searchInput = document.getElementById('catalog-search') as HTMLInputElement;
    const resultsCount = document.getElementById('results-count')!;
    const invocableToggle = document.getElementById('invocable-toggle') as HTMLInputElement;

    let activeType = 'all';
    let activeCategories = new Set<string>();
    let activeCompats = new Set<string>();
    let invocableOnly = false;
    let searchQuery = '';

    function applyFilters() {
      let visible = 0;
      for (const card of cards) {
        const type = card.dataset['type'] ?? '';
        const category = card.dataset['category'] ?? '';
        const compat = card.dataset['compat'] ?? '';
        const invocable = card.dataset['invocable'] === 'true';
        const text = ((card.querySelector('.card-name')?.textContent ?? '') +
          ' ' + (card.querySelector('.card-desc')?.textContent ?? '')).toLowerCase();

        const matchType = activeType === 'all' || type === activeType;
        const matchCat = activeCategories.size === 0 || activeCategories.has(category);
        const matchCompat = activeCompats.size === 0 ||
          [...activeCompats].every((c) => compat.split(',').includes(c));
        const matchInvocable = !invocableOnly || invocable;
        const matchSearch = searchQuery === '' || text.includes(searchQuery);

        const show = matchType && matchCat && matchCompat && matchInvocable && matchSearch;
        card.hidden = !show;
        if (show) visible++;
      }
      resultsCount.textContent = `${visible} artifact${visible !== 1 ? 's' : ''}`;
    }

    // Type tabs
    document.querySelectorAll<HTMLButtonElement>('.type-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.type-tab').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeType = btn.dataset['type'] ?? 'all';
        // Show/hide filter rows based on type
        const showCat = ['all', 'skill', 'rule'].includes(activeType);
        const showCompat = ['all', 'skill', 'agent'].includes(activeType);
        const showInvocable = ['all', 'skill'].includes(activeType);
        (document.getElementById('category-row') as HTMLElement).style.display = showCat ? '' : 'none';
        (document.getElementById('compat-row') as HTMLElement).style.display = showCompat ? '' : 'none';
        (document.getElementById('invocable-row') as HTMLElement).style.display = showInvocable ? '' : 'none';
        applyFilters();
      });
    });

    // Filter chips
    document.querySelectorAll<HTMLButtonElement>('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('active');
        const filter = chip.dataset['filter']!;
        const value = chip.dataset['value']!;
        const set = filter === 'category' ? activeCategories : activeCompats;
        set.has(value) ? set.delete(value) : set.add(value);
        applyFilters();
      });
    });

    // Search
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value.toLowerCase().trim();
      applyFilters();
    });

    // Invocable toggle
    invocableToggle.addEventListener('change', () => {
      invocableOnly = invocableToggle.checked;
      applyFilters();
    });

    // Initial count
    applyFilters();
  </script>
  ```
- [ ] 3. Verify the page builds without error: `pnpm run docs:check` — expected: no Astro type errors
- [ ] 4. Commit: `git add docs/src/pages/catalog.astro && git commit -m "feat(catalog): add catalog index page with type tabs, category chips, and search"`

**Verification**: `pnpm run docs:check` — no errors

---

## Task 6: Update `DocsLayout.astro` — add Catalog link to sidebar

**Files**: `docs/src/layouts/DocsLayout.astro`
**Est**: 2 min

**Steps**:
- [ ] 1. In `DocsLayout.astro`, add `catalog` to the sidebar **as a static link** (not a content collection group, since we don't want 120+ individual entries in the sidebar). Find the `<aside class="docs-sidebar">` section and add a static "Catalog" nav group before the dynamic groups:
  ```html
  <nav aria-label="Documentation navigation">
    <!-- Static catalog link -->
    <div class="docs-nav-group">
      <div class="docs-nav-label">Browse</div>
      <a href={`${base}catalog/`} class={`docs-nav-link${currentPath === base.replace(/\/$/, '') + '/catalog' ? ' active' : ''}`}>
        Artifact Catalog
      </a>
    </div>

    <!-- existing dynamic groups -->
    {GROUP_ORDER.filter(g => groups[g]?.length).map(group => ( ... ))}
  </nav>
  ```
- [ ] 2. Also add a "Catalog" tab to the top nav links (in `<div class="nav-links">`), after the existing "Docs" link:
  ```html
  <a href={`${base}catalog/`}>Catalog</a>
  ```
- [ ] 3. Verify the layout compiles: `pnpm run docs:check` — expected: no errors
- [ ] 4. Commit: `git add docs/src/layouts/DocsLayout.astro && git commit -m "feat(catalog): add Catalog link to docs sidebar and top nav"`

**Verification**: `pnpm run docs:check` — no errors

---

## Task 7: End-to-end build verification

**Files**: none (integration check)
**Est**: 3 min

**Steps**:
- [ ] 1. Build the CLI: `pnpm build`
- [ ] 2. Run catalog generation: `node dist/cli.js docs --catalog`
  Expected output: success message, `docs/generated/catalog-meta.json` exists.
  Verify: `ls docs/src/content/docs/catalog/skills | wc -l` — expected: 40+
- [ ] 3. Run Astro build: `pnpm run docs:build`
  Expected: builds without errors, outputs to `site/docs/`
- [ ] 4. Preview: `pnpm run docs:preview`
  Manually verify:
  - `http://localhost:4321/codi/docs/catalog/` loads with cards
  - Type tabs filter correctly
  - Search filters by name and description
  - A skill link (e.g. `codi-brainstorming`) navigates to its individual page
  - The individual page renders the full skill body with references appended
  - The sidebar shows "Artifact Catalog" under "Browse"
- [ ] 5. Commit: `git add -A && git commit -m "chore(catalog): verify end-to-end catalog build and update generated assets"`

**Verification**: `pnpm run docs:build` exits 0; all pages render correctly in preview

import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  CHAIN_BLOCK_BEGIN,
  CHAIN_BLOCK_END,
  chainSectionHash,
  extractChainBlock,
  regeneratePhaseRefs,
  renderChainLine,
  renderChainSection,
} from "#src/runtime/brain/render-chains.js";
import type { ChainEntry, WorkflowDefinitionShape } from "#src/runtime/brain/seed-workflows.js";

describe("renderChainLine — per-role templates", () => {
  it("required without hint", () => {
    const out = renderChainLine({ skill: "discover", role: "required" });
    expect(out).toBe("- You **MUST** invoke `codi:discover`.");
  });

  it("required with hint", () => {
    const out = renderChainLine({
      skill: "plan-writing",
      role: "required",
      hint: "include rollback path",
    });
    expect(out).toBe("- You **MUST** invoke `codi:plan-writing` (include rollback path).");
  });

  it("alt-entry with hint (always required by validator)", () => {
    const out = renderChainLine({
      skill: "brainstorming",
      role: "alt-entry",
      hint: "no workflow context needed",
    });
    expect(out).toBe("- Alternatively, invoke `codi:brainstorming` if no workflow context needed.");
  });

  it("optional with hint (always required by validator)", () => {
    const out = renderChainLine({
      skill: "worktrees",
      role: "optional",
      hint: "≥3 files",
    });
    expect(out).toBe("- Optionally, invoke `codi:worktrees` when ≥3 files.");
  });

  it("renderChainLine throws on alt-entry without hint (defense in depth)", () => {
    expect(() => renderChainLine({ skill: "x", role: "alt-entry" } as ChainEntry)).toThrow(
      /role 'alt-entry' requires a hint/,
    );
  });

  it("renderChainLine throws on optional without hint (defense in depth)", () => {
    expect(() => renderChainLine({ skill: "x", role: "optional" } as ChainEntry)).toThrow(
      /role 'optional' requires a hint/,
    );
  });
});

describe("renderChainSection — full block", () => {
  it("wraps content in BEGIN/END markers", () => {
    const out = renderChainSection([{ skill: "discover", role: "required" }]);
    expect(out).toContain(CHAIN_BLOCK_BEGIN);
    expect(out).toContain(CHAIN_BLOCK_END);
    expect(out.indexOf(CHAIN_BLOCK_BEGIN)).toBeLessThan(out.indexOf(CHAIN_BLOCK_END));
  });

  it("emits a heading and bullets", () => {
    const out = renderChainSection([
      { skill: "discover", role: "required" },
      { skill: "step-documenter", role: "optional", hint: "domain terms emerge" },
    ]);
    expect(out).toContain("## Chain skills");
    expect(out).toContain("- You **MUST** invoke `codi:discover`.");
    expect(out).toContain("- Optionally, invoke `codi:step-documenter` when domain terms emerge.");
  });

  it("renders an empty placeholder for phases with no chains", () => {
    const out = renderChainSection([]);
    expect(out).toContain("_No chained skills declared for this phase._");
    expect(out).toContain(CHAIN_BLOCK_BEGIN);
    expect(out).toContain(CHAIN_BLOCK_END);
  });

  it("preserves entry order from the chains array", () => {
    const out = renderChainSection([
      { skill: "a", role: "required" },
      { skill: "b", role: "alt-entry", hint: "hint b" },
      { skill: "c", role: "optional", hint: "hint c" },
    ]);
    const aIdx = out.indexOf("`codi:a`");
    const bIdx = out.indexOf("`codi:b`");
    const cIdx = out.indexOf("`codi:c`");
    expect(aIdx).toBeLessThan(bIdx);
    expect(bIdx).toBeLessThan(cIdx);
  });

  it("snapshot — typical feature.intent block", () => {
    const out = renderChainSection([
      { skill: "discover", role: "required" },
      { skill: "step-documenter", role: "optional", hint: "domain terms emerge inline" },
    ]);
    expect(out).toMatchInlineSnapshot(`
      "<!-- BEGIN auto-generated chain — DO NOT EDIT -->

      ## Chain skills

      - You **MUST** invoke \`codi:discover\`.
      - Optionally, invoke \`codi:step-documenter\` when domain terms emerge inline.

      <!-- END auto-generated chain -->"
    `);
  });

  it("snapshot — feature.plan with required+alt-entry+two optionals", () => {
    const out = renderChainSection([
      { skill: "plan-writing", role: "required" },
      { skill: "discover", role: "alt-entry", hint: "plan needs sharpening — mode sharpen" },
      { skill: "gate-plan-coverage", role: "optional", hint: "before transition to decompose" },
      { skill: "gate-deep-modules", role: "optional", hint: "structural concerns surface" },
    ]);
    expect(out).toMatchInlineSnapshot(`
      "<!-- BEGIN auto-generated chain — DO NOT EDIT -->

      ## Chain skills

      - You **MUST** invoke \`codi:plan-writing\`.
      - Alternatively, invoke \`codi:discover\` if plan needs sharpening — mode sharpen.
      - Optionally, invoke \`codi:gate-plan-coverage\` when before transition to decompose.
      - Optionally, invoke \`codi:gate-deep-modules\` when structural concerns surface.

      <!-- END auto-generated chain -->"
    `);
  });
});

describe("chainSectionHash — drift detection", () => {
  it("is deterministic for identical chains", () => {
    const chains: ChainEntry[] = [{ skill: "discover", role: "required" }];
    const a = chainSectionHash(renderChainSection(chains));
    const b = chainSectionHash(renderChainSection(chains));
    expect(a).toBe(b);
  });

  it("differs when entry order changes", () => {
    const a = chainSectionHash(
      renderChainSection([
        { skill: "a", role: "required" },
        { skill: "b", role: "optional", hint: "h" },
      ]),
    );
    const b = chainSectionHash(
      renderChainSection([
        { skill: "b", role: "optional", hint: "h" },
        { skill: "a", role: "required" },
      ]),
    );
    expect(a).not.toBe(b);
  });

  it("differs when a hint changes", () => {
    const a = chainSectionHash(
      renderChainSection([{ skill: "x", role: "optional", hint: "before" }]),
    );
    const b = chainSectionHash(
      renderChainSection([{ skill: "x", role: "optional", hint: "after" }]),
    );
    expect(a).not.toBe(b);
  });

  it("returns a 64-char hex string (sha256)", () => {
    const h = chainSectionHash(renderChainSection([{ skill: "x", role: "required" }]));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("extractChainBlock — BEGIN/END parsing", () => {
  it("returns the full block when both markers exist", () => {
    const md = `# Phase intent

Some prose.

${CHAIN_BLOCK_BEGIN}

## Chain skills

- You **MUST** invoke \`codi:discover\`.

${CHAIN_BLOCK_END}

More manual content here.`;
    const block = extractChainBlock(md);
    expect(block).not.toBeNull();
    expect(block).toContain(CHAIN_BLOCK_BEGIN);
    expect(block).toContain(CHAIN_BLOCK_END);
    expect(block).toContain("`codi:discover`");
  });

  it("returns null when BEGIN marker missing", () => {
    const md = `Some content\n${CHAIN_BLOCK_END}\nmore`;
    expect(extractChainBlock(md)).toBeNull();
  });

  it("returns null when END marker missing", () => {
    const md = `Some content\n${CHAIN_BLOCK_BEGIN}\nmore`;
    expect(extractChainBlock(md)).toBeNull();
  });

  it("returns null when END appears before BEGIN", () => {
    const md = `${CHAIN_BLOCK_END}\nmid\n${CHAIN_BLOCK_BEGIN}`;
    expect(extractChainBlock(md)).toBeNull();
  });

  it("round-trip: render → embed → extract → matches", () => {
    const chains: ChainEntry[] = [
      { skill: "discover", role: "required" },
      { skill: "step-documenter", role: "optional", hint: "domain terms emerge" },
    ];
    const rendered = renderChainSection(chains);
    const md = `# Phase intent\n\nManual prose.\n\n${rendered}\n\nMore prose.\n`;
    const extracted = extractChainBlock(md);
    expect(extracted).toBe(rendered);
    expect(chainSectionHash(extracted ?? "")).toBe(chainSectionHash(rendered));
  });
});

describe("regeneratePhaseRefs — build hook", () => {
  function tmpSkillsRoot(): { root: string; cleanup: () => void } {
    const root = mkdtempSync(join(tmpdir(), "codi-phase-refs-"));
    return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
  }

  function writePhaseRef(root: string, workflow: string, phase: string, body: string): string {
    const dir = join(root, `${workflow}-workflow`, "references");
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `phase-${phase}.md`);
    writeFileSync(path, body);
    return path;
  }

  function workflow(
    id: string,
    chains: Record<string, readonly ChainEntry[]>,
    autoGen?: boolean,
  ): WorkflowDefinitionShape {
    const phases: Record<
      string,
      { gates: string[]; next: string[]; chains?: readonly ChainEntry[] }
    > = {};
    for (const [name, c] of Object.entries(chains)) {
      phases[name] = { gates: [], next: [], chains: c };
    }
    return {
      id,
      name: id,
      description: "test",
      version: 2,
      phases,
      ...(autoGen !== undefined ? { auto_generate_phase_refs: autoGen } : {}),
    };
  }

  it("reports skippedNoChange when block matches expected", () => {
    const t = tmpSkillsRoot();
    try {
      const chains = [{ skill: "discover", role: "required" } as ChainEntry];
      const expected = renderChainSection(chains);
      writePhaseRef(t.root, "feature", "intent", `# Phase: intent\n\n${expected}\n\nProse.\n`);
      const r = regeneratePhaseRefs([workflow("feature", { intent: chains })], {
        skillsRoot: t.root,
      });
      expect(r.skippedNoChange).toContain("feature.intent");
      expect(r.written).toEqual([]);
      expect(r.drift).toEqual([]);
    } finally {
      t.cleanup();
    }
  });

  it("reports drift when block differs from expected and force=false", () => {
    const t = tmpSkillsRoot();
    try {
      const realChains = [{ skill: "discover", role: "required" } as ChainEntry];
      const stale = renderChainSection([{ skill: "old-skill", role: "required" }]);
      const path = writePhaseRef(t.root, "feature", "intent", `# Phase: intent\n\n${stale}\n`);
      const r = regeneratePhaseRefs([workflow("feature", { intent: realChains })], {
        skillsRoot: t.root,
      });
      expect(r.drift).toHaveLength(1);
      expect(r.drift[0].path).toBe(path);
      expect(r.drift[0].expectedHash).not.toBe(r.drift[0].foundHash);
      expect(r.written).toEqual([]);
      // file unchanged
      const onDisk = readFileSync(path, "utf8");
      expect(onDisk).toContain("old-skill");
    } finally {
      t.cleanup();
    }
  });

  it("rewrites the block when force=true", () => {
    const t = tmpSkillsRoot();
    try {
      const realChains = [{ skill: "discover", role: "required" } as ChainEntry];
      const stale = renderChainSection([{ skill: "old-skill", role: "required" }]);
      const path = writePhaseRef(
        t.root,
        "feature",
        "intent",
        `# Phase: intent\n\n${stale}\n\nManual prose.\n`,
      );
      const r = regeneratePhaseRefs([workflow("feature", { intent: realChains })], {
        skillsRoot: t.root,
        force: true,
      });
      expect(r.written).toContain("feature.intent");
      const onDisk = readFileSync(path, "utf8");
      expect(onDisk).toContain("`codi:discover`");
      expect(onDisk).not.toContain("old-skill");
      expect(onDisk).toContain("Manual prose."); // outside markers preserved
    } finally {
      t.cleanup();
    }
  });

  it("respects auto_generate_phase_refs: false (Q12 opt-out)", () => {
    const t = tmpSkillsRoot();
    try {
      const realChains = [{ skill: "discover", role: "required" } as ChainEntry];
      const stale = renderChainSection([{ skill: "old-skill", role: "required" }]);
      const path = writePhaseRef(t.root, "feature", "intent", `# Phase: intent\n\n${stale}\n`);
      const r = regeneratePhaseRefs([workflow("feature", { intent: realChains }, false)], {
        skillsRoot: t.root,
        force: true,
      });
      expect(r.skippedOptOut).toContain("feature");
      expect(r.written).toEqual([]);
      // file unchanged even with force=true because workflow opted out
      expect(readFileSync(path, "utf8")).toContain("old-skill");
    } finally {
      t.cleanup();
    }
  });

  it("reports missingMarkers when .md exists but lacks BEGIN/END", () => {
    const t = tmpSkillsRoot();
    try {
      writePhaseRef(t.root, "feature", "intent", "# Phase: intent\n\nNo markers here.\n");
      const r = regeneratePhaseRefs(
        [workflow("feature", { intent: [{ skill: "discover", role: "required" }] })],
        { skillsRoot: t.root },
      );
      expect(r.missingMarkers).toContain("feature.intent");
    } finally {
      t.cleanup();
    }
  });

  it("reports missingMd when phase has chains but no .md file", () => {
    const t = tmpSkillsRoot();
    try {
      const r = regeneratePhaseRefs(
        [workflow("feature", { intent: [{ skill: "discover", role: "required" }] })],
        { skillsRoot: t.root },
      );
      expect(r.missingMd).toContain("feature.intent");
    } finally {
      t.cleanup();
    }
  });

  it("skips terminal phases (done, abandoned)", () => {
    const t = tmpSkillsRoot();
    try {
      // No .md files for done/abandoned — should not be reported as missing
      const r = regeneratePhaseRefs(
        [
          {
            id: "feature",
            name: "feature",
            description: "test",
            version: 2,
            phases: {
              done: { gates: [], next: [] },
              abandoned: { gates: [], next: [] },
            },
          },
        ],
        { skillsRoot: t.root },
      );
      expect(r.missingMd).toEqual([]);
      expect(r.skippedNoChange).toEqual([]);
      expect(r.written).toEqual([]);
    } finally {
      t.cleanup();
    }
  });

  it("preserves manual content outside the markers across regen", () => {
    const t = tmpSkillsRoot();
    try {
      const oldChains = [{ skill: "old", role: "required" } as ChainEntry];
      const newChains = [{ skill: "new", role: "required" } as ChainEntry];
      const stale = renderChainSection(oldChains);
      const path = writePhaseRef(
        t.root,
        "feature",
        "intent",
        `# Phase: intent\n\n${stale}\n\n## Manual section\n\nImportant discipline that must survive regen.\n`,
      );
      regeneratePhaseRefs([workflow("feature", { intent: newChains })], {
        skillsRoot: t.root,
        force: true,
      });
      const onDisk = readFileSync(path, "utf8");
      expect(onDisk).toContain("## Manual section");
      expect(onDisk).toContain("Important discipline that must survive regen.");
      expect(onDisk).toContain("`codi:new`");
      expect(onDisk).not.toContain("`codi:old`");
    } finally {
      t.cleanup();
    }
  });
});

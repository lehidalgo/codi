/**
 * Capabilities Matrix governance regression guard (Item 5).
 *
 * Per Q3 (= grandfather) the matrix is OPT-IN: existing per-target
 * adapters keep emitting whatever they emit in v2.x. Wiring them to the
 * matrix is a v3.1+ migration that needs its own release notes so users
 * don't see directories silently disappear.
 *
 * This test fails when ANY .ts file under src/adapters/{cursor,windsurf,
 * cline,copilot,gemini}/ imports from #src/core/capabilities. Failing
 * means someone coupled a grandfathered adapter to the matrix without
 * removing it from this regression set first.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(process.cwd());
const GRANDFATHERED_ADAPTERS = ["cursor", "windsurf", "cline", "copilot", "gemini"] as const;

const FORBIDDEN_IMPORT_RE = /from\s+["']#src\/core\/capabilities/;

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (full.endsWith(".ts") && !full.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("Capabilities Matrix governance — Tier 2 adapters stay grandfathered", () => {
  for (const adapter of GRANDFATHERED_ADAPTERS) {
    it(`adapter "${adapter}" does not import from #src/core/capabilities`, () => {
      const adapterDir = resolve(REPO_ROOT, "src", "adapters", adapter);
      if (!existsSync(adapterDir)) {
        // Adapter not present in the tree — vacuously true.
        return;
      }
      const offenders: string[] = [];
      for (const file of walk(adapterDir)) {
        const text = readFileSync(file, "utf8");
        if (FORBIDDEN_IMPORT_RE.test(text)) {
          offenders.push(file);
        }
      }
      expect(
        offenders,
        `Tier 2 adapter ${adapter} now imports from the Capabilities Matrix.\n` +
          "If you are deliberately migrating it to matrix-driven emission, REMOVE " +
          adapter +
          " from GRANDFATHERED_ADAPTERS in this test and document the change in the v3.x release notes.",
      ).toEqual([]);
    });
  }

  it("the contract document is present in matrix.ts", () => {
    const matrix = readFileSync(
      resolve(REPO_ROOT, "src", "core", "capabilities", "matrix.ts"),
      "utf8",
    );
    expect(matrix).toContain("Governance contract");
    expect(matrix).toContain("OPT-IN");
    expect(matrix).toContain("GRANDFATHERED");
  });
});

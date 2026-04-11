import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { SkillTestManifestSchema } from "#src/schemas/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, "../../../src/templates/skills");

function findSkillTestManifests(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      results.push(...findSkillTestManifests(join(dir, entry.name)));
    } else if (entry.name === "skill.test.json") {
      results.push(join(dir, entry.name));
    }
  }
  return results;
}

const manifests = findSkillTestManifests(SKILLS_DIR);

describe("Tier 1 — skill.test.json contract validation", () => {
  it("finds at least one skill.test.json manifest", () => {
    expect(manifests.length).toBeGreaterThan(0);
  });

  for (const manifestPath of manifests) {
    const relPath = relative(process.cwd(), manifestPath);

    it(`${relPath} — parses as valid JSON`, () => {
      const raw = readFileSync(manifestPath, "utf-8");
      expect(() => JSON.parse(raw)).not.toThrow();
    });

    it(`${relPath} — satisfies SkillTestManifestSchema`, () => {
      const raw = readFileSync(manifestPath, "utf-8");
      const parsed = JSON.parse(raw);
      const result = SkillTestManifestSchema.safeParse(parsed);
      expect(result.success, JSON.stringify(result)).toBe(true);
    });

    it(`${relPath} — skill name is non-empty`, () => {
      const parsed = JSON.parse(readFileSync(manifestPath, "utf-8"));
      expect(parsed.skill).toBeTruthy();
    });
  }
});

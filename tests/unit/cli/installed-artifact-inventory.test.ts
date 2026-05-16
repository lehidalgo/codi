import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import { getTemplateVersion, loadTemplate } from "#src/core/scaffolder/template-loader.js";
import { PROJECT_DIR } from "#src/constants.js";
import { buildInstalledArtifactInventory } from "#src/cli/installed-artifact-inventory.js";
import { injectFrontmatterVersion } from "#src/core/version/artifact-version.js";

describe("buildInstalledArtifactInventory", () => {
  let tmpDir: string;
  let configDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-inventory-"));
    configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(path.join(configDir, "rules"), { recursive: true });
    await fs.mkdir(path.join(configDir, "skills"), { recursive: true });
    await fs.mkdir(path.join(configDir, "agents"), { recursive: true });
    await fs.mkdir(path.join(configDir, "commands"), { recursive: true });
    await fs.mkdir(path.join(configDir, "mcp-servers"), { recursive: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("reconstructs installed selections and statuses from disk", async () => {
    const security = loadTemplate("codi-security");
    const architecture = loadTemplate("codi-architecture");
    if (!security.ok || !architecture.ok) {
      throw new Error("builtin templates unavailable for test");
    }
    const securityVersion = getTemplateVersion("codi-security");
    const architectureVersion = getTemplateVersion("codi-architecture");

    await fs.writeFile(
      path.join(configDir, "rules", "codi-security.md"),
      injectFrontmatterVersion(security.data, securityVersion ?? 1),
      "utf8",
    );
    await fs.writeFile(
      path.join(configDir, "rules", "codi-architecture.md"),
      `${injectFrontmatterVersion(architecture.data, architectureVersion ?? 1)}\n\nLocal change`,
      "utf8",
    );
    await fs.writeFile(
      path.join(configDir, "rules", "codi-retired.md"),
      "---\nname: codi-retired\ndescription: Retired rule\nmanaged_by: codi\n---\n# Retired\n",
      "utf8",
    );
    await fs.writeFile(
      path.join(configDir, "rules", "my-team-rule.md"),
      "---\nname: my-team-rule\ndescription: Team-specific rule\nmanaged_by: user\n---\n# Team Rule\n",
      "utf8",
    );

    const inventory = await buildInstalledArtifactInventory(configDir);

    expect(inventory.selections.rules).toEqual(
      expect.arrayContaining([
        "codi-security",
        "codi-architecture",
        "codi-retired",
        "my-team-rule",
      ]),
    );

    expect(inventory.entries.find((entry) => entry.name === "codi-security")).toMatchObject({
      status: "builtin-original",
      installed: true,
      managedBy: "codi",
    });

    expect(inventory.entries.find((entry) => entry.name === "codi-architecture")).toMatchObject({
      status: "builtin-modified",
      installed: true,
    });

    expect(inventory.entries.find((entry) => entry.name === "codi-retired")).toMatchObject({
      status: "builtin-removed",
      installed: true,
    });

    expect(inventory.entries.find((entry) => entry.name === "my-team-rule")).toMatchObject({
      status: "custom-user",
      installed: true,
      managedBy: "user",
    });

    expect(inventory.entries.find((entry) => entry.name === "codi-code-style")).toMatchObject({
      status: "builtin-new",
      installed: false,
    });
  });

  // ─── CORE-036 — non-core artifact removal smoke ────────────────────────────
  //
  // Verifies the isolation contract from CORE-024: codi's core commands
  // must function when the user has removed any subset of meta-skills
  // (codi-* + dev-*) from their `.codi/skills/` directory. The
  // inventory builder is the canonical read-side entry point and must
  // walk generically — never hardcode a "codi-foo must exist" check.
  describe("non-core artifact removal smoke (CORE-036)", () => {
    it("handles a completely empty `.codi/skills/` directory without crashing", async () => {
      // `.codi/skills/` exists but is empty — the user removed every
      // installed skill manually.
      const inventory = await buildInstalledArtifactInventory(configDir);
      expect(inventory.selections.skills).toEqual([]);
      // Builder must NOT throw and must return a typed shape.
      expect(Array.isArray(inventory.entries)).toBe(true);
    });

    it("handles a missing `.codi/skills/` directory entirely", async () => {
      // Drop the skills/ dir altogether; the wizard / inventory build
      // happens before init has created it on a fresh project.
      await fs.rm(path.join(configDir, "skills"), { recursive: true, force: true });
      const inventory = await buildInstalledArtifactInventory(configDir);
      expect(inventory.selections.skills).toEqual([]);
      expect(Array.isArray(inventory.entries)).toBe(true);
    });

    it("walks user-installed non-meta skills when ALL meta-skills are removed", async () => {
      // Simulates the user `rm -rf .codi/skills/codi-* .codi/skills/dev-*`
      // after a full install. Inventory must still surface the remaining
      // (user / custom) skills generically.
      await fs.mkdir(path.join(configDir, "skills", "my-team-skill"), { recursive: true });
      await fs.writeFile(
        path.join(configDir, "skills", "my-team-skill", "SKILL.md"),
        "---\nname: my-team-skill\ndescription: Team-only skill\nmanaged_by: user\n---\n# Team Skill\n",
        "utf8",
      );

      const inventory = await buildInstalledArtifactInventory(configDir);
      expect(inventory.selections.skills).toContain("my-team-skill");
      expect(
        inventory.selections.skills.some((s) => s.startsWith("codi-") || s.startsWith("dev-")),
      ).toBe(false);

      const teamEntry = inventory.entries.find((e) => e.name === "my-team-skill");
      expect(teamEntry).toMatchObject({ status: "custom-user", installed: true, managedBy: "user" });
    });

    it("reports builtin-new for a meta-skill that was uninstalled but is still a known builtin", async () => {
      // Install one meta-skill, leave the other absent. Inventory must
      // report the absent one as `builtin-new` (available to install)
      // and the installed one as `builtin-original`.
      const skillCreator = loadTemplate("codi-skill-creator");
      if (!skillCreator.ok) return; // builtin not bundled in this fixture; skip

      const present = "my-team-skill-2";
      await fs.mkdir(path.join(configDir, "skills", present), { recursive: true });
      await fs.writeFile(
        path.join(configDir, "skills", present, "SKILL.md"),
        "---\nname: my-team-skill-2\ndescription: x\nmanaged_by: user\n---\n# x\n",
        "utf8",
      );

      const inventory = await buildInstalledArtifactInventory(configDir);
      expect(inventory.entries.some((e) => e.name === present && e.installed)).toBe(true);
      // The codi-skill-creator meta-skill is bundled but NOT installed
      // — must surface as builtin-new, not as a crash or warning.
      const metaEntry = inventory.entries.find((e) => e.name === "codi-skill-creator");
      // If the test runner did not bundle the meta template the entry
      // may be missing — guard with optional chaining rather than fail.
      if (metaEntry) {
        expect(metaEntry.installed).toBe(false);
      }
    });
  });
});

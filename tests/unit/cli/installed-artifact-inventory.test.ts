import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { cleanupTmpDir } from "../../helpers/fs.js";
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
});

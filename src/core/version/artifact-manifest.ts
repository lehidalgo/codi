import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import { ok, err } from "#src/types/result.js";
import type { Result } from "#src/types/result.js";
import { createError } from "../output/errors.js";
import { hashContent } from "#src/utils/hash.js";
import { ARTIFACT_MANIFEST_FILENAME } from "#src/constants.js";
import { getTemplateFingerprint } from "./template-hash-registry.js";
import type { ArtifactType } from "./template-hash-registry.js";
import type { ExistingSelections } from "#src/cli/init-wizard.js";
import type { InstalledArtifactVersion } from "./artifact-version.js";

// --- Schema ---

const ArtifactEntrySchema = z.object({
  name: z.string(),
  type: z.enum(["rule", "skill", "agent", "mcp-server"]),
  contentHash: z.string(),
  installedArtifactVersion: z.union([z.number().int().positive(), z.literal("unknown")]),
  installedAt: z.string(),
  managedBy: z.enum(["codi", "user"]),
  /**
   * Optional provenance for externally-added artifacts. Set when an artifact
   * is added from outside the codi-cli package (local dir / ZIP / GitHub repo
   * via the "Customize codi setup → Add from external" workflow).
   * Format: "github:org/repo@<sha>", "zip:<basename>", or "local:<abs-path>".
   * Informational in V1 — not used by `codi update`. Future versions may add
   * a refresh-from-source flag.
   */
  source: z.string().optional(),
});

const ArtifactManifestSchema = z.object({
  version: z.literal("1"),
  artifacts: z.record(z.string(), ArtifactEntrySchema),
});

export type ArtifactEntry = z.infer<typeof ArtifactEntrySchema>;
export type ArtifactManifest = z.infer<typeof ArtifactManifestSchema>;

const EMPTY_MANIFEST: ArtifactManifest = {
  version: "1",
  artifacts: {},
};

// --- Manager class ---

export class ArtifactManifestManager {
  private readonly manifestPath: string;

  constructor(configDir: string) {
    this.manifestPath = path.join(configDir, ARTIFACT_MANIFEST_FILENAME);
  }

  async read(): Promise<Result<ArtifactManifest>> {
    try {
      const raw = await fs.readFile(this.manifestPath, "utf8");
      const parsed = ArtifactManifestSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        return ok(structuredClone(EMPTY_MANIFEST));
      }
      return ok(parsed.data);
    } catch (cause) {
      if (isNodeError(cause) && cause.code === "ENOENT") {
        return ok(structuredClone(EMPTY_MANIFEST));
      }
      return err([
        createError("E_CONFIG_PARSE_FAILED", { file: this.manifestPath }, cause as Error),
      ]);
    }
  }

  async write(manifest: ArtifactManifest): Promise<Result<void>> {
    try {
      const dir = path.dirname(this.manifestPath);
      await fs.mkdir(dir, { recursive: true });
      const tmpPath = `${this.manifestPath}.tmp.${Date.now()}`;
      await fs.writeFile(tmpPath, JSON.stringify(manifest, null, 2), "utf8");
      await fs.rename(tmpPath, this.manifestPath);
      return ok(undefined);
    } catch (cause) {
      return err([
        createError("E_CONFIG_PARSE_FAILED", { file: this.manifestPath }, cause as Error),
      ]);
    }
  }

  async recordInstall(entries: ArtifactEntry[]): Promise<Result<void>> {
    const readResult = await this.read();
    if (!readResult.ok) return readResult;

    const manifest = readResult.data;
    for (const entry of entries) {
      manifest.artifacts[entry.name] = entry;
    }
    return this.write(manifest);
  }

  async removeArtifacts(names: string[]): Promise<Result<void>> {
    const readResult = await this.read();
    if (!readResult.ok) return readResult;

    const manifest = readResult.data;
    for (const name of names) {
      delete manifest.artifacts[name];
    }
    return this.write(manifest);
  }

  async getEntry(name: string): Promise<ArtifactEntry | undefined> {
    const readResult = await this.read();
    if (!readResult.ok) return undefined;
    return readResult.data.artifacts[name];
  }

  /** Returns true if the manifest file exists on disk. */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.manifestPath);
      return true;
    } catch {
      return false;
    }
  }
}

// --- Migration: bootstrap from existing installation ---

/**
 * Creates an artifact-manifest.json from an existing `.codi/` installation
 * that predates manifest tracking. Hashes the installed files and records
 * `installedArtifactVersion: "unknown"` since the original artifact version is lost.
 */
export async function bootstrapManifestFromState(
  configDir: string,
  projectRoot: string,
  existingSelections: ExistingSelections,
): Promise<ArtifactManifest> {
  const manifest: ArtifactManifest = { version: "1", artifacts: {} };

  const typeMap: Array<{
    names: string[];
    type: ArtifactType;
    dirName: string;
    fileName?: string;
  }> = [
    { names: existingSelections.rules, type: "rule", dirName: "rules", fileName: undefined },
    { names: existingSelections.skills, type: "skill", dirName: "skills", fileName: "SKILL.md" },
    { names: existingSelections.agents, type: "agent", dirName: "agents", fileName: undefined },
    {
      names: existingSelections.mcpServers ?? [],
      type: "mcp-server",
      dirName: "mcp-servers",
      fileName: undefined,
    },
  ];

  for (const { names, type, dirName, fileName } of typeMap) {
    for (const name of names) {
      const filePath = fileName
        ? path.join(configDir, dirName, name, fileName)
        : path.join(configDir, dirName, `${name}.md`);

      try {
        const content = await fs.readFile(filePath, "utf8");
        const { data } = matter(content);
        const managedBy =
          typeof data["managed_by"] === "string" && data["managed_by"] === "user" ? "user" : "codi";

        manifest.artifacts[name] = {
          name,
          type,
          contentHash: hashContent(content),
          installedArtifactVersion: "unknown",
          installedAt: new Date().toISOString(),
          managedBy,
        };
      } catch {
        // File missing — skip silently
      }
    }
  }

  void projectRoot; // reserved for future use

  const mgr = new ArtifactManifestManager(configDir);
  await mgr.write(manifest);
  return manifest;
}

// --- Utility ---

function isNodeError(e: unknown): e is NodeJS.ErrnoException {
  return e instanceof Error && "code" in e;
}

/**
 * Syncs the artifact manifest after a `codi update` run.
 * Records updated content hashes for the given artifact names.
 */
export async function syncManifestOnUpdate(
  configDir: string,
  updated: {
    rules: string[];
    skills: string[];
    agents: string[];
    mcpServers: string[];
  },
): Promise<void> {
  const reads: Array<{
    names: string[];
    type: ArtifactType;
    fileFn: (name: string) => string;
  }> = [
    { names: updated.rules, type: "rule", fileFn: (n) => path.join(configDir, "rules", `${n}.md`) },
    {
      names: updated.skills,
      type: "skill",
      fileFn: (n) => path.join(configDir, "skills", n, "SKILL.md"),
    },
    {
      names: updated.agents,
      type: "agent",
      fileFn: (n) => path.join(configDir, "agents", `${n}.md`),
    },
    {
      names: updated.mcpServers,
      type: "mcp-server",
      fileFn: (n) => path.join(configDir, "mcp-servers", `${n}.yaml`),
    },
  ];

  const artifactData: Array<{
    name: string;
    type: ArtifactType;
    content: string;
    managedBy: "codi" | "user";
    artifactVersion: InstalledArtifactVersion;
  }> = [];

  for (const { names, type, fileFn } of reads) {
    for (const name of names) {
      try {
        const content = await fs.readFile(fileFn(name), "utf-8");
        const fingerprint = getTemplateFingerprint(name);
        artifactData.push({
          name,
          type,
          content,
          managedBy: "codi",
          artifactVersion: fingerprint?.artifactVersion ?? "unknown",
        });
      } catch {
        /* skip if file missing */
      }
    }
  }

  if (artifactData.length > 0) {
    const manifestMgr = new ArtifactManifestManager(configDir);
    const entries = buildArtifactEntries(artifactData);
    await manifestMgr.recordInstall(entries);
  }
}

/** Build ArtifactEntry array from freshly installed artifacts. */
export function buildArtifactEntries(
  artifacts: Array<{
    name: string;
    type: ArtifactType;
    content: string;
    managedBy: "codi" | "user";
    artifactVersion: InstalledArtifactVersion;
  }>,
): ArtifactEntry[] {
  return artifacts.map(({ name, type, content, managedBy, artifactVersion }) => ({
    name,
    type,
    contentHash: hashContent(content),
    installedArtifactVersion: artifactVersion,
    installedAt: new Date().toISOString(),
    managedBy,
  }));
}

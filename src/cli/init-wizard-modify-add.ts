import * as p from "@clack/prompts";
import path from "node:path";
import {
  connectGithubRepo,
  connectLocalDirectory,
  connectZipFile,
  type ExternalSource,
} from "../core/external-source/connectors.js";
import {
  discoverArtifacts,
  type ArtifactType,
  type DiscoveredArtifact,
} from "../core/external-source/discovery.js";
import {
  detectCollisions,
  installSelected,
  type CollisionResolution,
  type InstallEntry,
} from "../core/external-source/installer.js";
import { isCancelled } from "./hub-handlers.js";
import { regenerateConfigs } from "./shared.js";

export type ExternalSourceKind = "local" | "zip" | "github";

const KIND_LABELS: Record<ExternalSourceKind, string> = {
  local: "local directory",
  zip: "ZIP file",
  github: "GitHub repository",
};

const TYPE_PLURAL: Record<ArtifactType, string> = {
  rule: "Rules",
  skill: "Skills",
  agent: "Agents",
  "mcp-server": "MCP servers",
};

async function promptSource(kind: ExternalSourceKind): Promise<ExternalSource | null> {
  if (kind === "local") {
    const value = await p.text({
      message: "Path to the directory containing rules/, skills/, agents/, mcp-servers/",
      placeholder: "/path/to/external/preset",
    });
    if (isCancelled(value)) return null;
    return await connectLocalDirectory(value as string);
  }
  if (kind === "zip") {
    const value = await p.text({
      message: "Path to the .zip file",
      validate: (v) => (v?.endsWith(".zip") ? undefined : "Must be a .zip file"),
    });
    if (isCancelled(value)) return null;
    return await connectZipFile(value as string);
  }
  const value = await p.text({
    message:
      "GitHub repo — accepts org/repo, github:org/repo[@tag|#branch], or full https://github.com/... URL",
    placeholder: "https://github.com/lehidalgo/codi",
  });
  if (isCancelled(value)) return null;
  return await connectGithubRepo(value as string);
}

function buildArtifactOptions(artifacts: DiscoveredArtifact[]): Array<{
  label: string;
  value: DiscoveredArtifact;
  hint: string;
}> {
  // Sort by type then name for stable, scannable display.
  const sorted = [...artifacts].sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.name.localeCompare(b.name);
  });
  return sorted.map((a) => ({
    label: `[${TYPE_PLURAL[a.type]}] ${a.name}`,
    value: a,
    hint: a.relPath,
  }));
}

async function resolveCollisions(
  collisions: Array<DiscoveredArtifact>,
  sourceId: string,
): Promise<Map<DiscoveredArtifact, CollisionResolution>> {
  const result = new Map<DiscoveredArtifact, CollisionResolution>();
  let applyToAll: CollisionResolution | null = null;

  for (let i = 0; i < collisions.length; i++) {
    const artifact = collisions[i]!;
    if (applyToAll) {
      result.set(artifact, applyToAll);
      continue;
    }
    const remaining = collisions.length - i - 1;
    const choice = await p.select({
      message: `"${artifact.name}" already exists in .codi/${artifact.type}s. What now?`,
      options: [
        { value: "skip", label: "Keep current", hint: "skip this import" },
        { value: "overwrite", label: "Overwrite with imported" },
        {
          value: "rename",
          label: `Rename imported to ${artifact.name}-from-${shortenSourceId(sourceId)}`,
        },
        ...(remaining > 0
          ? [
              {
                value: "applyAll",
                label: `Apply same choice to remaining ${remaining}`,
                hint: "you'll pick the action next",
              },
            ]
          : []),
      ],
    });
    if (isCancelled(choice)) {
      // Treat cancel as "keep current" for safety.
      result.set(artifact, { kind: "skip" });
      continue;
    }
    if (choice === "applyAll") {
      const bulk = await p.select({
        message: `Apply which action to the remaining ${remaining}?`,
        options: [
          { value: "skip", label: "Keep current (skip all)" },
          { value: "overwrite", label: "Overwrite all" },
          { value: "rename", label: "Rename all" },
        ],
      });
      if (isCancelled(bulk)) {
        result.set(artifact, { kind: "skip" });
        continue;
      }
      const resolution = toResolution(bulk as string, artifact, sourceId);
      result.set(artifact, resolution);
      applyToAll = resolution;
      continue;
    }
    result.set(artifact, toResolution(choice as string, artifact, sourceId));
  }
  return result;
}

function toResolution(
  choice: string,
  artifact: DiscoveredArtifact,
  sourceId: string,
): CollisionResolution {
  if (choice === "overwrite") return { kind: "overwrite" };
  if (choice === "rename") {
    return { kind: "rename", newName: `${artifact.name}-from-${shortenSourceId(sourceId)}` };
  }
  return { kind: "skip" };
}

/** Trim source ids for use in renamed filenames; "github:org/repo@sha" → "repo". */
function shortenSourceId(id: string): string {
  const last = id.split("/").pop() ?? id;
  const cleaned = last.split("@")[0] ?? last;
  return cleaned.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40);
}

/**
 * End-to-end "Add from external source" workflow. Connects to the source,
 * discovers artifacts, asks the user which to install, resolves collisions,
 * and copies them into .codi/ with managed_by:user provenance. Always cleans
 * up the temp source even on early exit.
 */
export async function runAddFromExternal(
  configDir: string,
  kind: ExternalSourceKind,
): Promise<void> {
  p.log.step(`Add artifacts from ${KIND_LABELS[kind]}`);
  let source: ExternalSource | null = null;
  try {
    source = await promptSource(kind);
    if (!source) return;

    const skipped: string[] = [];
    const artifacts = await discoverArtifacts(source.rootPath, (rel, reason) =>
      skipped.push(`${rel} (${reason})`),
    );

    if (artifacts.length === 0) {
      p.log.error(
        `No codi artifacts found in ${source.id}. Source must contain rules/, skills/, agents/, or mcp-servers/ directories.`,
      );
      return;
    }
    if (skipped.length > 0) {
      p.log.warn(
        `Skipped ${skipped.length} invalid entries: ${skipped.slice(0, 3).join(", ")}${skipped.length > 3 ? "…" : ""}`,
      );
    }

    const selected = await p.multiselect<DiscoveredArtifact>({
      message: "Select artifacts to add (space to toggle, enter to confirm)",
      options: buildArtifactOptions(artifacts),
      required: false,
    });
    if (isCancelled(selected) || selected.length === 0) {
      p.log.info("No artifacts selected. Nothing changed.");
      return;
    }

    const collisionMap = await detectCollisions(configDir, selected);
    const colliding = selected.filter((a) => collisionMap.get(a) === "exists");
    const collisionResolutions =
      colliding.length > 0 ? await resolveCollisions(colliding, source.id) : new Map();

    const entries: InstallEntry[] = selected.map((artifact) => ({
      artifact,
      resolution: collisionResolutions.get(artifact) ?? { kind: "overwrite" },
    }));

    const summary = await installSelected(configDir, entries, source);
    p.log.success(
      `Installed ${summary.installed} (renamed: ${summary.renamed}, skipped: ${summary.skipped}).`,
    );

    // Auto-generate so the user does not have to run `codi generate` manually
    // after every customize action. regenerateConfigs respects the project's
    // manifest.agents — only the configured coding agents are refreshed.
    if (summary.installed > 0) {
      // configDir is .codi/; the project root is its parent.
      const projectRoot = path.dirname(configDir);
      p.log.step("Regenerating agent configs...");
      const ok = await regenerateConfigs(projectRoot);
      if (ok) {
        p.log.success("Agent configs regenerated.");
      } else {
        p.log.warn("Auto-generate skipped — run `codi generate` manually.");
      }
    }
  } catch (cause) {
    p.log.error(`Import failed: ${cause instanceof Error ? cause.message : String(cause)}`);
  } finally {
    if (source) await source.cleanup();
  }
}

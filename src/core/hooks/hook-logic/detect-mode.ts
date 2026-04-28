import type { ArtifactInspection } from "./types.js";

const SOURCE_SKILL = /^src\/templates\/skills\/([^/]+)\/template\.ts$/;
const SOURCE_AGENT = /^src\/templates\/agents\/([^/]+)\/template\.ts$/;
const SOURCE_RULE = /^src\/templates\/rules\/([^/]+)\.ts$/;
const CODI_RULE = /^\.codi\/rules\/([^/]+)\.md$/;
const CODI_SKILL = /^\.codi\/skills\/([^/]+)\/SKILL\.md$/;
const CODI_AGENT = /^\.codi\/agents\/([^/]+)\.md$/;

function parseManagedBy(content: string): "codi" | "user" {
  const match = content.match(/^managed_by:\s*(codi|user)\s*$/m);
  return match ? (match[1] as "codi" | "user") : "user";
}

export function detectMode(path: string, content: string): ArtifactInspection {
  const result: ArtifactInspection = {
    path,
    mode: "skip",
    artifactName: null,
    artifactType: null,
  };

  let m = path.match(SOURCE_SKILL);
  if (m) {
    result.mode = "source";
    result.artifactName = m[1] ?? null;
    result.artifactType = "skill";
    return result;
  }

  m = path.match(SOURCE_AGENT);
  if (m) {
    result.mode = "source";
    result.artifactName = m[1] ?? null;
    result.artifactType = "agent";
    return result;
  }

  m = path.match(SOURCE_RULE);
  if (m && m[1] !== "index") {
    result.mode = "source";
    result.artifactName = m[1] ?? null;
    result.artifactType = "rule";
    return result;
  }

  m = path.match(CODI_RULE);
  if (m) {
    result.mode = parseManagedBy(content) === "codi" ? "codi-managed" : "user-managed";
    result.artifactName = m[1] ?? null;
    result.artifactType = "rule";
    return result;
  }

  m = path.match(CODI_SKILL);
  if (m) {
    result.mode = parseManagedBy(content) === "codi" ? "codi-managed" : "user-managed";
    result.artifactName = m[1] ?? null;
    result.artifactType = "skill";
    return result;
  }

  m = path.match(CODI_AGENT);
  if (m) {
    result.mode = parseManagedBy(content) === "codi" ? "codi-managed" : "user-managed";
    result.artifactName = m[1] ?? null;
    result.artifactType = "agent";
    return result;
  }

  return result;
}

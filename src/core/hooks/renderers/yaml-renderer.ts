import { Document, YAMLMap, YAMLSeq, isMap, isScalar } from "yaml";
import type { HookSpec, PreCommitEmission } from "../hook-spec.js";
import {
  loadOrEmptyDoc,
  findReposNode,
  isCodiManagedRepo,
  setCodiMarker,
  serialize,
} from "../yaml-document.js";
import { stripLegacyTextMarkers } from "../legacy-cleanup.js";

/**
 * Top-level keys we ensure exist when generating a fresh `.pre-commit-config.yaml`
 * (or when the user has never set them). We do NOT overwrite existing user values.
 */
const TOP_LEVEL_DEFAULTS: Array<[string, unknown]> = [
  ["default_install_hook_types", ["pre-commit", "commit-msg", "pre-push"]],
  ["default_language_version", { python: "python3.12", node: "22" }],
  ["minimum_pre_commit_version", "3.5.0"],
  ["exclude", "^(node_modules|\\.venv|venv|dist|build|coverage|\\.next|\\.codi)/"],
];

/**
 * Build a YAMLMap representing one `repos:` list item from a HookSpec.
 * If `userPinnedRev` is provided (from a previous Codi-managed entry), it
 * overrides the registry's `rev:` value for upstream emissions — the user's
 * manual edits to `rev:` are preserved across regenerations.
 */
function buildRepoEntry(spec: HookSpec, userPinnedRev: string | null): YAMLMap {
  const e = spec.preCommit;
  const map = new YAMLMap();

  if (e.kind === "upstream") {
    map.set("repo", e.repo);
    map.set("rev", userPinnedRev ?? e.rev);
    const hookEntry = new YAMLMap();
    hookEntry.set("id", e.id);
    if (e.args && e.args.length > 0) hookEntry.set("args", [...e.args]);
    if (e.additionalDependencies && e.additionalDependencies.length > 0) {
      hookEntry.set("additional_dependencies", [...e.additionalDependencies]);
    }
    if (e.passFilenames === false) hookEntry.set("pass_filenames", false);
    if (spec.stages.length > 0 && !(spec.stages.length === 1 && spec.stages[0] === "pre-commit")) {
      hookEntry.set("stages", [...spec.stages]);
    }
    const hooks = new YAMLSeq();
    hooks.add(hookEntry);
    map.set("hooks", hooks);
    setCodiMarker(map);
    return map;
  }

  // local
  map.set("repo", "local");
  const hookEntry = new YAMLMap();
  hookEntry.set("id", spec.name);
  hookEntry.set("name", spec.name);
  hookEntry.set("entry", e.entry);
  hookEntry.set("language", e.language);
  if (e.additionalDependencies && e.additionalDependencies.length > 0) {
    hookEntry.set("additional_dependencies", [...e.additionalDependencies]);
  }
  if (e.passFilenames === false) hookEntry.set("pass_filenames", false);
  if (spec.stages.length > 0 && !(spec.stages.length === 1 && spec.stages[0] === "pre-commit")) {
    hookEntry.set("stages", [...spec.stages]);
  }
  if (spec.files === "" || spec.files === "**" || spec.files === "**/*") {
    hookEntry.set("always_run", true);
  }
  const hooks = new YAMLSeq();
  hooks.add(hookEntry);
  map.set("hooks", hooks);
  setCodiMarker(map);
  return map;
}

function repoKey(e: PreCommitEmission, name: string): string {
  return e.kind === "upstream" ? `upstream:${e.repo}:${e.id}` : `local:${name}`;
}

function existingCodiRevByKey(reposNode: YAMLSeq): Map<string, string> {
  const out = new Map<string, string>();
  for (const item of reposNode.items) {
    if (!isCodiManagedRepo(item)) continue;
    if (!isMap(item)) continue;
    const map = item as YAMLMap;
    const repoVal = map.get("repo");
    const repo =
      typeof repoVal === "string"
        ? repoVal
        : isScalar(repoVal)
          ? String((repoVal as { value: unknown }).value)
          : null;
    if (!repo || repo === "local") continue;
    const revVal = map.get("rev");
    const rev =
      typeof revVal === "string"
        ? revVal
        : isScalar(revVal)
          ? String((revVal as { value: unknown }).value)
          : null;
    if (!rev) continue;
    const hooksNode = map.get("hooks");
    if (hooksNode && typeof hooksNode === "object" && "items" in hooksNode) {
      for (const h of (hooksNode as YAMLSeq).items) {
        if (h && isMap(h)) {
          const idVal = (h as YAMLMap).get("id");
          const id =
            typeof idVal === "string"
              ? idVal
              : isScalar(idVal)
                ? String((idVal as { value: unknown }).value)
                : null;
          if (id) out.set(`upstream:${repo}:${id}`, rev);
        }
      }
    }
  }
  return out;
}

/**
 * Produce the `.pre-commit-config.yaml` content for the given HookSpec list.
 * `existing` is the current file content (or null when the file doesn't exist).
 *
 * Behaviour:
 *  - Strips legacy text-marker blocks first (one-time migration).
 *  - Parses the rest as YAML; falls back to a fresh document on parse error.
 *  - Preserves all non-Codi-marked entries.
 *  - Replaces every Codi-marked entry with a freshly-built one from the spec
 *    list, but reads back the user's manually-pinned `rev:` values first.
 *  - Emits top-level defaults (default_install_hook_types, exclude, etc.)
 *    when missing — never overwrites existing user values.
 */
export function renderPreCommitConfig(specs: HookSpec[], existing: string | null): string {
  const cleaned = existing ? stripLegacyTextMarkers(existing) : "";
  let doc: Document;
  try {
    doc = loadOrEmptyDoc(cleaned);
  } catch {
    doc = loadOrEmptyDoc("");
  }

  for (const [k, v] of TOP_LEVEL_DEFAULTS) {
    if (!doc.has(k)) doc.set(k, v);
  }

  const repos = findReposNode(doc)!;
  const userPinned = existingCodiRevByKey(repos);

  // Drop existing Codi-managed entries; keep user entries in place.
  const remaining = repos.items.filter((it) => !isCodiManagedRepo(it));
  repos.items.length = 0;
  for (const it of remaining) repos.items.push(it);

  // Append fresh Codi-managed entries from the spec list.
  for (const spec of specs) {
    const userRev = userPinned.get(repoKey(spec.preCommit, spec.name)) ?? null;
    const node = buildRepoEntry(spec, userRev);
    repos.items.push(node);
  }

  return serialize(doc);
}

import {
  parseDocument,
  Document,
  YAMLSeq,
  YAMLMap,
  Scalar,
  isMap,
  isSeq,
  isPair,
  isScalar,
} from "yaml";

export const CODI_MARKER = "managed by codi";

/**
 * Parse the existing pre-commit config (or return an empty Document with
 * `repos: []` when input is empty/whitespace). Throws if input is non-empty
 * and not valid YAML — callers should catch and fall back to backup-and-
 * regenerate.
 */
export function loadOrEmptyDoc(input: string): Document {
  const trimmed = input.trim();
  if (!trimmed) {
    return new Document({ repos: [] });
  }
  const doc = parseDocument(input);
  if (doc.errors.length > 0) {
    throw new Error(`yaml parse: ${doc.errors[0]!.message}`);
  }
  // Ensure repos: is a YAMLSeq we can append to. Three cases the parser
  // produces: missing, present-but-null (e.g. "repos:\n"), and present-as-seq.
  const reposNode = doc.get("repos");
  if (!isSeq(reposNode)) {
    doc.set("repos", new YAMLSeq());
  }
  return doc;
}

export function findReposNode(doc: Document): YAMLSeq | undefined {
  const node = doc.get("repos");
  return isSeq(node) ? (node as YAMLSeq) : undefined;
}

/** True when the given list-item map carries the `# managed by codi` marker on its `repo:` key. */
export function isCodiManagedRepo(node: unknown): boolean {
  if (!isMap(node)) return false;
  const map = node as YAMLMap;
  for (const pair of map.items) {
    if (!isPair(pair)) continue;
    const keyAny = pair.key as unknown;
    const keyName =
      keyAny && typeof keyAny === "object" && "value" in (keyAny as Record<string, unknown>)
        ? (keyAny as { value: unknown }).value
        : keyAny;
    if (keyName === "repo") {
      const valueAny = pair.value as unknown;
      const comment =
        valueAny &&
        typeof valueAny === "object" &&
        "comment" in (valueAny as Record<string, unknown>)
          ? ((valueAny as { comment?: string }).comment ?? "")
          : "";
      const keyComment =
        keyAny && typeof keyAny === "object" && "comment" in (keyAny as Record<string, unknown>)
          ? ((keyAny as { comment?: string }).comment ?? "")
          : "";
      return (comment + " " + keyComment).includes(CODI_MARKER);
    }
  }
  return false;
}

/** Stamp the `# managed by codi` marker on the `repo:` line of a list-item map. */
export function setCodiMarker(node: YAMLMap): void {
  for (const pair of node.items) {
    if (!isPair(pair)) continue;
    const keyAny = pair.key as unknown;
    const keyName =
      keyAny && typeof keyAny === "object" && "value" in (keyAny as Record<string, unknown>)
        ? (keyAny as { value: unknown }).value
        : keyAny;
    if (keyName !== "repo") continue;

    // The yaml lib stores set() values as raw scalars OR Scalar nodes
    // depending on construction. Wrap raw strings so we can attach a
    // trailing comment that survives serialize → reparse round-trips.
    if (isScalar(pair.value)) {
      (pair.value as { comment?: string }).comment = ` ${CODI_MARKER}`;
    } else if (typeof pair.value === "string") {
      const wrapped = new Scalar(pair.value);
      (wrapped as { comment?: string }).comment = ` ${CODI_MARKER}`;
      pair.value = wrapped as unknown as typeof pair.value;
    }
    return;
  }
}

/** Read the `rev:` value from a Codi-marked entry, if any. */
export function readUserPinnedRev(node: YAMLMap): string | null {
  const rev = node.get("rev");
  return typeof rev === "string" ? rev : null;
}

/** Stringify and ensure a single trailing newline. */
export function serialize(doc: Document): string {
  return String(doc).replace(/\n+$/, "") + "\n";
}

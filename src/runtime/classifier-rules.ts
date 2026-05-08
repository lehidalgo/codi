/**
 * Pure detection rules for the change classifier. Each rule is a small
 * function that examines the file path or diff and returns a verdict
 * about a single dimension (file kind, diff shape, etc.).
 *
 * Composition lives in classifier.ts. Keeping rules separate makes them
 * testable in isolation and trivial to extend (with an ADR for any new
 * rule that affects scope classification).
 */

export interface DiffStats {
  linesAdded: number;
  linesRemoved: number;
  linesChanged: number;
  addedLines: string[];
  removedLines: string[];
}

export function computeDiffStats(oldContent: string, newContent: string): DiffStats {
  // Empty content has zero lines — splitting "" by "\n" gives [""] which
  // would produce a phantom blank-line removed in every diff.
  const oldLines = oldContent.length === 0 ? [] : oldContent.split("\n");
  const newLines = newContent.length === 0 ? [] : newContent.split("\n");
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);
  const addedLines = newLines.filter((l) => !oldSet.has(l));
  const removedLines = oldLines.filter((l) => !newSet.has(l));
  return {
    linesAdded: addedLines.length,
    linesRemoved: removedLines.length,
    linesChanged: addedLines.length + removedLines.length,
    addedLines,
    removedLines,
  };
}

// ─── File kind detection ─────────────────────────────────────────────

export function isTestFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    /\.test\.[jt]sx?$/.test(lower) ||
    /\.spec\.[jt]sx?$/.test(lower) ||
    /(^|\/)__tests__\//.test(lower) ||
    /(^|\/)tests\//.test(lower) ||
    /_test\.py$/.test(lower) ||
    /test_[^/]+\.py$/.test(lower)
  );
}

export function isPackageManifest(filePath: string): boolean {
  const base = filePath.split("/").pop() ?? "";
  return (
    base === "package.json" ||
    base === "pnpm-lock.yaml" ||
    base === "yarn.lock" ||
    base === "package-lock.json" ||
    base === "Cargo.toml" ||
    base === "Cargo.lock" ||
    base === "pyproject.toml" ||
    base === "uv.lock" ||
    base === "go.mod" ||
    base === "go.sum"
  );
}

export function isMigrationFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    /(^|\/)migrations?\//.test(lower) ||
    /(^|\/)db\/migrations?\//.test(lower) ||
    /\.sql$/.test(lower) ||
    /(^|\/)prisma\/migrations\//.test(lower) ||
    /(^|\/)alembic\//.test(lower)
  );
}

export function isAdrFile(filePath: string): boolean {
  return /(^|\/)docs\/adr\/[^/]+\.md$/i.test(filePath);
}

export function isContextFile(filePath: string): boolean {
  return /(^|\/)docs\/CONTEXT\.md$/i.test(filePath);
}

export function isSchemaFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    /\.schema\.(json|ts)$/.test(lower) ||
    /(^|\/)schemas?\//.test(lower) ||
    /(^|\/)prisma\/schema\.prisma$/.test(lower)
  );
}

// ─── Diff shape detection ────────────────────────────────────────────

const IMPORT_LINE_PATTERNS: RegExp[] = [
  /^\s*import\s+/, // ES module
  /^\s*const\s+[\w{},\s]+\s*=\s*require\s*\(/, // CommonJS
  /^\s*from\s+\S+\s+import\s+/, // Python
  /^\s*using\s+/, // C# / Rust use
  /^\s*use\s+\S/, // Rust use
];

export function isImportLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return true; // blank lines coexist with imports
  return IMPORT_LINE_PATTERNS.some((re) => re.test(trimmed));
}

export function diffOnlyAddsImports(diff: DiffStats): boolean {
  if (diff.linesAdded === 0) return false;
  if (diff.linesRemoved > 0) return false;
  return diff.addedLines.every(isImportLine);
}

const TYPE_ASSERTION_PATTERNS: RegExp[] = [/\bas\s+[A-Z]\w*/, /:\s*[A-Z]\w*[\s;,)=]/, /<[A-Z]\w*>/];

export function diffOnlyModifiesTypeAssertions(diff: DiffStats): boolean {
  if (diff.linesChanged === 0) return false;
  const all = [...diff.addedLines, ...diff.removedLines];
  return all.every(
    (line) => line.trim().length === 0 || TYPE_ASSERTION_PATTERNS.some((re) => re.test(line)),
  );
}

const EXPORT_LINE_PATTERNS: RegExp[] = [
  /^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\b/,
  /^\s*export\s*\{/,
  /^\s*export\s*\*/,
  /^\s*module\.exports\s*=/,
  /^\s*exports\.\w+\s*=/,
  /^\s*pub\s+(?:fn|struct|enum|trait|mod|use)\b/, // Rust public items
  /^\s*public\s+(?:class|interface|enum|fn|fun|def)\b/,
  /^\s*def\s+[a-z_][\w]*\s*\(/, // Python: any def at module level is public-ish
];

export function diffTouchesExports(diff: DiffStats): boolean {
  const all = [...diff.addedLines, ...diff.removedLines];
  return all.some((line) => EXPORT_LINE_PATTERNS.some((re) => re.test(line)));
}

// ─── Identifier change detection (rough heuristic) ───────────────────

const IDENTIFIER_DEFINITION_PATTERNS: RegExp[] = [
  /\b(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/,
  /\bdef\s+([a-z_][\w]*)/,
  /\bfn\s+([a-z_][\w]*)/,
];

function extractDefinedIdentifiers(lines: string[]): Set<string> {
  const ids = new Set<string>();
  for (const line of lines) {
    for (const re of IDENTIFIER_DEFINITION_PATTERNS) {
      const m = line.match(re);
      if (m && m[1]) ids.add(m[1]);
    }
  }
  return ids;
}

export function diffIntroducesNewIdentifiers(diff: DiffStats): boolean {
  const before = extractDefinedIdentifiers(diff.removedLines);
  const after = extractDefinedIdentifiers(diff.addedLines);
  for (const id of after) {
    if (!before.has(id)) return true;
  }
  return false;
}

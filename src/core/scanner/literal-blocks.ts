/**
 * Literal-block scanner: identifies regions of text that should be treated
 * as illustrative content rather than directives.
 *
 * Two kinds of literal regions are recognised:
 *
 *   1. Fenced code blocks — opened and closed by a line consisting of three
 *      or more backticks or three or more tildes, optionally indented up to
 *      three spaces (CommonMark fenced code rules). Any text between
 *      matching fences is literal.
 *
 *   2. Tag-delimited regions — opened by a line containing `<tagName>` and
 *      closed by `</tagName>`, where `tagName` is one of the configured
 *      example tags (default: `example`). Tag matching is case-insensitive.
 *      Tags inside fenced regions are not recognised (the fence wins).
 *
 * The scanner is line-oriented and never tries to be a full Markdown or XML
 * parser. It exists to reliably skip "this is what unresolved markers look
 * like" examples in skill / rule / agent content so that legitimate teaching
 * material does not trip safety scanners (conflict markers, secrets, banned
 * tokens, etc.).
 *
 * Consumers:
 *   - src/core/hooks/conflict-markers.ts (in-process scanner)
 *   - src/core/hooks/hook-templates.ts CONFLICT_MARKER_CHECK_TEMPLATE
 *     (inlines an equivalent implementation into the generated pre-commit
 *     hook script — kept in sync via tests/integration/hook-template-parity)
 */

const FENCE_RE = /^[ \t]{0,3}(`{3,}|~{3,})/;

export interface LiteralBlocksOptions {
  /** Recognise ``` and ~~~ fenced code blocks as literal. Default: true. */
  fences?: boolean;
  /**
   * XML/HTML-style tag names whose contents are treated as literal regions.
   * Tag matching is case-insensitive. Default: ["example"].
   */
  exampleTags?: readonly string[];
}

export type LiteralBlockKind = "fence" | "tag";

export interface LiteralBlock {
  /** 1-based inclusive line number where the literal region opens. */
  startLine: number;
  /** 1-based inclusive line number where the literal region closes. */
  endLine: number;
  kind: LiteralBlockKind;
  /** For `kind === "tag"` regions, the tag name (lowercased). */
  tag?: string;
}

const DEFAULTS = {
  fences: true,
  exampleTags: ["example"] as const,
} satisfies Required<LiteralBlocksOptions>;

/**
 * Scan text and return the line ranges that should be treated as literal.
 *
 * The returned ranges are sorted by `startLine` and never overlap. Outer
 * fences swallow inner tag pairs; the outer region's lines are reported as a
 * single fence block.
 *
 * An unclosed fence opens a literal region that extends to the last line of
 * the input — this matches how Markdown renderers handle truncated documents
 * and keeps a missing close fence from silently disabling the safety check.
 */
export function findLiteralBlocks(
  text: string,
  options: LiteralBlocksOptions = {},
): LiteralBlock[] {
  const fences = options.fences ?? DEFAULTS.fences;
  const exampleTags = (options.exampleTags ?? DEFAULTS.exampleTags).map((t) => t.toLowerCase());
  const tagOpenRe =
    exampleTags.length > 0 ? new RegExp(`<\\s*(${exampleTags.join("|")})\\s*>`, "i") : null;
  const tagCloseRe = (tag: string): RegExp => new RegExp(`<\\s*/\\s*${tag}\\s*>`, "i");

  const lines = text.split("\n").map((raw) => (raw.endsWith("\r") ? raw.slice(0, -1) : raw));
  const blocks: LiteralBlock[] = [];

  let inFence = false;
  let fenceStart = 0;
  let openTag: string | null = null;
  let tagStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const lineNo = i + 1;

    if (inFence) {
      if (fences && FENCE_RE.test(line)) {
        blocks.push({ kind: "fence", startLine: fenceStart, endLine: lineNo });
        inFence = false;
      }
      continue;
    }

    if (openTag !== null) {
      if (tagCloseRe(openTag).test(line)) {
        blocks.push({
          kind: "tag",
          tag: openTag,
          startLine: tagStart,
          endLine: lineNo,
        });
        openTag = null;
      }
      continue;
    }

    if (fences && FENCE_RE.test(line)) {
      inFence = true;
      fenceStart = lineNo;
      continue;
    }

    if (tagOpenRe) {
      const match = tagOpenRe.exec(line);
      if (match) {
        openTag = match[1]!.toLowerCase();
        tagStart = lineNo;
        // Single-line <example>...</example> closes immediately.
        if (tagCloseRe(openTag).test(line.slice(match.index + match[0].length))) {
          blocks.push({
            kind: "tag",
            tag: openTag,
            startLine: tagStart,
            endLine: tagStart,
          });
          openTag = null;
        }
        continue;
      }
    }
  }

  // Unclosed fence/tag: extend to end of input.
  if (inFence) {
    blocks.push({
      kind: "fence",
      startLine: fenceStart,
      endLine: lines.length,
    });
  } else if (openTag !== null) {
    blocks.push({
      kind: "tag",
      tag: openTag,
      startLine: tagStart,
      endLine: lines.length,
    });
  }

  return blocks;
}

/**
 * Predicate: is the given 1-based line inside any of the supplied literal
 * blocks? O(log n) via binary search on sorted, non-overlapping ranges.
 */
export function lineIsLiteral(line: number, blocks: readonly LiteralBlock[]): boolean {
  let lo = 0;
  let hi = blocks.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const block = blocks[mid]!;
    if (line < block.startLine) hi = mid - 1;
    else if (line > block.endLine) lo = mid + 1;
    else return true;
  }
  return false;
}

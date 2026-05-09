/**
 * Prompt template loader for the 8 consolidation patterns (Item 4).
 *
 * Templates live in `src/templates/consolidation/<pattern>.md.tmpl`. They
 * are plain markdown — no YAML frontmatter — with `{placeholder}` slots
 * that we substitute with values pulled from the proposal under
 * construction.
 *
 * Renderer is pure: filesystem read of the template, then string-replace.
 * No I/O beyond the read. Caller wraps the rendered prompt + sends it to
 * the LLM provider.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PatternCode } from "./types.js";

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the directory holding the .md.tmpl files. Lives next to the
 * compiled output in dist/templates/consolidation/ and next to the source
 * during development at src/templates/consolidation/.
 */
function templatesDir(): string {
  // dist layout:  dist/runtime/consolidate/prompts.js
  //               dist/templates/consolidation/*.md.tmpl
  // src layout:   src/runtime/consolidate/prompts.ts
  //               src/templates/consolidation/*.md.tmpl
  const fromHere = resolve(HERE, "..", "..", "templates", "consolidation");
  if (existsSync(fromHere)) return fromHere;
  // Fallback when imported via different bundler layouts.
  return resolve(HERE, "..", "..", "..", "src", "templates", "consolidation");
}

const PATTERN_TO_FILE: Record<PatternCode, string> = {
  P1: "p1-repeated-correction.md.tmpl",
  P2: "p2-unused-skill.md.tmpl",
  P3: "p3-skill-cofire.md.tmpl",
  P4: "p4-rule-conflict.md.tmpl",
  P5: "p5-new-pattern.md.tmpl",
  P6: "p6-slow-skill.md.tmpl",
  P7: "p7-orphan-cluster.md.tmpl",
  P8: "p8-unused-rule.md.tmpl",
  P9: "p9-artifact-observation.md.tmpl",
};

const cache = new Map<PatternCode, string>();

function loadTemplate(code: PatternCode): string {
  const cached = cache.get(code);
  if (cached !== undefined) return cached;
  const filename = PATTERN_TO_FILE[code];
  const filepath = resolve(templatesDir(), filename);
  if (!existsSync(filepath)) {
    throw new Error(`Consolidation prompt template missing: ${filepath}`);
  }
  const text = readFileSync(filepath, "utf8");
  cache.set(code, text);
  return text;
}

export function clearTemplateCache(): void {
  cache.clear();
}

export type PromptContext = Readonly<Record<string, string | number>>;

/**
 * Render a template with `{placeholder}` substitution. Unknown placeholders
 * are left literal so the LLM can flag them — silent omission would mask
 * bugs in the detector → context wiring.
 */
export function renderPrompt(code: PatternCode, ctx: PromptContext): string {
  const tmpl = loadTemplate(code);
  return tmpl.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = ctx[key];
    return value !== undefined ? String(value) : match;
  });
}

import {
  PROJECT_CONTEXT_START,
  PROJECT_CONTEXT_END,
  PROJECT_CONTEXT_ANCHOR,
} from "#src/constants.js";

/**
 * Extracts the full project-context block (including markers) from an instruction file.
 * Returns null if no markers are found.
 */
export function extractProjectContext(content: string): string | null {
  const startIdx = content.indexOf(PROJECT_CONTEXT_START);
  const endIdx = content.indexOf(PROJECT_CONTEXT_END);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;

  return content.slice(startIdx, endIdx + PROJECT_CONTEXT_END.length);
}

/**
 * Injects a project-context block into generated instruction file content.
 *
 * Resolution order:
 * 1. If the content contains the insertion anchor, replace the anchor with the block.
 * 2. Otherwise, insert before the first `##` heading (legacy behavior).
 * 3. Otherwise, prepend at top.
 */
export function injectProjectContext(generated: string, block: string): string {
  if (generated.includes(PROJECT_CONTEXT_ANCHOR)) {
    return generated.replace(PROJECT_CONTEXT_ANCHOR, block);
  }

  if (generated.startsWith("##")) {
    return block + "\n\n" + generated;
  }

  const firstH2 = generated.indexOf("\n##");

  if (firstH2 === -1) {
    return block + "\n\n" + generated;
  }

  const before = generated.slice(0, firstH2 + 1);
  const after = generated.slice(firstH2 + 1);
  return before + block + "\n\n" + after;
}

/**
 * Prepend the insertion anchor to generated instruction-file content if it is
 * not already present. Called by the generator so every instruction file ships
 * with a deterministic insertion point for the onboarding skill/playbook.
 */
export function ensureProjectContextAnchor(generated: string): string {
  if (generated.includes(PROJECT_CONTEXT_ANCHOR)) return generated;
  if (generated.includes(PROJECT_CONTEXT_START)) return generated;
  return `${PROJECT_CONTEXT_ANCHOR}\n\n${generated}`;
}

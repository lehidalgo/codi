import { PROJECT_CONTEXT_START, PROJECT_CONTEXT_END } from "#src/constants.js";

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
 * Inserts before the first `##` heading. If none found, prepends at top.
 * Returns the updated content string.
 */
export function injectProjectContext(generated: string, block: string): string {
  // First ## is at the very start of the file — prepend the block before it
  if (generated.startsWith("##")) {
    return block + "\n\n" + generated;
  }

  const firstH2 = generated.indexOf("\n##");

  if (firstH2 === -1) {
    return block + "\n\n" + generated;
  }

  // Insert before the \n that precedes the first ## heading
  const before = generated.slice(0, firstH2 + 1); // up to and including the \n
  const after = generated.slice(firstH2 + 1);
  return before + block + "\n\n" + after;
}

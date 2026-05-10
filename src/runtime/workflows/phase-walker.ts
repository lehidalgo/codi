/**
 * Generic phase walker. Each adapter declares its phase order; the walker
 * computes "what's the next non-skipped phase from `currentPhase`?" without
 * any workflow-specific knowledge.
 */

export function computeNextPhase(
  phaseOrder: readonly string[],
  skipPhases: readonly string[],
  currentPhase: string,
): string | null {
  const skip = new Set(skipPhases);
  const idx = phaseOrder.indexOf(currentPhase);
  if (idx === -1 || idx === phaseOrder.length - 1) return null;
  for (let i = idx + 1; i < phaseOrder.length; i++) {
    const candidate = phaseOrder[i];
    if (candidate === undefined) continue;
    if (!skip.has(candidate)) return candidate;
  }
  return null;
}

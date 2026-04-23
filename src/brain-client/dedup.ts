import type { ExtractionCandidate } from "./types.js";

export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

export function dedupCandidates(
  candidates: ExtractionCandidate[],
  existingTitles: Set<string>,
): ExtractionCandidate[] {
  return candidates.filter((c) => !existingTitles.has(normalizeTitle(c.title)));
}

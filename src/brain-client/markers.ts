export type MarkerType = "DECISION" | "HOT" | "NOTE";

export interface CodiMarker {
  type: MarkerType;
  payload: Record<string, unknown>;
}

export interface ParseResult extends Array<CodiMarker> {
  parseErrors: Array<{ raw: string; error: string }>;
}

const MARKER_REGEX = /<CODI-(DECISION|HOT|NOTE)@v1>\s*([\s\S]+?)\s*<\/CODI-\1@v1>/g;

export function parseMarkers(transcript: string): ParseResult {
  const markers: CodiMarker[] = [];
  const parseErrors: Array<{ raw: string; error: string }> = [];
  // Fresh regex per invocation so the /g iteration state does not leak
  // across calls. matchAll returns a complete iterator without side effects
  // on the source regex object.
  const re = new RegExp(MARKER_REGEX.source, MARKER_REGEX.flags);
  for (const match of transcript.matchAll(re)) {
    const typeRaw = match[1];
    const body = match[2];
    if (!typeRaw || !body) continue;
    const type = typeRaw as MarkerType;
    try {
      const payload = JSON.parse(body) as Record<string, unknown>;
      markers.push({ type, payload });
    } catch (e) {
      parseErrors.push({ raw: body, error: (e as Error).message });
    }
  }
  const result = markers as ParseResult;
  result.parseErrors = parseErrors;
  return result;
}

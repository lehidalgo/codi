/** Input shape for POST /notes. Matches brain-side Week 2A NoteBody. */
export interface CreateNoteInput {
  kind: "decision" | "hot";
  title: string;
  body: string;
  tags: string[];
  links: string[];
  session_id: string | null;
}

/** Response shape for POST /notes. */
export interface NoteResponse {
  id: string;
  url: string;
  vault_path: string;
  session_id: string | null;
  warnings: string[];
}

/** GET /notes/search query. */
export interface SearchQuery {
  q?: string;
  kind?: "decision" | "hot";
  tag?: string[];
  limit?: number;
  recent_days?: number;
}

/** Individual hit in /notes/search results. */
export interface NoteHit {
  id: string;
  kind: string;
  title: string;
  body: string;
  tags: string[];
  created_at: string;
  vault_path: string;
  score: number;
}

/** GET /hot response shape. */
export interface HotResponse {
  body: string;
  updated_at: string | null;
}

/** POST /vault/reconcile response. */
export interface ReconcileReport {
  trigger: string;
  scanned: number;
  created: number;
  updated: number;
  tombstoned: number;
  orphans_cleaned: number;
  errors: string[];
}

/** GET /healthz response. */
export interface HealthResponse {
  status: "ok" | "degraded";
  checks: Record<string, string>;
  version: string;
}

/** Error envelope per brain design spec §4.1. */
export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    request_id: string;
  };
}

/** Extraction candidate from Gemini structured output.
 *
 * Declared here (not in extractor.ts) so dedup.ts can import it without
 * creating a cyclic dependency back to extractor.ts. */
export interface ExtractionCandidate {
  title: string;
  body: string;
  tags: string[];
  evidence_quote: string;
  confidence: number;
  type: "decision" | "fact" | "hot-state";
}

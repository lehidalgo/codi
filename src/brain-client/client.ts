import { brainFetch } from "./http.js";
import { writeToOutbox } from "./outbox.js";
import { BrainNetworkError, BrainServerError } from "./errors.js";
import type {
  CreateNoteInput,
  NoteResponse,
  SearchQuery,
  NoteHit,
  HotResponse,
  ReconcileReport,
  HealthResponse,
} from "./types.js";

export interface CreateBrainClientOptions {
  url: string;
  token: string | null;
  projectRoot: string;
  sessionId: string;
  enableOutbox?: boolean;
  maxRetries?: number;
  retryBaseMs?: number;
  timeoutMs?: number;
}

export interface BrainClient {
  createNote(input: CreateNoteInput): Promise<NoteResponse>;
  searchNotes(query: SearchQuery): Promise<NoteHit[]>;
  getHot(): Promise<HotResponse>;
  putHot(body: string): Promise<HotResponse>;
  reconcile(paths?: string[]): Promise<ReconcileReport>;
  health(): Promise<HealthResponse>;
}

function buildSearchPath(q: SearchQuery): string {
  const params = new URLSearchParams();
  if (q.q) params.set("q", q.q);
  if (q.kind) params.set("kind", q.kind);
  for (const t of q.tag ?? []) params.append("tag", t);
  if (q.limit !== undefined) params.set("limit", String(q.limit));
  if (q.recent_days !== undefined) params.set("recent_days", String(q.recent_days));
  const s = params.toString();
  return s ? `/notes/search?${s}` : "/notes/search";
}

export function createBrainClient(opts: CreateBrainClientOptions): BrainClient {
  const fetchOpts = {
    url: opts.url,
    token: opts.token,
    maxRetries: opts.maxRetries,
    retryBaseMs: opts.retryBaseMs,
    timeoutMs: opts.timeoutMs,
  };

  async function safeWrite<T>(
    method: "POST" | "PUT",
    urlPath: string,
    body: unknown,
    queuedResponse: () => T,
  ): Promise<T> {
    try {
      return await brainFetch<T>(fetchOpts, method, urlPath, body);
    } catch (e) {
      const transient = e instanceof BrainNetworkError || e instanceof BrainServerError;
      if (transient && opts.enableOutbox) {
        await writeToOutbox(opts.projectRoot, {
          method,
          path: urlPath,
          body,
          sessionId: opts.sessionId,
        });
        return queuedResponse();
      }
      throw e;
    }
  }

  return {
    createNote: (input) =>
      safeWrite<NoteResponse>("POST", "/notes", input, () => ({
        id: "queued",
        url: "",
        vault_path: "",
        session_id: input.session_id,
        warnings: ["queued-in-outbox"],
      })),
    searchNotes: async (query) => {
      const r = await brainFetch<{ results: NoteHit[] }>(fetchOpts, "GET", buildSearchPath(query));
      return r.results;
    },
    getHot: () => brainFetch<HotResponse>(fetchOpts, "GET", "/hot"),
    putHot: (body) =>
      safeWrite<HotResponse>("PUT", "/hot", { body }, () => ({
        body,
        updated_at: null,
      })),
    reconcile: (paths) =>
      brainFetch<ReconcileReport>(
        fetchOpts,
        "POST",
        "/vault/reconcile",
        paths ? { paths } : undefined,
      ),
    health: () => brainFetch<HealthResponse>(fetchOpts, "GET", "/healthz"),
  };
}

export { createBrainClient } from "./client.js";
export type { BrainClient, CreateBrainClientOptions } from "./client.js";
export { resolveBrainConfig } from "./config.js";
export type { BrainClientConfig } from "./config.js";
export {
  BrainClientError,
  BrainAuthError,
  BrainNotFoundError,
  BrainRateLimitError,
  BrainServerError,
  BrainNetworkError,
} from "./errors.js";
export type {
  CreateNoteInput,
  NoteResponse,
  SearchQuery,
  NoteHit,
  HotResponse,
  ReconcileReport,
  HealthResponse,
  ExtractionCandidate,
} from "./types.js";
export { drainOutbox, writeToOutbox } from "./outbox.js";
export type { OutboxEntry } from "./outbox.js";

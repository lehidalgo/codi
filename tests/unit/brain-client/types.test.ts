import { describe, it, expect } from "vitest";
import type {
  CreateNoteInput,
  NoteResponse,
  SearchQuery,
  NoteHit,
  HotResponse,
  ReconcileReport,
  HealthResponse,
  ErrorEnvelope,
  ExtractionCandidate,
} from "#src/brain-client/types.js";

describe("brain-client types", () => {
  it("CreateNoteInput shape matches brain spec", () => {
    const input: CreateNoteInput = {
      kind: "decision",
      title: "t",
      body: "b",
      tags: ["x"],
      links: [],
      session_id: null,
    };
    expect(input.kind).toBe("decision");
  });

  it("ErrorEnvelope matches brain §4.1 shape", () => {
    const err: ErrorEnvelope = {
      error: {
        code: "INVALID_NOTE_KIND",
        message: "kind must be 'decision'",
        request_id: "abc-123",
      },
    };
    expect(err.error.code).toBe("INVALID_NOTE_KIND");
  });

  it("NoteHit carries score + vault_path", () => {
    const hit: NoteHit = {
      id: "n-1",
      kind: "decision",
      title: "t",
      body: "b",
      tags: [],
      created_at: "2026-04-23T00:00:00Z",
      vault_path: "decisions/t.md",
      score: 0.9,
    };
    expect(hit.score).toBe(0.9);
  });

  it("ExtractionCandidate lives in types.ts to avoid extractor-dedup cycle", () => {
    const c: ExtractionCandidate = {
      title: "t",
      body: "b",
      tags: [],
      evidence_quote: "q",
      confidence: 0.5,
      type: "decision",
    };
    expect(c.type).toBe("decision");
  });

  it("SearchQuery + HotResponse + ReconcileReport + HealthResponse compile", () => {
    const q: SearchQuery = { q: "test", limit: 5 };
    const h: HotResponse = { body: "x", updated_at: null };
    const r: ReconcileReport = {
      trigger: "manual",
      scanned: 0,
      created: 0,
      updated: 0,
      tombstoned: 0,
      orphans_cleaned: 0,
      errors: [],
    };
    const status: HealthResponse = { status: "ok", checks: {}, version: "0.1" };
    const note: NoteResponse = {
      id: "n-1",
      url: "/notes/n-1",
      vault_path: "x.md",
      session_id: null,
      warnings: [],
    };
    expect(q.q).toBe("test");
    expect(h.body).toBe("x");
    expect(r.errors).toEqual([]);
    expect(status.status).toBe("ok");
    expect(note.id).toBe("n-1");
  });
});

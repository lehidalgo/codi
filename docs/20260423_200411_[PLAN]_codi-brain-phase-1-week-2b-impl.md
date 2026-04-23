# Codi Brain — Phase 1 Week 2B Implementation Plan

> **For agentic workers:** Use `codi-plan-execution` to implement this plan task-by-task. That skill asks the user to pick INLINE (sequential) or SUBAGENT (fresh subagent per task with two-stage review) mode. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Week 2B — the client-side adoption of the Codi Brain. `codi add`/`codi update` installs a Node/TS client library, six skills, one rule, three Claude Code hooks, and a `codi brain` CLI subcommand. A Claude Code session in a project with Codi installed automatically recalls hot state + recent decisions on start, captures decisions mid-session via `<CODI-DECISION@v1>…</…>` markers, and optionally extracts decisions via Gemini 2.5 Flash at end of session — all privacy-safe, cost-aware, with every failure mode degrading gracefully.

**Architecture:** Six-layer capture/recall model (see design spec §2). One shared `src/brain-client/` Node library consumed by every surface (skills, hooks, CLI). Hooks are `.cjs` scripts built via `src/core/hooks/brain-hooks.ts` and emitted to `.codi/hooks/` during `codi generate`; registered in `.claude/settings.json` under standard Claude Code events (`SessionStart`, `Stop`, `PostToolUse`). The extensible redactor is a standalone module so pattern additions are one-file changes with a test. Gemini 2.5 Flash extraction is opt-in via `.codi/config.yaml` `brain.auto_extract: true`; off by default.

**Tech Stack:** Node 24 + TypeScript (strict), pnpm, vitest, msw (new dep for HTTP mocking), zod (already in use for schema validation), yaml (already in use), commander (existing CLI framework). Gemini SDK (`@google/generative-ai`, new dep) used only by the opt-in extractor module. No Python.

**Task count:** 41 tasks across 8 phases (A–H). Numbered 2B.1 through 2B.39 plus 2B.16a, 2B.16b, 2B.24a (inserts keep the sequential numbering stable while adding atomic splits).

**Prerequisites (verify before starting):**

- Working tree: `~/projects/codi`, branch `feature/codex-stdio-hardening`, clean.
- `pnpm install` succeeds.
- Baseline: `pnpm test` → all green on the current branch.
- Codi Brain Week 2A is running reachable at `http://127.0.0.1:8000` for Phase G E2E tests, or skip those with `VITEST_SKIP_E2E=1`.

**Design spec:** `docs/20260423_192802_[PLAN]_codi-brain-phase-1-week-2b-design.md`. Read before starting.

---

## Progress log

*Updated during execution. Leave empty until Phase A kicks off.*

---

## File structure

New paths created by this plan:

```
src/brain-client/
  index.ts                 # public exports
  client.ts                # createBrainClient factory + BrainClient type
  config.ts                # resolveBrainConfig (env + yaml precedence)
  types.ts                 # CreateNoteInput, NoteResponse, etc.
  http.ts                  # fetch wrapper with retries
  outbox.ts                # write/flush .codi/brain-outbox/
  errors.ts                # BrainClientError hierarchy
  redactor.ts              # redactTranscript(raw, patterns)
  redactor-patterns.ts     # redaction patterns (extensible)
  extractor.ts             # extractWithGemini(redacted, schema)
  dedup.ts                 # dedupCandidates(candidates, markerSet)
  markers.ts               # parseMarkers(transcript) → CodiMarker[]

src/core/hooks/
  brain-hooks.ts           # buildBrain{SessionStart,Stop,PostCommit}Script

src/cli/
  brain.ts                 # registerBrainCommand + handlers

src/templates/skills/
  codi-brain-decide/{index.ts,template.ts}
  codi-brain-recall/{index.ts,template.ts}
  codi-brain-hot-set/{index.ts,template.ts}
  codi-brain-hot-get/{index.ts,template.ts}
  codi-brain-review/{index.ts,template.ts}
  codi-brain-undo-session/{index.ts,template.ts}

src/templates/rules/
  codi-brain-capture.md

tests/unit/brain-client/*.test.ts
tests/unit/cli/brain.test.ts
tests/unit/core/hooks/brain-hooks.test.ts
tests/integration/brain-client/live.test.ts       # gated on brain reachability
tests/e2e/brain-week2b-scenario.test.ts           # full-loop ship test
```

Files modified:

```
src/cli.ts                                                # register brain command
package.json                                              # add msw, @google/generative-ai
src/core/hooks/index.ts                                   # export brain-hook builders
src/templates/skills/brainstorming/template.ts            # Layer 6: emit DECISION markers on spec approval
src/templates/skills/branch-finish/template.ts            # Layer 6: emit DECISION marker on merge
src/templates/skills/debugging/template.ts                # Layer 6: emit DECISION marker on root-cause conclusion
```

---

## Phase A — Client library: types + config + HTTP + outbox (10 tasks)

Foundation layer. Every other phase depends on this. Pure Node/TS, no agent concepts yet.

### Task 2B.1 — Add new deps

- [ ] **Files**: `package.json`
  **Est**: 2 minutes

  **Steps**:
  1. Edit `package.json` `devDependencies` — add:
     ```json
     "msw": "^2.6.0"
     ```
  2. Edit `package.json` `dependencies` — add:
     ```json
     "@google/generative-ai": "^0.24.0"
     ```
  3. Run `pnpm install`. Expected: lockfile updates, no vulnerabilities.
  4. Verify imports resolve:
     ```bash
     node --input-type=module -e "import('msw').then(m => console.log('msw ok:', !!m.http)); import('@google/generative-ai').then(m => console.log('gemini ok:', !!m.GoogleGenerativeAI));"
     ```
     Expected: `msw ok: true`, `gemini ok: true`.
  5. Commit: `git add package.json pnpm-lock.yaml && git commit -m "chore: add msw + @google/generative-ai for Week 2B"`

  **Verification**: `pnpm test` still green.

### Task 2B.2 — Define brain-client types

- [ ] **Files**: `src/brain-client/types.ts`, `tests/unit/brain-client/types.test.ts`
  **Est**: 4 minutes

  **Steps**:
  1. Write failing test `tests/unit/brain-client/types.test.ts`:
     ```typescript
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
     });
     ```
  2. Verify fails: `pnpm test tests/unit/brain-client/types.test.ts` — expected: `Cannot find module`.
  3. Create `src/brain-client/types.ts`:
     ```typescript
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

     /** Extraction candidate from Gemini structured output. Shared here so
      *  dedup.ts can import it without creating a cycle back to extractor.ts. */
     export interface ExtractionCandidate {
       title: string;
       body: string;
       tags: string[];
       evidence_quote: string;
       confidence: number;
       type: "decision" | "fact" | "hot-state";
     }
     ```
  4. Verify passes: `pnpm test tests/unit/brain-client/types.test.ts` — expected: 2 passed.
  5. Commit: `git add src/brain-client/types.ts tests/unit/brain-client/types.test.ts && git commit -m "feat(brain-client): define HTTP types"`

  **Verification**: types file compiles via `pnpm lint`.

### Task 2B.3 — Typed error hierarchy

- [ ] **Files**: `src/brain-client/errors.ts`, `tests/unit/brain-client/errors.test.ts`
  **Est**: 5 minutes

  **Steps**:
  1. Write failing test `tests/unit/brain-client/errors.test.ts`:
     ```typescript
     import { describe, it, expect } from "vitest";
     import {
       BrainClientError,
       BrainAuthError,
       BrainNotFoundError,
       BrainRateLimitError,
       BrainServerError,
       BrainNetworkError,
       fromEnvelope,
     } from "#src/brain-client/errors.js";

     describe("brain-client errors", () => {
       it("fromEnvelope picks subclass by HTTP status", () => {
         const env = { error: { code: "X", message: "x", request_id: "r" } };
         expect(fromEnvelope(401, env)).toBeInstanceOf(BrainAuthError);
         expect(fromEnvelope(403, env)).toBeInstanceOf(BrainAuthError);
         expect(fromEnvelope(404, env)).toBeInstanceOf(BrainNotFoundError);
         expect(fromEnvelope(429, env)).toBeInstanceOf(BrainRateLimitError);
         expect(fromEnvelope(500, env)).toBeInstanceOf(BrainServerError);
         expect(fromEnvelope(502, env)).toBeInstanceOf(BrainServerError);
         expect(fromEnvelope(400, env)).toBeInstanceOf(BrainClientError);
       });

       it("carries code + request_id + status", () => {
         const e = fromEnvelope(502, { error: { code: "VAULT_EMBED_FAILED", message: "m", request_id: "abc" } });
         expect(e.code).toBe("VAULT_EMBED_FAILED");
         expect(e.requestId).toBe("abc");
         expect(e.status).toBe(502);
       });

       it("BrainNetworkError has no status", () => {
         const e = new BrainNetworkError("ECONNREFUSED");
         expect(e.status).toBe(0);
         expect(e.code).toBe("BRAIN_NETWORK_ERROR");
         expect(e).toBeInstanceOf(BrainClientError);
       });

       it("BrainRateLimitError exposes retryAfterMs", () => {
         const e = new BrainRateLimitError("R", "msg", "r", 5000);
         expect(e.retryAfterMs).toBe(5000);
       });
     });
     ```
  2. Verify fails: `pnpm test tests/unit/brain-client/errors.test.ts` — expected: `Cannot find module` (module does not exist yet).
  3. Implement `src/brain-client/errors.ts`:
     ```typescript
     import type { ErrorEnvelope } from "./types.js";

     export class BrainClientError extends Error {
       public readonly status: number;
       public readonly code: string;
       public readonly requestId: string;
       constructor(status: number, code: string, message: string, requestId = "") {
         super(message);
         this.name = "BrainClientError";
         this.status = status;
         this.code = code;
         this.requestId = requestId;
       }
     }

     export class BrainAuthError extends BrainClientError {
       constructor(code: string, message: string, requestId = "") {
         super(401, code, message, requestId);
         this.name = "BrainAuthError";
       }
     }

     export class BrainNotFoundError extends BrainClientError {
       constructor(code: string, message: string, requestId = "") {
         super(404, code, message, requestId);
         this.name = "BrainNotFoundError";
       }
     }

     export class BrainRateLimitError extends BrainClientError {
       public readonly retryAfterMs: number;
       constructor(code: string, message: string, requestId = "", retryAfterMs = 1000) {
         super(429, code, message, requestId);
         this.name = "BrainRateLimitError";
         this.retryAfterMs = retryAfterMs;
       }
     }

     export class BrainServerError extends BrainClientError {
       constructor(status: number, code: string, message: string, requestId = "") {
         super(status, code, message, requestId);
         this.name = "BrainServerError";
       }
     }

     export class BrainNetworkError extends BrainClientError {
       constructor(message: string) {
         super(0, "BRAIN_NETWORK_ERROR", message, "");
         this.name = "BrainNetworkError";
       }
     }

     export function fromEnvelope(status: number, body: ErrorEnvelope): BrainClientError {
       const { code, message, request_id } = body.error;
       if (status === 401 || status === 403) return new BrainAuthError(code, message, request_id);
       if (status === 404) return new BrainNotFoundError(code, message, request_id);
       if (status === 429) return new BrainRateLimitError(code, message, request_id);
       if (status >= 500) return new BrainServerError(status, code, message, request_id);
       return new BrainClientError(status, code, message, request_id);
     }
     ```
  4. Verify passes: `pnpm test tests/unit/brain-client/errors.test.ts` — expected: 4 passed.
  5. Commit: `git add src/brain-client/errors.ts tests/unit/brain-client/errors.test.ts && git commit -m "feat(brain-client): typed error hierarchy"`

> **TDD discipline (applies to every subsequent task):** Every task follows the strict red-then-green cycle:
> 1. Write the test file with the exact test code shown.
> 2. Run `pnpm test <test-path>` and confirm it fails with the expected error (module-not-found if the impl file doesn't exist, or assertion failure if it does).
> 3. Write the implementation.
> 4. Run `pnpm test <test-path>` and confirm it passes.
> 5. Commit both files together with the conventional-commit message shown.
>
> Where a task below lists test behaviors in prose rather than inlined code, the executor is expected to translate the prose into vitest code following the Phase A test file structure (beforeEach/afterEach with tmpdir, msw setupServer when HTTP is involved, `#src/...` path aliases). A test that asserts "X" is not optional — the executor must write an assertion whose failure message on a broken impl is clear enough to diagnose.

### Task 2B.4 — Config resolution — failing test + implementation

- [ ] **Files**: `src/brain-client/config.ts`, `tests/unit/brain-client/config.test.ts`
  **Est**: 8 minutes (combined red + green)

  **Test (write first, verify red):**
  ```typescript
  import { describe, it, expect, beforeEach, afterEach } from "vitest";
  import fs from "node:fs/promises";
  import path from "node:path";
  import os from "node:os";
  import { resolveBrainConfig } from "#src/brain-client/config.js";

  describe("resolveBrainConfig", () => {
    let tmp: string;
    beforeEach(async () => {
      tmp = await fs.mkdtemp(path.join(os.tmpdir(), "codi-brain-cfg-"));
    });
    afterEach(async () => {
      await fs.rm(tmp, { recursive: true, force: true });
      delete process.env.BRAIN_URL;
      delete process.env.BRAIN_BEARER_TOKEN;
      delete process.env.BRAIN_AUTO_EXTRACT;
    });

    it("uses defaults when nothing configured", async () => {
      const cfg = await resolveBrainConfig({ projectRoot: tmp, homeDir: tmp });
      expect(cfg.url).toBe("http://127.0.0.1:8000");
      expect(cfg.token).toBeNull();
      expect(cfg.autoExtract).toBe(false);
    });

    it("env wins over yaml", async () => {
      await fs.mkdir(path.join(tmp, ".codi"), { recursive: true });
      await fs.writeFile(
        path.join(tmp, ".codi/config.yaml"),
        "brain:\n  url: http://yaml.example\n  bearer_token: yaml-token\n",
      );
      process.env.BRAIN_URL = "http://env.example";
      process.env.BRAIN_BEARER_TOKEN = "env-token";
      const cfg = await resolveBrainConfig({ projectRoot: tmp, homeDir: tmp });
      expect(cfg.url).toBe("http://env.example");
      expect(cfg.token).toBe("env-token");
    });

    it("malformed yaml falls back to defaults with warning", async () => {
      await fs.mkdir(path.join(tmp, ".codi"), { recursive: true });
      await fs.writeFile(path.join(tmp, ".codi/config.yaml"), "brain: [unclosed");
      const warnings: string[] = [];
      const cfg = await resolveBrainConfig({
        projectRoot: tmp,
        homeDir: tmp,
        onWarn: (m) => warnings.push(m),
      });
      expect(cfg.url).toBe("http://127.0.0.1:8000");
      expect(warnings.length).toBe(1);
    });

    it("auto_extract from yaml", async () => {
      await fs.mkdir(path.join(tmp, ".codi"), { recursive: true });
      await fs.writeFile(
        path.join(tmp, ".codi/config.yaml"),
        "brain:\n  auto_extract: true\n  auto_extract_confidence_threshold: 0.9\n",
      );
      const cfg = await resolveBrainConfig({ projectRoot: tmp, homeDir: tmp });
      expect(cfg.autoExtract).toBe(true);
      expect(cfg.autoExtractConfidenceThreshold).toBe(0.9);
    });
  });
  ```

  **Implementation `src/brain-client/config.ts`:**
  ```typescript
  import fs from "node:fs/promises";
  import path from "node:path";
  import YAML from "yaml";

  export interface BrainClientConfig {
    url: string;
    token: string | null;
    autoExtract: boolean;
    autoExtractModel: string;
    autoExtractConfidenceThreshold: number;
    geminiApiKey: string | null;
  }

  export interface ResolveOptions {
    projectRoot: string;
    homeDir: string;
    onWarn?: (message: string) => void;
  }

  const DEFAULTS: BrainClientConfig = {
    url: "http://127.0.0.1:8000",
    token: null,
    autoExtract: false,
    autoExtractModel: "gemini-2.5-flash",
    autoExtractConfidenceThreshold: 0.8,
    geminiApiKey: null,
  };

  interface YamlShape {
    brain?: {
      url?: string;
      bearer_token?: string;
      auto_extract?: boolean;
      auto_extract_model?: string;
      auto_extract_confidence_threshold?: number;
      gemini_api_key?: string;
    };
  }

  async function readYaml(
    filePath: string,
    onWarn?: (m: string) => void,
  ): Promise<YamlShape | null> {
    try {
      const text = await fs.readFile(filePath, "utf-8");
      return YAML.parse(text) as YamlShape;
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === "ENOENT") return null;
      onWarn?.(`WARN brain config parse error at ${filePath}: ${err.message}`);
      return null;
    }
  }

  function applyYaml(cfg: BrainClientConfig, yaml: YamlShape | null): BrainClientConfig {
    if (!yaml?.brain) return cfg;
    const b = yaml.brain;
    return {
      ...cfg,
      ...(b.url !== undefined && { url: b.url }),
      ...(b.bearer_token !== undefined && { token: b.bearer_token }),
      ...(b.auto_extract !== undefined && { autoExtract: b.auto_extract }),
      ...(b.auto_extract_model !== undefined && { autoExtractModel: b.auto_extract_model }),
      ...(b.auto_extract_confidence_threshold !== undefined && {
        autoExtractConfidenceThreshold: b.auto_extract_confidence_threshold,
      }),
      ...(b.gemini_api_key !== undefined && { geminiApiKey: b.gemini_api_key }),
    };
  }

  export async function resolveBrainConfig(
    opts: ResolveOptions,
  ): Promise<BrainClientConfig> {
    let cfg: BrainClientConfig = { ...DEFAULTS };

    // 3. User-global yaml (lowest non-default precedence)
    const userYaml = await readYaml(path.join(opts.homeDir, ".codi/config.yaml"), opts.onWarn);
    cfg = applyYaml(cfg, userYaml);

    // 2. Project yaml (overrides user-global)
    const projYaml = await readYaml(path.join(opts.projectRoot, ".codi/config.yaml"), opts.onWarn);
    cfg = applyYaml(cfg, projYaml);

    // 1. Env (highest precedence)
    if (process.env.BRAIN_URL) cfg.url = process.env.BRAIN_URL;
    if (process.env.BRAIN_BEARER_TOKEN) cfg.token = process.env.BRAIN_BEARER_TOKEN;
    if (process.env.BRAIN_AUTO_EXTRACT === "true") cfg.autoExtract = true;
    if (process.env.BRAIN_AUTO_EXTRACT === "false") cfg.autoExtract = false;
    if (process.env.GEMINI_API_KEY) cfg.geminiApiKey = process.env.GEMINI_API_KEY;

    return cfg;
  }
  ```

  Verify: `pnpm test tests/unit/brain-client/config.test.ts` — expected: 4 passed.
  Commit: `git add src/brain-client/config.ts tests/unit/brain-client/config.test.ts && git commit -m "feat(brain-client): config resolution (env > project > user > defaults)"`

### Task 2B.5 — HTTP wrapper (test + impl)

- [ ] **Files**: `src/brain-client/http.ts`, `tests/unit/brain-client/http.test.ts`
  **Est**: 10 minutes

  **Test `tests/unit/brain-client/http.test.ts` (write first; verify fails with module-not-found):**
  ```typescript
  import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
  import { http, HttpResponse } from "msw";
  import { setupServer } from "msw/node";
  import { brainFetch } from "#src/brain-client/http.js";
  import { BrainAuthError, BrainServerError, BrainNetworkError, BrainRateLimitError } from "#src/brain-client/errors.js";

  const server = setupServer();
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterAll(() => server.close());
  afterEach(() => server.resetHandlers());

  describe("brainFetch", () => {
    it("sends Authorization: Bearer <token>", async () => {
      let seen: string | null = null;
      server.use(
        http.get("http://brain.test/healthz", ({ request }) => {
          seen = request.headers.get("Authorization");
          return HttpResponse.json({ status: "ok", checks: {}, version: "0" });
        }),
      );
      await brainFetch({ url: "http://brain.test", token: "tok" }, "GET", "/healthz");
      expect(seen).toBe("Bearer tok");
    });

    it("returns parsed JSON on 200", async () => {
      server.use(
        http.get("http://brain.test/hot", () =>
          HttpResponse.json({ body: "hi", updated_at: "2026-04-23" }),
        ),
      );
      const r = await brainFetch<{ body: string }>(
        { url: "http://brain.test", token: "t" }, "GET", "/hot",
      );
      expect(r.body).toBe("hi");
    });

    it("throws BrainAuthError on 401", async () => {
      server.use(
        http.post("http://brain.test/notes", () =>
          HttpResponse.json({ error: { code: "AUTH", message: "no", request_id: "r1" } }, { status: 401 }),
        ),
      );
      await expect(
        brainFetch({ url: "http://brain.test", token: "bad" }, "POST", "/notes", {}),
      ).rejects.toBeInstanceOf(BrainAuthError);
    });

    it("retries 5xx up to 3 times with backoff", async () => {
      let calls = 0;
      server.use(
        http.get("http://brain.test/healthz", () => {
          calls++;
          if (calls < 3) {
            return HttpResponse.json({ error: { code: "X", message: "x", request_id: "" } }, { status: 500 });
          }
          return HttpResponse.json({ status: "ok", checks: {}, version: "0" });
        }),
      );
      const r = await brainFetch<{ status: string }>(
        { url: "http://brain.test", token: "t", retryBaseMs: 1 }, "GET", "/healthz",
      );
      expect(calls).toBe(3);
      expect(r.status).toBe("ok");
    });

    it("does NOT retry 4xx", async () => {
      let calls = 0;
      server.use(
        http.post("http://brain.test/notes", () => {
          calls++;
          return HttpResponse.json(
            { error: { code: "INVALID_NOTE_KIND", message: "k", request_id: "r" } },
            { status: 400 },
          );
        }),
      );
      await expect(
        brainFetch({ url: "http://brain.test", token: "t" }, "POST", "/notes", {}),
      ).rejects.toThrow();
      expect(calls).toBe(1);
    });

    it("throws BrainNetworkError when host unreachable", async () => {
      await expect(
        brainFetch({ url: "http://127.0.0.1:1", token: "t", retryBaseMs: 1, maxRetries: 0 }, "GET", "/healthz"),
      ).rejects.toBeInstanceOf(BrainNetworkError);
    });

    it("honors Retry-After header on 429", async () => {
      server.use(
        http.post("http://brain.test/notes", () =>
          HttpResponse.json(
            { error: { code: "R", message: "r", request_id: "x" } },
            { status: 429, headers: { "Retry-After": "2" } },
          ),
        ),
      );
      try {
        await brainFetch(
          { url: "http://brain.test", token: "t", retryBaseMs: 1, maxRetries: 0 },
          "POST", "/notes", {},
        );
      } catch (e) {
        expect(e).toBeInstanceOf(BrainRateLimitError);
        expect((e as BrainRateLimitError).retryAfterMs).toBe(2000);
        return;
      }
      throw new Error("expected throw");
    });
  });
  ```
  Verify fails: `pnpm test tests/unit/brain-client/http.test.ts` — expected: `Cannot find module #src/brain-client/http.js`.

  **Implementation (`src/brain-client/http.ts`):**
  ```typescript
  import { BrainNetworkError, BrainRateLimitError, BrainServerError, fromEnvelope } from "./errors.js";
  import type { ErrorEnvelope } from "./types.js";

  export interface FetchOptions {
    url: string;
    token: string | null;
    maxRetries?: number;
    retryBaseMs?: number;
    timeoutMs?: number;
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  export async function brainFetch<T>(
    opts: FetchOptions,
    method: "GET" | "POST" | "PUT" | "DELETE",
    urlPath: string,
    body?: unknown,
  ): Promise<T> {
    const maxRetries = opts.maxRetries ?? 3;
    const retryBase = opts.retryBaseMs ?? 100;
    const timeout = opts.timeoutMs ?? 10_000;

    const headers: Record<string, string> = { Accept: "application/json" };
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    let attempt = 0;
    try {
      while (true) {
        let res: Response;
        try {
          res = await fetch(`${opts.url}${urlPath}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller.signal,
          });
        } catch (e) {
          throw new BrainNetworkError((e as Error).message);
        }

        if (res.ok) {
          if (res.status === 204) return undefined as T;
          return (await res.json()) as T;
        }

        const bodyText = await res.text();
        let envelope: ErrorEnvelope;
        try {
          envelope = JSON.parse(bodyText) as ErrorEnvelope;
        } catch {
          envelope = {
            error: { code: `HTTP_${res.status}`, message: bodyText, request_id: "" },
          };
        }
        const err = fromEnvelope(res.status, envelope);

        if (err instanceof BrainRateLimitError) {
          const retryAfter = res.headers.get("Retry-After");
          if (retryAfter && /^\d+$/.test(retryAfter)) {
            (err as unknown as { retryAfterMs: number }).retryAfterMs = Number(retryAfter) * 1000;
          }
        }

        const retriable = err instanceof BrainServerError || err instanceof BrainRateLimitError;
        if (retriable && attempt < maxRetries) {
          const delay =
            err instanceof BrainRateLimitError
              ? err.retryAfterMs
              : retryBase * Math.pow(2, attempt);
          await sleep(delay);
          attempt++;
          continue;
        }
        throw err;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  ```

  Verify: `pnpm test tests/unit/brain-client/http.test.ts`. Commit: `feat(brain-client): fetch wrapper with typed errors + retries`.

### Task 2B.6 — Outbox (test + impl)

- [ ] **Files**: `src/brain-client/outbox.ts`, `tests/unit/brain-client/outbox.test.ts`
  **Est**: 7 minutes

  **Test behaviors asserted:**
  - Two writes to the same session produce two distinct files (unique filename).
  - `drainOutbox` calls flushOne per file and deletes on success.
  - Files are kept when flushOne returns `{ ok: false }`.
  - Corrupted JSON files get moved to `.codi/brain-outbox/quarantine/`.

  **Implementation `src/brain-client/outbox.ts`:**
  ```typescript
  import fs from "node:fs/promises";
  import path from "node:path";
  import crypto from "node:crypto";

  export interface OutboxEntry {
    method: "POST" | "PUT" | "DELETE";
    path: string;
    body: unknown;
    sessionId: string;
    createdAt?: string;
  }

  export interface FlushResult {
    drained: number;
    failed: number;
    quarantined: number;
  }

  export type FlushOne = (entry: OutboxEntry) => Promise<{ ok: boolean; retryable?: boolean }>;

  function outboxDir(projectRoot: string): string {
    return path.join(projectRoot, ".codi", "brain-outbox");
  }
  function quarantineDir(projectRoot: string): string {
    return path.join(outboxDir(projectRoot), "quarantine");
  }

  export async function writeToOutbox(projectRoot: string, entry: OutboxEntry): Promise<string> {
    const dir = outboxDir(projectRoot);
    await fs.mkdir(dir, { recursive: true });
    const ts = Date.now();
    const rand = crypto.randomBytes(3).toString("hex");
    const file = path.join(dir, `${ts}_${entry.sessionId}_${rand}.json`);
    const payload = { ...entry, createdAt: new Date(ts).toISOString() };
    await fs.writeFile(file, JSON.stringify(payload), { flag: "wx" });
    return file;
  }

  export async function drainOutbox(projectRoot: string, flushOne: FlushOne): Promise<FlushResult> {
    const dir = outboxDir(projectRoot);
    let files: string[];
    try {
      files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return { drained: 0, failed: 0, quarantined: 0 };
      throw e;
    }

    let drained = 0;
    let failed = 0;
    let quarantined = 0;

    for (const f of files) {
      const full = path.join(dir, f);
      let entry: OutboxEntry;
      try {
        entry = JSON.parse(await fs.readFile(full, "utf-8")) as OutboxEntry;
      } catch {
        const qDir = quarantineDir(projectRoot);
        await fs.mkdir(qDir, { recursive: true });
        await fs.rename(full, path.join(qDir, f));
        quarantined++;
        continue;
      }

      try {
        const result = await flushOne(entry);
        if (result.ok) {
          await fs.unlink(full);
          drained++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return { drained, failed, quarantined };
  }
  ```

  Verify + commit: `feat(brain-client): outbox write/drain/quarantine`.

### Task 2B.7 — Client factory + index barrel

- [ ] **Files**: `src/brain-client/client.ts`, `src/brain-client/index.ts`, `tests/unit/brain-client/client.test.ts`
  **Est**: 8 minutes

  **Test behaviors:**
  - `createNote` POSTs to /notes with correct body.
  - Network failure → outbox write + `{id: "queued", ...}` response (when `enableOutbox`).
  - `searchNotes` forwards query params (q, kind, tag, limit).

  **Implementation `src/brain-client/client.ts`:**
  ```typescript
  import { brainFetch } from "./http.js";
  import { writeToOutbox } from "./outbox.js";
  import { BrainNetworkError, BrainServerError } from "./errors.js";
  import type {
    CreateNoteInput, NoteResponse, SearchQuery, NoteHit,
    HotResponse, ReconcileReport, HealthResponse,
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
          await writeToOutbox(opts.projectRoot, { method, path: urlPath, body, sessionId: opts.sessionId });
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
        safeWrite<HotResponse>("PUT", "/hot", { body }, () => ({ body, updated_at: null })),
      reconcile: (paths) =>
        brainFetch<ReconcileReport>(fetchOpts, "POST", "/vault/reconcile", paths ? { paths } : undefined),
      health: () => brainFetch<HealthResponse>(fetchOpts, "GET", "/healthz"),
    };
  }
  ```

  **`src/brain-client/index.ts`:**
  ```typescript
  export { createBrainClient } from "./client.js";
  export type { BrainClient, CreateBrainClientOptions } from "./client.js";
  export { resolveBrainConfig } from "./config.js";
  export type { BrainClientConfig } from "./config.js";
  export {
    BrainClientError, BrainAuthError, BrainNotFoundError,
    BrainRateLimitError, BrainServerError, BrainNetworkError,
  } from "./errors.js";
  export type {
    CreateNoteInput, NoteResponse, SearchQuery, NoteHit,
    HotResponse, ReconcileReport, HealthResponse,
  } from "./types.js";
  export { drainOutbox, writeToOutbox } from "./outbox.js";
  export type { OutboxEntry } from "./outbox.js";
  ```

  Commit: `feat(brain-client): BrainClient factory with outbox fallback`.

---

## Phase B — Redactor + Extractor + Markers (6 tasks)

### Task 2B.8 — Redactor patterns

- [ ] **Files**: `src/brain-client/redactor-patterns.ts`, `tests/unit/brain-client/redactor-patterns.test.ts`
  **Est**: 5 minutes

  **Pattern list (initial set; extensible):**
  ```typescript
  export interface RedactionPattern {
    name: string;
    regex: RegExp;
    replacement: string;
  }

  export const REDACTION_PATTERNS: RedactionPattern[] = [
    { name: "openai_key", regex: /sk-[A-Za-z0-9_-]{32,}/g, replacement: "[REDACTED:openai_key]" },
    { name: "anthropic_key", regex: /sk-ant-[A-Za-z0-9_-]{32,}/g, replacement: "[REDACTED:anthropic_key]" },
    { name: "google_key", regex: /AIza[A-Za-z0-9_-]{35}/g, replacement: "[REDACTED:google_key]" },
    { name: "github_pat", regex: /gh[opusr]_[A-Za-z0-9]{36,}/g, replacement: "[REDACTED:github_pat]" },
    { name: "slack_token", regex: /xox[abprs]-[A-Za-z0-9-]{10,}/g, replacement: "[REDACTED:slack_token]" },
    { name: "aws_access_key", regex: /\bAKIA[0-9A-Z]{16}\b/g, replacement: "[REDACTED:aws_access_key]" },
    { name: "jwt", regex: /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, replacement: "[REDACTED:jwt]" },
    { name: "ssh_private_key_header", regex: /-----BEGIN (OPENSSH|RSA|DSA|EC) PRIVATE KEY-----/g, replacement: "[REDACTED:ssh_private_key]" },
    { name: "bearer_token_header", regex: /[Aa]uthorization:\s*[Bb]earer\s+[A-Za-z0-9._-]+/g, replacement: "Authorization: Bearer [REDACTED]" },
    { name: "url_password", regex: /:\/\/[^\s:/@]+:[^@\s]+@/g, replacement: "://[REDACTED]@" },
    { name: "email", regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, replacement: "[REDACTED:email]" },
    { name: "long_hex", regex: /\b[A-Fa-f0-9]{32,}\b/g, replacement: "[REDACTED:hex]" },
  ];
  ```

  **Test asserts:** each pattern has name/regex/replacement; each pattern correctly matches one representative sample (sk-proj-..., AIza..., ghp_..., xoxb-..., AKIAIOSFODNN7EXAMPLE, https://user:pw@host, user@example.com, JWT).

  Commit: `feat(redactor): extensible pattern list`.

### Task 2B.9 — Redactor module

- [ ] **Files**: `src/brain-client/redactor.ts`, `tests/unit/brain-client/redactor.test.ts`
  **Est**: 5 minutes

  **Test `tests/unit/brain-client/redactor.test.ts` (write first):**
  ```typescript
  import { describe, it, expect } from "vitest";
  import { redactTranscript } from "#src/brain-client/redactor.js";
  import { REDACTION_PATTERNS } from "#src/brain-client/redactor-patterns.js";

  describe("redactTranscript", () => {
    it("redacts every pattern and returns hit counts", () => {
      const raw = "key sk-ant-abcdefghijklmnopqrstuvwxyz1234567890 and email user@example.com";
      const { redacted, counts } = redactTranscript(raw, REDACTION_PATTERNS, "/home/me");
      expect(redacted).not.toContain("user@example.com");
      expect(redacted).not.toContain("sk-ant-abcdefghijklmnopqrstuvwxyz1234567890");
      expect(counts.anthropic_key).toBe(1);
      expect(counts.email).toBe(1);
    });

    it("redacts HOME-relative paths", () => {
      const raw = "error in /home/me/secret/file.txt";
      const { redacted, counts } = redactTranscript(raw, REDACTION_PATTERNS, "/home/me");
      expect(redacted).not.toContain("/home/me/");
      expect(redacted).toContain("[REDACTED:home_path]");
      expect(counts.home_path).toBe(1);
    });

    it("PRIVACY: counts object never contains the matched secret content", () => {
      const secret = "sk-proj-aaaabbbbccccddddeeeeffffgggghhhh1234";
      const raw = `my key is ${secret} please redact`;
      const { counts } = redactTranscript(raw, REDACTION_PATTERNS, "/home/me");
      const serialized = JSON.stringify(counts);
      expect(serialized).not.toContain("sk-proj-");
      expect(serialized).not.toContain("aaaabbbb");
      expect(serialized).not.toContain(secret);
      expect(counts.openai_key).toBe(1);
    });
  });
  ```
  This privacy test is LOAD-BEARING per design spec §2.3 (redaction audit must not re-leak). Do not delete or weaken.

  **Implementation:**
  ```typescript
  import type { RedactionPattern } from "./redactor-patterns.js";

  export interface RedactionResult {
    redacted: string;
    counts: Record<string, number>;
  }

  export function redactTranscript(
    raw: string,
    patterns: RedactionPattern[],
    homeDir: string,
  ): RedactionResult {
    let text = raw;
    const counts: Record<string, number> = {};

    if (homeDir) {
      const escaped = homeDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const homeRegex = new RegExp(escaped + "[^\\s\"']*", "g");
      const matches = text.match(homeRegex);
      if (matches) {
        counts.home_path = matches.length;
        text = text.replace(homeRegex, "[REDACTED:home_path]");
      }
    }

    for (const p of patterns) {
      const flags = p.regex.flags.includes("g") ? p.regex.flags : p.regex.flags + "g";
      const re = new RegExp(p.regex.source, flags);
      const matches = text.match(re);
      if (matches) {
        counts[p.name] = (counts[p.name] ?? 0) + matches.length;
        text = text.replace(re, p.replacement);
      }
    }

    return { redacted: text, counts };
  }
  ```

  Commit: `feat(redactor): redactTranscript with hit counts`.

### Task 2B.10 — Markers parser

- [ ] **Files**: `src/brain-client/markers.ts`, `tests/unit/brain-client/markers.test.ts`
  **Est**: 6 minutes

  **Test asserts:** parses `<CODI-DECISION@v1>...</...>`, `<CODI-HOT@v1>...</...>`, `<CODI-NOTE@v1>...</...>`; survives JSON content with brackets / pipes / quotes; skips malformed JSON with parseErrors list.

  **Implementation:**
  ```typescript
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
    let match;
    while ((match = MARKER_REGEX.exec(transcript)) !== null) {
      const type = match[1] as MarkerType;
      const body = match[2];
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
  ```

  Commit: `feat(markers): parse CODI-* markers with JSON body`.

### Task 2B.11 — Dedup helper + ExtractionCandidate type

- [ ] **Files**: `src/brain-client/dedup.ts`, `tests/unit/brain-client/dedup.test.ts`
  **Est**: 3 minutes

  `ExtractionCandidate` lives in `types.ts` (Task 2B.2) to avoid a forward dependency on extractor.ts. Import from there:
  ```typescript
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
  ```

  Test asserts `normalizeTitle("  USE  GEMINI  ")` → `"use gemini"` and dedup drops candidates whose normalized title is in the existing set.

  Commit: `feat(dedup): title-normalized dedup helper`.

### Task 2B.12 — Gemini extractor — failing test

- [ ] **Files**: `tests/unit/brain-client/extractor.test.ts`
  **Est**: 5 minutes

  Test `tests/unit/brain-client/extractor.test.ts`:
  ```typescript
  import { describe, it, expect, vi } from "vitest";
  import { extractWithGemini, type GeminiModelLike } from "#src/brain-client/extractor.js";

  function fakeModel(rawResponse: string): GeminiModelLike {
    return {
      generateContent: vi.fn().mockResolvedValue({ response: { text: () => rawResponse } }),
    };
  }

  describe("extractWithGemini", () => {
    it("returns candidates parsed from model structured output", async () => {
      const model = fakeModel(JSON.stringify({
        candidates: [{
          title: "Use Gemini",
          body: "cheaper",
          tags: ["llm"],
          evidence_quote: "let us use Gemini",
          confidence: 0.95,
          type: "decision",
        }],
      }));
      const candidates = await extractWithGemini({
        transcript: "let us use Gemini because it is cheaper",
        model,
      });
      expect(candidates).toHaveLength(1);
      expect(candidates[0].title).toBe("Use Gemini");
      expect(candidates[0].confidence).toBe(0.95);
    });

    it("SAFETY: forces confidence=0 when evidence_quote is not a substring of transcript", async () => {
      const model = fakeModel(JSON.stringify({
        candidates: [{
          title: "Hallucinated",
          body: "",
          tags: [],
          evidence_quote: "a quote that does NOT appear anywhere in the transcript",
          confidence: 0.99,
          type: "decision",
        }],
      }));
      const candidates = await extractWithGemini({
        transcript: "completely different content here",
        model,
      });
      expect(candidates[0].confidence).toBe(0);
    });

    it("evidence verification is whitespace- and case-insensitive", async () => {
      const model = fakeModel(JSON.stringify({
        candidates: [{
          title: "t",
          body: "",
          tags: [],
          evidence_quote: "LET   us\nuse gemini",
          confidence: 0.8,
          type: "decision",
        }],
      }));
      const candidates = await extractWithGemini({
        transcript: "user: let us use Gemini now",
        model,
      });
      expect(candidates[0].confidence).toBe(0.8);
    });

    it("returns empty on malformed model response", async () => {
      const model = fakeModel("not valid json");
      const candidates = await extractWithGemini({ transcript: "x", model });
      expect(candidates).toEqual([]);
    });

    it("returns empty when candidates is not an array", async () => {
      const model = fakeModel(JSON.stringify({ candidates: "string-not-array" }));
      const candidates = await extractWithGemini({ transcript: "x", model });
      expect(candidates).toEqual([]);
    });

    it("drops candidates missing required fields", async () => {
      const model = fakeModel(JSON.stringify({
        candidates: [
          { body: "no title", tags: [], evidence_quote: "x", confidence: 0.9, type: "decision" },
          { title: "missing type", body: "", tags: [], evidence_quote: "x", confidence: 0.9 },
        ],
      }));
      const candidates = await extractWithGemini({ transcript: "x", model });
      expect(candidates).toHaveLength(0);
    });
  });
  ```
  Verify fails: `pnpm test tests/unit/brain-client/extractor.test.ts`.
  Commit: `test(extractor): require structured output + evidence verification`.

### Task 2B.13 — Gemini extractor — implementation

- [ ] **Files**: `src/brain-client/extractor.ts`
  **Est**: 6 minutes

  ```typescript
  import { GoogleGenerativeAI } from "@google/generative-ai";
  import type { ExtractionCandidate } from "./types.js";

  export type { ExtractionCandidate };

  export interface GeminiModelLike {
    generateContent(input: string): Promise<{ response: { text: () => string } }>;
  }

  export interface ExtractOptions {
    transcript: string;
    model: GeminiModelLike;
  }

  const PROMPT = `You are an assistant that extracts durable decisions from a developer's session transcript.

  A "decision" is a deliberate choice the user made that future sessions should remember:
  - technology, library, or tool choices
  - architecture or design decisions
  - root causes + fixes identified during debugging

  Exclude exploratory discussion, questions, or ideas that were rejected.

  For each decision return:
  - title: concise (<200 chars)
  - body: 1-3 sentences of context
  - tags: 1-5 lowercase tags
  - evidence_quote: EXACT substring from the transcript that justifies this
  - confidence: 0.0-1.0
  - type: "decision" | "fact" | "hot-state"

  Return STRICT JSON: {"candidates": [{"title":"...","body":"...","tags":["..."],"evidence_quote":"...","confidence":0.0,"type":"decision"}]}
  Return {"candidates": []} if none.`;

  export function createGeminiModel(apiKey: string, modelName = "gemini-2.5-flash"): GeminiModelLike {
    const ai = new GoogleGenerativeAI(apiKey);
    return ai.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
    });
  }

  export async function extractWithGemini(opts: ExtractOptions): Promise<ExtractionCandidate[]> {
    const { transcript, model } = opts;
    const full = `${PROMPT}\n\n---TRANSCRIPT---\n${transcript}\n---END TRANSCRIPT---`;

    let raw: string;
    try {
      const result = await model.generateContent(full);
      raw = result.response.text();
    } catch {
      return [];
    }

    let parsed: { candidates?: unknown };
    try {
      parsed = JSON.parse(raw) as { candidates?: unknown };
    } catch {
      return [];
    }
    if (!Array.isArray(parsed.candidates)) return [];

    const out: ExtractionCandidate[] = [];
    const transcriptNorm = transcript.toLowerCase().replace(/\s+/g, " ");
    for (const c of parsed.candidates) {
      const cand = c as Partial<ExtractionCandidate>;
      if (!cand.title || !cand.evidence_quote || cand.type === undefined) continue;
      const quoteNorm = cand.evidence_quote.toLowerCase().replace(/\s+/g, " ");
      const evidenceOk = transcriptNorm.includes(quoteNorm);
      out.push({
        title: cand.title,
        body: cand.body ?? "",
        tags: cand.tags ?? [],
        evidence_quote: cand.evidence_quote,
        confidence: evidenceOk ? Math.max(0, Math.min(1, cand.confidence ?? 0)) : 0,
        type: cand.type,
      });
    }
    return out;
  }
  ```

  Commit: `feat(extractor): Gemini extraction with evidence_quote verification`.

  **End-of-Phase-B verification**: `pnpm test tests/unit/brain-client/` — expected: all Phase A+B tests pass.

---

## Phase C — CLI `codi brain` subcommand (5 tasks)

Each handler is a pure async function returning `{success, data}`. Each subcommand in `registerBrainCommand(program)` calls the handler, logs the data, and exits.

### Task 2B.14 — CLI: brain status

- [ ] **Files**: `src/cli/brain.ts` (new), `src/cli.ts` (modified), `tests/unit/cli/brain-status.test.ts`
  **Est**: 7 minutes

  **Test asserts:**
  - Green /healthz → `success: true`, `data.status === "ok"`.
  - No `BRAIN_BEARER_TOKEN` → `success: false`, `data.token === "not-configured"`.
  - Network error → `success: false`, `data.error` contains `"network"`.

  **Implementation sketch:**
  ```typescript
  import type { Command } from "commander";
  import os from "node:os";
  import { Logger } from "../core/output/logger.js";
  import { resolveBrainConfig, createBrainClient, BrainNetworkError, BrainClientError } from "../brain-client/index.js";

  export interface BrainCommandContext { projectRoot: string; }

  export interface BrainStatusResult {
    success: boolean;
    data: {
      status: string;
      url?: string;
      token: "configured" | "not-configured";
      checks?: Record<string, string>;
      version?: string;
      error?: string;
    };
  }

  export async function brainStatusHandler(ctx: BrainCommandContext): Promise<BrainStatusResult> {
    const cfg = await resolveBrainConfig({ projectRoot: ctx.projectRoot, homeDir: os.homedir() });
    if (!cfg.token) {
      return {
        success: false,
        data: {
          status: "unconfigured",
          url: cfg.url,
          token: "not-configured",
          error: "BRAIN_BEARER_TOKEN not set; set via env or .codi/config.yaml",
        },
      };
    }
    const client = createBrainClient({ url: cfg.url, token: cfg.token, projectRoot: ctx.projectRoot, sessionId: "cli" });
    try {
      const h = await client.health();
      return {
        success: h.status === "ok",
        data: { status: h.status, url: cfg.url, token: "configured", checks: h.checks, version: h.version },
      };
    } catch (e) {
      const msg = e instanceof BrainNetworkError
        ? `network error: ${e.message}`
        : e instanceof BrainClientError
          ? `${e.code}: ${e.message}`
          : (e as Error).message;
      return {
        success: false,
        data: { status: "error", url: cfg.url, token: "configured", error: msg },
      };
    }
  }

  export function registerBrainCommand(program: Command): void {
    const brain = program.command("brain").description("Codi Brain client commands");
    brain.command("status").description("Check Brain API reachability and auth").action(async () => {
      const logger = Logger.getInstance();
      const result = await brainStatusHandler({ projectRoot: process.cwd() });
      logger.log(JSON.stringify(result.data, null, 2));
      process.exit(result.success ? 0 : 1);
    });
  }
  ```

  Also modify `src/cli.ts`: add `import { registerBrainCommand } from "./cli/brain.js";` and call `registerBrainCommand(program);` in the register block.

  Commit: `feat(cli): codi brain status`.

### Task 2B.15 — CLI: brain search

- [ ] **Files**: `src/cli/brain.ts` (extend), `tests/unit/cli/brain-search.test.ts`
  **Est**: 4 minutes

  Handler `brainSearchHandler(ctx & {q, kind?, tag?, limit?})`: resolve config, call `client.searchNotes(...)`, return hits. Register:
  ```typescript
  brain
    .command("search <query>")
    .description("Search Brain notes")
    .option("-k, --kind <kind>", "filter by kind (decision|hot)")
    .option("-t, --tag <tag...>", "filter by tag (repeatable)")
    .option("-l, --limit <n>", "max results", "10")
    .action(async (query: string, opts: { kind?: "decision" | "hot"; tag?: string[]; limit: string }) => {
      const logger = Logger.getInstance();
      const result = await brainSearchHandler({
        projectRoot: process.cwd(),
        q: query,
        kind: opts.kind,
        tag: opts.tag,
        limit: Number(opts.limit),
      });
      logger.log(JSON.stringify(result.data, null, 2));
      process.exit(result.success ? 0 : 1);
    });
  ```

  Commit: `feat(cli): codi brain search`.

### Task 2B.16 — CLI: brain decide

- [ ] **Files**: `src/cli/brain.ts` (extend), `tests/unit/cli/brain-decide.test.ts`
  **Est**: 4 minutes

  Handler `brainDecideHandler(ctx & {title, body, tags})` calls `client.createNote({kind: "decision", title, body, tags, links: [], session_id: null})` and returns `{success, data: {id}}`.

  Test asserts the POST body has the right shape; stub brain server via msw.

  Register `brain.command("decide <title>").option("-b, --body", ...).option("-t, --tags", ...)` as in Phase A's status pattern.

  Commit: `feat(cli): codi brain decide`.

### Task 2B.16a — CLI: brain hot

- [ ] **Files**: `src/cli/brain.ts` (extend), `tests/unit/cli/brain-hot.test.ts`
  **Est**: 4 minutes

  Handler `brainHotHandler(ctx & {set?: string})`: `client.getHot()` when `set` absent, else `client.putHot(set)`.

  Test asserts two cases: GET when no --set, PUT with body when --set.

  Commit: `feat(cli): codi brain hot`.

### Task 2B.16b — CLI: brain outbox

- [ ] **Files**: `src/cli/brain.ts` (extend), `tests/unit/cli/brain-outbox.test.ts`
  **Est**: 4 minutes

  Handler `brainOutboxHandler(ctx & {flush?: boolean})`:
  - Without `--flush`: lists `.codi/brain-outbox/*.json` count.
  - With `--flush`: `drainOutbox(projectRoot, flushOne)` where flushOne routes `POST /notes` and `PUT /hot` via the client. Returns `{drained, failed, quarantined}`.

  Test asserts drain path deletes files on 2xx and keeps them on 5xx.

  Commit: `feat(cli): codi brain outbox`.

### Task 2B.17 — CLI: brain undo-session

- [ ] **Files**: `src/cli/brain.ts` (extend), `tests/unit/cli/brain-undo.test.ts`
  **Est**: 4 minutes

  `brainUndoSessionHandler(ctx & {sessionId})`:
  1. Search notes by `tag=["auto-extract-<sessionId>"]`.
  2. Call `client.reconcile(hits.map(h => h.vault_path))`.
  3. Report tombstoned count.

  Register:
  ```typescript
  brain
    .command("undo-session <id>")
    .description("Soft-delete all notes tagged auto-extract-<id>")
    .action(async (id: string) => {
      const logger = Logger.getInstance();
      const r = await brainUndoSessionHandler({ projectRoot: process.cwd(), sessionId: id });
      logger.log(JSON.stringify(r.data, null, 2));
      process.exit(r.success ? 0 : 1);
    });
  ```

  Commit: `feat(cli): codi brain undo-session`.

### Task 2B.18 — End-of-Phase-C verification

- [ ] **Files**: none
  **Est**: 2 minutes

  1. `pnpm test tests/unit/brain-client/ tests/unit/cli/brain-*.test.ts` — expected: all green.
  2. `pnpm build && node dist/cli.js brain --help` — prints all 6 subcommands.
  3. `pnpm test` full suite green. No commit.

---

## Phase D — Skill templates + capture rule (7 tasks)

Each skill follows the pattern in `src/templates/skills/commit/`. Frontmatter required: `name: {{name}}`, `description`, `category`, `compatibility: ${SUPPORTED_PLATFORMS_YAML}`, `managed_by: ${PROJECT_NAME}`, `user-invocable: true`, `disable-model-invocation: false`, `version: 1`.

### Task 2B.19 — Skill: codi-brain-decide

- [ ] **Files**: `src/templates/skills/codi-brain-decide/{template.ts, index.ts}`, `tests/unit/templates/codi-brain-decide.test.ts`
  **Est**: 5 minutes

  **Test asserts:** template is a string starting with `---\n`, contains `name: {{name}}`, contains `<CODI-DECISION@v1>`, mentions `codi brain decide`.

  **Template content (body of `template.ts`):**
  ```typescript
  import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

  export const template = `---
  name: {{name}}
  description: |
    Record a durable decision into the Codi Brain. Use when the user makes a
    technology choice, architecture decision, or root-cause conclusion worth
    remembering across sessions. Activates on /codi-brain-decide and phrases
    "remember this", "save this decision", "record this choice".
  category: ${SKILL_CATEGORY.DEVELOPER_TOOLS}
  compatibility: ${SUPPORTED_PLATFORMS_YAML}
  managed_by: ${PROJECT_NAME}
  user-invocable: true
  disable-model-invocation: false
  version: 1
  ---

  # {{name}} — Record Brain Decision

  ## When to Activate
  - User invokes \`/codi-brain-decide "<text>"\`
  - User says "remember this" / "save this decision" / "log this choice"
  - After codi-brainstorming approves a design — emit one decision per major choice

  ## Workflow
  1. Confirm the decision text with the user if not explicit.
  2. Emit an inline marker (this is what the Stop hook captures):
     \`\`\`
     <CODI-DECISION@v1>
     {"title": "<concise, <200 chars>", "reason": "<1 sentence>", "tags": ["<tag1>", "<tag2>"]}
     </CODI-DECISION@v1>
     \`\`\`
  3. Also invoke the CLI (brain dedups — duplicate is safe):
     \`\`\`bash
     codi brain decide "<title>" --body "<reason>" --tags <comma-separated>
     \`\`\`
  4. Confirm: "Recorded. Brain ID: <n-xxxx>". If CLI returns \`"id": "queued"\`, tell the user it's in the outbox and will sync next SessionStart.

  ## Rules
  - Title <200 chars.
  - Tags: 1-5 lowercase kebab-case.
  - Only durable decisions — not exploratory ideas or rejected options.
  `;
  ```

  **`index.ts`:** `export { template } from "./template.js"; export const staticDir = resolveStaticDir("codi-brain-decide", import.meta.url);`

  Commit: `feat(skill): codi-brain-decide`.

### Task 2B.20 — Skill: codi-brain-recall

- [ ] **Files**: skill dir + test
  **Est**: 4 minutes

  Same pattern. Workflow: `codi brain search "<query>" --limit 5`; format each hit as `- [<date>] <title> — <body excerpt>`; say "no prior decisions" if empty. Triggers: `/codi-brain-recall`, "what did we decide about", "did we already choose", "have we discussed X before".

  Commit: `feat(skill): codi-brain-recall`.

### Task 2B.21 — Skill: codi-brain-hot-set

- [ ] **Files**: skill dir + test
  **Est**: 3 minutes

  Workflow: `codi brain hot --set "<text>"`. Triggers: `/codi-brain-hot-set`, "update hot state", "set focus to", "switch context to".

  Commit: `feat(skill): codi-brain-hot-set`.

### Task 2B.22 — Skill: codi-brain-hot-get

- [ ] **Files**: skill dir + test
  **Est**: 3 minutes

  Workflow: `codi brain hot`. Triggers: `/codi-brain-hot-get`, "current focus?", "what were we working on?".

  Commit: `feat(skill): codi-brain-hot-get`.

### Task 2B.23 — Skill: codi-brain-review

- [ ] **Files**: skill dir + test
  **Est**: 5 minutes

  Workflow:
  1. List `.codi/pending-notes/*.jsonl` entries with their confidence + evidence_quote.
  2. For each: ask user approve / edit / discard.
  3. Approved → `codi brain decide "<title>" --body "<body>" --tags <tags>`; remove from file.
  4. Discarded → move to `.codi/rejected-notes/`.

  Triggers: `/codi-brain-review`, "review pending notes", "what did the brain auto-capture?"

  Commit: `feat(skill): codi-brain-review`.

### Task 2B.24 — Skill: codi-brain-undo-session

- [ ] **Files**: skill dir + test
  **Est**: 3 minutes

  Workflow: ask user for session-id, then `codi brain undo-session <id>`. Triggers: `/codi-brain-undo-session`, "undo last session's auto-captures", "that extraction run was noisy".

  Commit: `feat(skill): codi-brain-undo-session`.

### Task 2B.24a — Layer 6: Skill-completion trigger markers

- [ ] **Files**: `src/templates/skills/brainstorming/template.ts`, `src/templates/skills/branch-finish/template.ts`, `src/templates/skills/debugging/template.ts`, `tests/unit/templates/layer6-markers.test.ts`
  **Est**: 6 minutes

  **Test asserts:** each of the three existing skill templates' final step includes guidance to emit a `<CODI-DECISION@v1>` marker. Verify by importing each template and asserting the string contains both `<CODI-DECISION@v1>` and `</CODI-DECISION@v1>`.
  ```typescript
  import { describe, it, expect } from "vitest";
  import { template as brainstorm } from "#src/templates/skills/brainstorming/index.js";
  import { template as branchFinish } from "#src/templates/skills/branch-finish/index.js";
  import { template as debugging } from "#src/templates/skills/debugging/index.js";

  describe("Layer 6 skill-completion markers", () => {
    it.each([
      ["brainstorming", brainstorm],
      ["branch-finish", branchFinish],
      ["debugging", debugging],
    ])("%s template instructs agent to emit CODI-DECISION on completion", (_name, tpl) => {
      expect(tpl).toContain("<CODI-DECISION@v1>");
      expect(tpl).toContain("</CODI-DECISION@v1>");
    });
  });
  ```

  **Implementation:** append a "Layer 6 — Codi Brain capture" section to each of the three skill templates. Example insertion for `brainstorming/template.ts` (add near the end of the workflow section):
  ```markdown
  ## Codi Brain capture (Layer 6)

  After the spec is approved by the user, emit one \`<CODI-DECISION@v1>...\` marker for each major decision in the spec. The codi-brain Stop hook will capture these automatically.

  Example:
  \`\`\`
  <CODI-DECISION@v1>
  {"title": "<decision title from spec>", "reason": "<one-sentence rationale>", "tags": ["brainstorm", "<feature-name>"]}
  </CODI-DECISION@v1>
  \`\`\`
  ```

  For `branch-finish/template.ts`, emit after a successful merge:
  ```markdown
  ## Codi Brain capture (Layer 6)

  After merging, emit:
  \`\`\`
  <CODI-DECISION@v1>
  {"title": "merged PR #<num> — <one-line>", "reason": "<what this shipped>", "tags": ["merge", "<area>"]}
  </CODI-DECISION@v1>
  \`\`\`
  ```

  For `debugging/template.ts`, emit when a root cause is confirmed:
  ```markdown
  ## Codi Brain capture (Layer 6)

  Once the root cause is confirmed + fix applied, emit:
  \`\`\`
  <CODI-DECISION@v1>
  {"title": "root cause: <cause>", "reason": "fix: <fix>", "tags": ["debugging", "<area>"]}
  </CODI-DECISION@v1>
  \`\`\`
  ```

  Bump `version:` in each modified skill's frontmatter by +1 (required by the integrity check).

  Commit: `feat(layer6): skill-completion markers in brainstorming + branch-finish + debugging`.

### Task 2B.25 — Rule: codi-brain-capture

- [ ] **Files**: `src/templates/rules/codi-brain-capture.md`, `tests/unit/templates/codi-brain-capture.test.ts`
  **Est**: 5 minutes

  **Test asserts:** file exists, has required frontmatter (`name`, `priority: medium`, `alwaysApply: true`, `managed_by: codi`), contains `<CODI-DECISION@v1>`, contains `<CODI-HOT@v1>`, contains `<CODI-NOTE@v1>`, has a "When to emit" section, has a "When NOT to emit" section.

  **Content (see design spec §3.4 for semantics):**
  ```markdown
  ---
  name: codi-brain-capture
  description: Tells the agent to emit structured CODI-* markers during the session so the Stop hook can capture decisions.
  priority: medium
  alwaysApply: true
  managed_by: codi
  version: 1
  ---

  # Codi Brain Capture

  ## Marker schema (emit inline during the session)

  \`\`\`
  <CODI-DECISION@v1>
  {"title": "<concise, <200 chars>", "reason": "<1 sentence>", "tags": ["<tag1>", "<tag2>"]}
  </CODI-DECISION@v1>
  \`\`\`

  \`\`\`
  <CODI-HOT@v1>
  {"body": "<current session focus>"}
  </CODI-HOT@v1>
  \`\`\`

  \`\`\`
  <CODI-NOTE@v1>
  {"title": "...", "body": "multiline ok", "tags": ["..."]}
  </CODI-NOTE@v1>
  \`\`\`

  Body is JSON — any content (brackets, pipes, quotes) is safe inside JSON strings.

  ## When to emit
  - Concrete technology/library/tool choice
  - Architecture or design decision
  - Root cause + fix during debugging
  - User says "remember this" / "save this" / "let's go with X"
  - Start of a focused work session → emit a CODI-HOT marker

  ## When NOT to emit
  - Exploratory back-and-forth
  - Questions or information requests
  - Ideas considered and rejected
  - User says "don't save this" / "this is private"
  - Content with secrets, credentials, or PII

  ## Rules
  - One decision per marker
  - Title concise (<200 chars)
  - Tags: 1-5 lowercase kebab-case
  - Separate multiple markers with a blank line
  - Stop hook captures automatically; you do not need to call any tool
  ```

  Commit: `feat(rule): codi-brain-capture`.

  **End-of-Phase-D verification**: `pnpm test && pnpm build` green.

---

## Phase E — Claude Code hook builders (5 tasks)

### Task 2B.26 — Brain hook builders — failing test

- [ ] **Files**: `tests/unit/core/hooks/brain-hooks.test.ts`
  **Est**: 4 minutes

  Test asserts:
  - Filenames follow `codi-brain-<role>.cjs` convention.
  - SessionStart script starts with `#!/usr/bin/env node`, contains `/hot`, `brain-outbox`, `additionalContext`.
  - Stop script contains `CODI-DECISION`, `auto_extract`, `evidence_quote`.
  - PostCommit script contains `/vault/reconcile`.
  - All three scripts pass `new vm.Script(...)` (Node syntax valid).

  Commit: `test(hooks): require brain hook builders`.

### Task 2B.27 — SessionStart hook builder

- [ ] **Files**: `src/core/hooks/brain-hooks.ts`
  **Est**: 7 minutes

  Export `BRAIN_SESSION_START_FILENAME`, `BRAIN_STOP_FILENAME`, `BRAIN_POST_COMMIT_FILENAME` constants computed from `PROJECT_NAME`. Implement `buildBrainSessionStartScript()` returning a `.cjs` source string that:

  1. Reads `.codi/config.yaml` via `require('node_modules/yaml')` (hook runs standalone, no TS imports).
  2. Env overrides yaml.
  3. Flushes `.codi/brain-outbox/*.json` (POST each, delete on 2xx).
  4. GETs `/hot` and `/notes/search?kind=decision&recent_days=7&limit=10`.
  5. Emits `{"additionalContext": "<codi-brain-context>\n...\n</codi-brain-context>"}` to stdout.
  6. All network failures log to stderr and emit `{"additionalContext": ""}` — never throws.

  (See design spec §4.1 + §4.4b for precedence rules.)

  Commit: `feat(hooks): SessionStart hook builder`.

### Task 2B.28 — Stop hook builder (L1 + L3)

- [ ] **Files**: `src/core/hooks/brain-hooks.ts`
  **Est**: 10 minutes

  Implement `buildBrainStopScript()` returning a `.cjs` source string that:

  1. Reads stdin JSON (Claude Code Stop hook payload: `{session_id, transcript, messages}`).
  2. Reads `.codi/config.yaml` + env (same precedence as SessionStart).
  3. **L1 pass (always):** regex-parses `<CODI-(DECISION|HOT|NOTE)@v1>...</...>` markers, POSTs each to /notes (or PUT /hot for HOT markers). On failure → outbox.
  4. **L3 pass (opt-in, `auto_extract=true` + `GEMINI_API_KEY` set):**
     a. **IMPORTANT: require('@google/generative-ai') MUST be inside the L3 branch**, not at top of file. A user without the package installed still runs L1 successfully. The hook crashing on a top-level require would break marker capture. Verify with a test that L1 still works when the Gemini package is absent (mock via deleting `require.cache` entry before invoking).
     b. Redact via the inlined REDACTION_PATTERNS array (copy of `redactor-patterns.ts`).
     c. Log pattern hit counts to `.codi/brain-logs/redaction-<session-id>.jsonl`.
     d. Call Gemini via the now-required package.
     e. Parse response, verify each candidate's `evidence_quote` is a substring of the redacted transcript — force `confidence=0` otherwise.
     f. Dedup against L1 marker titles (normalized) from this same session.
     g. `confidence >= threshold` → POST /notes tagged `auto-extracted` + `auto-extract-<sid>`. `0.5 <= c < threshold` → append to `.codi/pending-notes/<sid>.jsonl`. `c < 0.5` → log to `low-confidence-<sid>.jsonl`.
  5. Config parse error → fail closed: L3 disabled for this run. L1 still runs.

  **Registration-side timeout:** the settings.json Stop entry must set `timeout: 30` (seconds). Design spec §3.3 says "timeout: 10 (typical) + Stop hook is synchronous" — the 10s figure is the *typical* budget; L3 Gemini extraction can exceed it. The registration timeout in Task 2B.32 is 30s to accommodate L3. Update design spec §3.3 accordingly during Phase H docs pass, or add a footnote.

  The REDACTION_PATTERNS inlined in the hook must mirror `src/brain-client/redactor-patterns.ts`. Add a comment in `brain-hooks.ts` reminding the maintainer to update both together. A simple test pins the mirror: include both lists and assert lengths + names match.

  Commit: `feat(hooks): Stop hook builder (L1 markers + opt-in L3 extraction)`.

### Task 2B.29 — PostToolUse hook builder

- [ ] **Files**: `src/core/hooks/brain-hooks.ts`
  **Est**: 4 minutes

  Implement `buildBrainPostCommitScript()` returning a `.cjs` source string that:

  1. Reads stdin JSON (`{tool_name, tool_input: {command}, session_id}`).
  2. If `tool_name !== "Bash"` OR command doesn't match `^\s*git\s+commit`, exit.
  3. Load config (URL + token).
  4. POST /vault/reconcile with empty body.
  5. All failures → stderr log, exit 0.

  Commit: `feat(hooks): PostToolUse hook builder (reconcile on git commit)`.

### Task 2B.30 — Export brain hooks + end-of-Phase-E verification

- [ ] **Files**: `src/core/hooks/index.ts` (modify)
  **Est**: 2 minutes

  Re-export from `./brain-hooks.js`: the 3 build* functions + 3 filename constants.

  Verify: `pnpm test tests/unit/core/hooks/brain-hooks.test.ts` green. `pnpm build` compiles clean.

  Commit: `feat(hooks): export brain hook builders`.

---

## Phase F — Generator wiring (3 tasks)

### Task 2B.31 — Generator wiring — failing test

- [ ] **Files**: `tests/unit/adapters/claude-code-brain-hooks.test.ts`
  **Est**: 5 minutes

  **Generator entrypoint for claude-code is `src/adapters/claude-code.ts`.** Relevant insertion sites:
  - Line 251 (current): writes `SKILL_TRACKER_FILENAME` to `${PROJECT_DIR}/${HOOKS_SUBDIR}/`. Add a parallel block for the three brain hooks.
  - Line 330: constructs `settings.hooks` object (`InstructionsLoaded`, etc.). Extend with `SessionStart`, `Stop`, `PostToolUse` entries for brain.

  Test asserts, given a minimal fixture where any `codi-brain-*` skill is installed in `.codi/`:
  - `codi generate` (or the generator's direct entrypoint) writes `.codi/hooks/codi-brain-session-start.cjs`, `...-stop.cjs`, `...-post-commit.cjs` when claude-code is active.
  - `.claude/settings.json` contains entries under `hooks.SessionStart`, `hooks.Stop`, `hooks.PostToolUse` referencing those filenames.
  - If no `codi-brain-*` skill is installed (not even the rule), no brain hooks are emitted.

  Commit: `test(generate): require brain hooks wired for claude-code`.

### Task 2B.32 — Generator wiring — implementation

- [ ] **Files**: `src/adapters/claude-code.ts`
  **Est**: 7 minutes

  1. Add a feature-check: `shouldWireBrainHooks(stateOrDir) = any installed skill name starts with "codi-brain-"`.
  2. When true + agent is `claude-code`: call `buildBrainSessionStartScript()` / `buildBrainStopScript()` / `buildBrainPostCommitScript()` and write each to `.codi/hooks/<filename>` with mode `0755`.
  3. Add three entries to `.claude/settings.json.hooks`:
     ```typescript
     settings.hooks.SessionStart ??= [];
     settings.hooks.SessionStart.push({
       matcher: "",
       hooks: [{
         type: "command",
         command: `node "\${CLAUDE_PROJECT_DIR:-.}"/.codi/hooks/${BRAIN_SESSION_START_FILENAME}`,
         timeout: 10,
         async: true,
       }],
     });
     settings.hooks.Stop ??= [];
     settings.hooks.Stop.push({
       matcher: "",
       hooks: [{
         type: "command",
         command: `node "\${CLAUDE_PROJECT_DIR:-.}"/.codi/hooks/${BRAIN_STOP_FILENAME}`,
         timeout: 30,
       }],
     });
     settings.hooks.PostToolUse ??= [];
     settings.hooks.PostToolUse.push({
       matcher: "Bash",
       hooks: [{
         type: "command",
         command: `node "\${CLAUDE_PROJECT_DIR:-.}"/.codi/hooks/${BRAIN_POST_COMMIT_FILENAME}`,
         timeout: 10,
         async: true,
       }],
     });
     ```
  4. Ensure **idempotency** — re-running `codi generate` must not duplicate entries. Check `settings.hooks.<event>` for an existing entry whose command contains the brain-hook filename; skip if already present.

  Commit: `feat(generate): wire brain hooks into claude-code settings.json (idempotent)`.

### Task 2B.33 — Generator: Codex/Cursor skip with pointer to Week 2C

- [ ] **Files**: (same generator file)
  **Est**: 3 minutes

  Add branch: when agent is `codex` or `cursor`, skip brain-hook writing and log `info: codi-brain hooks for <agent> pending Week 2C — see docs/<cross-agent-contract>.md`. Add test asserting no brain hook files written for codex/cursor.

  Commit: `feat(generate): skip brain hooks for non-claude-code agents (Week 2C-gated)`.

  **End-of-Phase-F verification**: `pnpm test` green. Manual: run `codi generate --force` in a scratch project with any codi-brain-* skill installed, confirm `.codi/hooks/codi-brain-*.cjs` exist + `.claude/settings.json` has three new entries.

---

## Phase G — E2E ship tests (3 tasks)

Phase G tests require the Week 2A brain running at `http://127.0.0.1:8000`. Skip with `VITEST_SKIP_E2E=1` in CI if brain not available.

### Task 2B.34 — E2E: full-loop ship scenario

- [ ] **Files**: `tests/e2e/brain-week2b-scenario.test.ts`
  **Est**: 10 minutes

  Shape:
  ```typescript
  import { describe, it, expect, beforeAll, afterAll } from "vitest";
  import { spawnSync } from "node:child_process";
  import fs from "node:fs/promises";
  import path from "node:path";
  import os from "node:os";

  const SKIP = process.env.VITEST_SKIP_E2E === "1";
  const runSuite = SKIP ? describe.skip : describe;

  runSuite("Week 2B E2E scenario", () => {
    let tmp: string;
    let token: string;

    beforeAll(async () => {
      tmp = await fs.mkdtemp(path.join(os.tmpdir(), "brain-2b-e2e-"));
      const probe = await fetch("http://127.0.0.1:8000/healthz").catch(() => null);
      if (!probe || !probe.ok) throw new Error("Brain not running. Start via scripts/week2a_smoke.sh in codi-brain.");
      const brainEnv = await fs.readFile(path.join(os.homedir(), "projects/codi-brain/.env"), "utf-8");
      const match = brainEnv.match(/^BRAIN_BEARER_TOKEN=(.+)$/m);
      if (!match) throw new Error("BRAIN_BEARER_TOKEN not found in codi-brain/.env");
      token = match[1].trim();
    });

    afterAll(async () => {
      await fs.rm(tmp, { recursive: true, force: true });
    });

    it("captures a CODI-DECISION marker end-to-end via the Stop hook", async () => {
      const { buildBrainStopScript } = await import("#src/core/hooks/brain-hooks.js");

      // Set up a fake project layout so __dirname inside the hook resolves correctly.
      const hooksDir = path.join(tmp, ".codi", "hooks");
      await fs.mkdir(hooksDir, { recursive: true });
      const hookPath = path.join(hooksDir, "stop.cjs");
      await fs.writeFile(hookPath, buildBrainStopScript());
      await fs.symlink(path.resolve("node_modules"), path.join(tmp, "node_modules"));

      const sessionId = `e2e-${Date.now()}`;
      const marker = `<CODI-DECISION@v1>${JSON.stringify({
        title: `Use Gemini for E2E ${sessionId}`,
        reason: "cheapest",
        tags: ["e2e", "llm"],
      })}</CODI-DECISION@v1>`;
      const payload = JSON.stringify({
        session_id: sessionId,
        transcript: `user: let us use gemini\nagent: agreed ${marker}`,
      });

      // Use spawnSync with stdin piping — no shell interpolation.
      const result = spawnSync(process.execPath, [hookPath], {
        input: payload,
        env: { ...process.env, BRAIN_URL: "http://127.0.0.1:8000", BRAIN_BEARER_TOKEN: token },
        encoding: "utf-8",
      });
      expect(result.status).toBe(0);

      // Verify via brain search
      const res = await fetch(`http://127.0.0.1:8000/notes/search?q=${encodeURIComponent(sessionId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as { results: Array<{ title: string }> };
      expect(body.results.some((h) => h.title.includes(sessionId))).toBe(true);
    });

    it("SessionStart hook injects /hot + recent decisions into additionalContext", async () => {
      const { buildBrainSessionStartScript } = await import("#src/core/hooks/brain-hooks.js");
      const hookPath = path.join(tmp, ".codi", "hooks", "session-start.cjs");
      await fs.writeFile(hookPath, buildBrainSessionStartScript());

      const result = spawnSync(process.execPath, [hookPath], {
        input: JSON.stringify({}),
        env: { ...process.env, BRAIN_URL: "http://127.0.0.1:8000", BRAIN_BEARER_TOKEN: token },
        encoding: "utf-8",
      });
      expect(result.status).toBe(0);
      const out = JSON.parse(result.stdout) as { additionalContext: string };
      expect(typeof out.additionalContext).toBe("string");
    });
  });
  ```

  Commit: `test(e2e): Week 2B full-loop ship scenario`.

### Task 2B.35 — E2E: concurrent sessions

- [ ] **Files**: `tests/e2e/brain-week2b-concurrent.test.ts`
  **Est**: 6 minutes

  Uses `Promise.all` to run two Stop-hook invocations with distinct session IDs simultaneously. Asserts:
  - Both sessions' notes land in the brain (two searches, both return hits).
  - `.codi/brain-outbox/` files from any failed writes use distinct filenames (sessionId+timestamp+random suffix keeps them unique even at millisecond resolution).
  - `/hot` updates from two sessions either both succeed (brain serializes via VaultLock) or one wins cleanly (last-write-wins).

  Commit: `test(e2e): concurrent-session safety`.

### Task 2B.36 — Full-suite + lint + pre-push baseline

- [ ] **Files**: (fix any failures encountered)
  **Est**: 5 minutes

  1. `pnpm test` — all green.
  2. `pnpm lint` — no errors.
  3. `pnpm test:pre-push` (baseline regeneration if necessary via `pnpm baseline:update`).
  4. Any fixes → commit `chore: fix lint + baseline after Week 2B`.

---

## Phase H — Docs + ship (3 tasks)

### Task 2B.37 — Handoff report

- [ ] **Files**: `docs/YYYYMMDD_HHMMSS_[REPORT]_codi-brain-phase-1-week-2b-progress.md`
  **Est**: 10 minutes

  Use timestamp from `date +"%Y%m%d_%H%M%S"`. Mirror the shape of `docs/20260423_164719_[REPORT]_codi-brain-phase-1-week-2a-progress.md`:
  - Summary (one paragraph)
  - Phase-by-phase commit map
  - Test count delta
  - Deviations encountered during execution
  - Architecture snapshot (refer to design spec §2 for canonical)
  - Next steps (Week 2C queued, Week 3 for deployment)

  Commit: `docs(brain): Week 2B handoff report`.

### Task 2B.38 — Cross-agent contract doc (Week 2C prep)

- [ ] **Files**: `docs/YYYYMMDD_HHMMSS_[ARCHITECTURE]_codi-brain-agent-integration-contract.md`
  **Est**: 8 minutes

  Document:
  - Hook event mapping: Claude Code `SessionStart` ↔ Cursor `rules-on-load` + MCP context request ↔ Codex `preSession`. Note: Cursor does not have a direct SessionStart hook; the closest is an MCP server or a rule that the agent loads; document the workaround.
  - Marker format is portable (plain text in any transcript).
  - HTTP API is portable (client library is agent-agnostic).
  - Settings file locations: `.claude/settings.json` vs `.codex/hooks.json` vs Cursor's `.cursor/rules/*.md` (rules-only; hooks via MCP).
  - Redaction + evidence-verification are host-side and portable.
  - Cursor-specific: propose an MCP server `codi-brain-mcp` that exposes `/hot`, `/notes/search`, `/notes` as MCP tools — skill-triggered tool calls replace the hook pattern.
  - Codex-specific: map to `.codex/hooks.json` shape (same concepts as Claude Code, different JSON schema).

  Commit: `docs(brain): cross-agent integration contract (Week 2C prep)`.

### Task 2B.39 — Roadmap update + push

- [ ] **Files**: `docs/20260423_170000_[ROADMAP]_codi-brain-phase-1-next-phases.md`
  **Est**: 3 minutes

  Update:
  - Week 2B row: status `✅ shipped` + ship commit SHA.
  - Week 2C row: status `🔜 next` + reference the contract doc.
  - Week 3 row: status `pending`.

  Then:
  ```bash
  cd ~/projects/codi && git push origin feature/codex-stdio-hardening
  ```

  Commit (single, rollup): `docs(roadmap): Week 2B shipped; Week 2C queued`.

---

## Ship criterion

All must hold:

- E2E full-loop test (Task 2B.34) passes against a live Week 2A brain.
- `pnpm test` (full suite) green: baseline + ~80-100 new tests added by Week 2B (matches Week 2A delta; design spec §9).
- `pnpm lint` green.
- `pnpm build` clean.
- `codi brain status` returns green in a fresh project with `codi generate` output applied and the brain reachable.
- `codi generate --force` in a scratch project emits all three brain hooks into `.codi/hooks/` and adds three entries to `.claude/settings.json` (idempotent — running twice produces one entry each).
- Handoff report + cross-agent contract docs committed.
- Branch pushed.

---

## References

- Design spec: `docs/20260423_192802_[PLAN]_codi-brain-phase-1-week-2b-design.md`
- Week 2A impl plan (reference for phase structure): `docs/20260423_120127_[PLAN]_codi-brain-phase-1-week-2a-impl.md`
- Week 2A handoff: `docs/20260423_164719_[REPORT]_codi-brain-phase-1-week-2a-progress.md`
- Phase 1 parent plan: `docs/20260422_230000_[PLAN]_codi-brain-phase-1.md`
- Roadmap: `docs/20260423_170000_[ROADMAP]_codi-brain-phase-1-next-phases.md`
- Existing skill pattern: `src/templates/skills/commit/`
- Existing hook pattern: `src/core/hooks/heartbeat-hooks.ts`
- Existing CLI pattern: `src/cli/status.ts`

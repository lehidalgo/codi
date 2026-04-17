# Server API reference

Content Factory runs a Node.js HTTP + WebSocket server on one port. Every
endpoint below is served from that port. Routes are grouped by concern so
agents can find what they need without reading the whole table.

## Conventions

- All paths are relative to the server root (e.g. `<url>/api/state`).
- JSON is the default content type for request bodies and responses.
- The `mode` field on `/api/state` is the authoritative indicator for what
  the user is looking at: `template`, `mywork`, or `null`.
- Field names use camelCase throughout (`derivedFromRevision`,
  `activeFilePath`, `activeSessionDir`). Older references may show
  snake_case — camelCase is authoritative.
- Never reconstruct paths from name fragments. Always use
  `activeFilePath` verbatim.

## App assets

| Route | Method | Purpose |
|-------|--------|---------|
| `/` | GET | Serve the content factory web app |
| `/static/*` | GET | Serve app assets (`app.css`, `app.js`) |
| `/vendor/*` | GET | Serve vendor scripts (`html2canvas`, `jszip`) |

## Projects and sessions

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/create-project` | POST | Create and activate a new project — body `{name, type}`. `type` is **required** and must be one of `social`, `slides`, `document`. Returns `{projectDir, contentDir, stateDir, exportsDir}` |
| `/api/open-project` | POST | Activate an existing project — body `{projectDir}` |
| `/api/sessions` | GET | List all projects in the workspace |
| `/api/session-status` | POST | Persist project status — body `{sessionDir, status}`. Status values: `draft`, `in-progress`, `review`, `done` |

## Files and content

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/files` | GET | List HTML files in the active project's `content/` |
| `/api/content?file=X` | GET | Return raw HTML for a content file in the active project |
| `/api/session-content?session=&file=` | GET | Serve an HTML file from a specific project |
| `/api/content-metadata?kind=&id=` | GET | Unified descriptor for templates and sessions: `{kind, id, name, type, format, cardCount, status, createdAt, modifiedAt, readOnly, source}`. `kind` is `template` or `session`. `readOnly=true` for templates |
| `/api/content-list` | GET | Every content descriptor the server knows about, templates and sessions merged into one list |
| `/api/clone-template-to-session` | POST | Copy a built-in template into a new editable session — body `{templateId, name?}`. The server writes a manifest with `preset` pointing at the origin template and returns `{ok, session, sessionDir, file}`. Call this before applying `persist-style` edits when the content is a read-only template |

## State and selection

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/state` | GET | Aggregate state: `{mode, contentId, activeFile, activeFilePath, activePreset, activeSessionDir, status, preset, activeCard, brief, activeBrand}`. Use `contentId` and `activeFilePath` as the authoritative identifiers |
| `/api/active-file` | GET | Which file is currently loaded |
| `/api/active-file` | POST | Record which file/preset the user just loaded — `{file, preset, sessionDir}` |
| `/api/active-card` | GET | The card currently highlighted in Preview — `{index, total, dataType, dataIdx, file, timestamp}` |
| `/api/active-card` | POST | App-only — the browser posts this automatically when the user clicks a card, navigates with arrows, or loads a new file |
| `/api/preset` | GET | Currently selected gallery preset |
| `/api/preset` | POST | Write preset selection — `{id, name, type, timestamp}` |

## Live inspection

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/active-element` | GET | The DOM element the user most recently clicked in the preview — full context (selector, tag, id, classes, attributes, text, outerHTML snippet, bounding rect, curated computed styles, parent chain, and `context: {kind, id, name, file, cardIndex, readOnly}`). `null` if no click yet |
| `/api/active-elements` | GET | Multi-select set of Cmd/Ctrl-clicked elements — `{count, selections:[...]}` |
| `/api/active-elements` | DELETE | Clear the multi-select set |
| `/api/inspect-events?since=<seq>` | GET | Ring buffer of preview interactions (clicks, inputs, submits, scrolls). Poll with `?since=<lastSeq>` for incremental updates |
| `/api/eval` | POST | Run JavaScript inside the currently-previewed HTML page — body `{js, timeoutMs?}`. Returns `{ok, result, error}`. **Ephemeral** — changes revert on reload. Disable with env `CONTENT_FACTORY_ALLOW_EVAL=0` |

## Style persistence

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/persist-style` | POST | Persist a style edit to the card source file — body `{targetSelector, patches, snapshot?}`. Server assigns a stable `data-cf-id` on first use and upserts a CSS rule inside a `/* === cf:user-edits === */` region. **Idempotent**: re-applying the same edit is a no-op. Returns `409` with a `cloneSuggestion` payload when the target is read-only (template) |
| `/api/persist-style` | DELETE | Revert a persisted edit — query `?cfId=<id>&project=<dir>&file=<basename>`. Removes the rule and strips the `data-cf-id` attribute if no other rule references it |
| `/api/persist-style` | GET | List persisted edits for a card — query `?project=<dir>&file=<basename>`. Returns `{count, rules: [{selector, declarations}]}` |

Persisted edits survive reloads, card regeneration, and exports. They are
byte-additive — everything outside the user-edits region is untouched.

## Campaign brief and anchor revisions

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/brief` | GET | Return the active project's `brief.json` or `null` |
| `/api/brief` | POST | Write the brief — body is an arbitrary JSON object (no schema enforcement). Returns 400 if no project is active |
| `/api/distill-status` | GET | Anchor revision and per-variant staleness — `{anchor:{file,revision,status}, variants:[{file,format,derivedFromRevision,status,staleBy}], stale:[files]}`. Use at the start of every iteration turn to detect stale variants |
| `/api/anchor/revise` | POST | Bump `brief.anchor.revision` and mark variants with `derivedFromRevision < new revision` as `status: "stale"`. Optional body `{reason?}` |
| `/api/anchor/approve` | POST | Set `brief.anchor.status = "approved"`, record `approvedAt`. Idempotent |

## Box Layout validation

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/validate-card` | POST | Validate one card — body `{project, file, cardIndex, force?}`. Returns `{ok, pass, score, violations:[{rule, severity, path, message, fix}], summary, fixInstructions}`. Cached by SHA-1 of HTML + dimensions + preset. Returns `{ok:true, skipped:"master-switch-off"}` when the session has validation disabled |
| `/api/validate-cards?project=&file=` | GET | Batch validate every card in a file — `{ok, pass, cards, failingCards}`. Used by Layer 4 (export preflight) and Layer 5 (status gate) |
| `/api/validation-config?project=<dir>[&file=<basename>]` | GET | Resolved config cascade `{config, source, contentType}`. Cascade order: type-default → user default → session → per-file. `source` map shows which scope produced each top-level field |
| `/api/validation-config` | PATCH | Merge a partial patch — body `{project\|user:true, patch}`. Returns the new resolved config |
| `/api/validation-config/toggle` | POST | Flip a layer on or off — body `{project, layer, value}`. Layers: `all` (master), `endpoint`, `badge`, `agentDiscipline`, `exportPreflight`, `statusGate` |
| `/api/validation-config/ignore-violation` | POST | Add a per-file exemption — body `{project, file, rule, selector?, cardIndex?}` |
| `/api/validator-health` | GET | `{degraded, workers, cacheSize, cacheHits, cacheMisses, avgLatencyMs, lastError}`. `degraded: true` means Playwright is missing and all layers default to pass |

Default thresholds: slides and documents strict at ≥ 0.9; social cards
lenient at ≥ 0.8. Override per session or globally via
`PATCH /api/validation-config`.

## Templates

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/templates` | GET | List template files with metadata (id, type, format, url) — includes templates from installed brand skills' `templates/` dirs |
| `/api/template?file=X[&brand=Y]` | GET | Serve a single template HTML file; `brand` param routes to a brand skill's `templates/` dir |

## Brands

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/brands` | GET | List installed brand skills (those with `brand/tokens.json`) |
| `/api/active-brand` | POST | Set or clear the active brand — body `{name}` or `{}` to clear |
| `/api/brand/:name/assets/*` | GET | Serve a file from a brand skill's `assets/` — use these URLs for logos and fonts in generated HTML |

## Export

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/export-png` | POST | Render card HTML to PNG via Playwright at 2× resolution |
| `/api/export-pdf` | POST | Render slides to a multi-page PDF — body `{slides:[{html,width,height}]}`, returns `application/pdf` |

PPTX and DOCX export run in the browser via PptxGenJS and client-side
Pandoc — no dedicated server endpoints. PNG screenshots for PPTX slides
and DOCX figures still route through `/api/export-png`.

## WebSocket

The server runs a WebSocket endpoint at the same port. The browser app
connects automatically and receives:

- `{type: "reload"}` whenever a content file changes — triggers a live update
- `{type: "reload-templates"}` whenever a template file changes — refreshes the Gallery without a page reload

# Codi Brain Phase 1 — Week 0 + Week 1 Implementation Plan

> **For agentic workers:** Use `codi-plan-execution` to implement this plan task-by-task. That skill asks the user to pick INLINE (sequential) or SUBAGENT (fresh subagent per task with two-stage review) mode. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Absorb `code-graph-rag` into the new `codi-brain` repo and ship the local code-brain service (FastAPI + Memgraph + Qdrant in Docker Compose) that can ingest the codi repo and answer code queries over HTTP.

**Architecture:** New Python service (`codi-brain`) as a separate repo. Absorbs `code-graph-rag` source as `src/code_graph/`. Exposes 4 endpoints in Week 1: `/healthz` (200/503 with per-dep checks), `POST /ingest/repo`, `GET /code/search`, `GET /code/snippet`. Auth via single bearer token from env, `hmac.compare_digest`. Memgraph + Qdrant on ports 7688 / 6334 (offset from the existing `graph-code` stack on 7687 / 6333 to coexist during development).

**Tech Stack:** Python 3.12, uv, FastAPI, uvicorn, Pydantic Settings, loguru, SlowAPI, pymgclient, qdrant-client, tree-sitter (via absorbed `code_graph`), pydantic-ai (via absorbed `code_graph`), pytest + testcontainers-python, Docker, Docker Compose. Auth is a single-token `hmac.compare_digest`; Argon2id + per-user keys land in Phase 2.

**Scope notes:**
- **Identity:** Phase 1 does not create `User`, `UserKey`, or `Project` nodes. Identity is env-hardcoded via `PROJECT_ID`, `ADMIN_USER_ID`, and `BRAIN_BEARER_TOKEN`. Per-user keys are Phase 2.
- **Code search:** Week 1 ships `GET /code/search` as a Cypher `CONTAINS` match on `qualified_name` and `name`. Qdrant vector upserts during ingest and hybrid (graph+vector) merging land in Week 2. The `code_embeddings` collection is still created in Week 1 so Week 2's additions are additive, not migrations.
- **Ingest counts:** `POST /ingest/repo` returns `nodes_added` (delta) and `qualified_names_count` (current total) accurately. `nodes_updated` and `nodes_deleted` are reported as `0` in Week 1; real diff accounting lands in Week 2 alongside the `force` re-ingest path.

**Scope of this plan:** Week 0 (absorb) + Week 1 (foundation + code brain). Week 2 (notes + vault + scenario C) and Week 3 (VPS migration) each get their own plan doc after Week 1 ships.

**Source spec:** `docs/20260422_230000_[PLAN]_codi-brain-phase-1.md` (approved via codi-brainstorming).

---

## Progress log

Execution is under way. **Weeks 0, 1, and 2A are complete.** `~/projects/codi-brain` is pushed to `github.com/lehidalgo/codi-brain` (private) at commit `ab3ce83` on `main`. Full pytest suite: **882 passed, 12 skipped, 2 xfailed**. Both smoke scripts run clean end-to-end against a live docker-compose stack: `scripts/week0_smoke.sh` (code-graph ingest + search) and `scripts/week2a_smoke.sh` (notes API + vault round-trip).

**Remaining in Phase 1:** Week 2B (Codi CLI client-side integration — the piece that wires the brain into real Claude Code / Cursor / Codex sessions) and Week 3 (production hardening + VPS deployment + retention policies). See `docs/20260423_170000_[ROADMAP]_codi-brain-phase-1-next-phases.md` for the forward plan.

### Week 0 status: 12 of 12 tasks shipped ✅

| # | Task | Status | Commit |
|---|---|---|---|
| 0.1 | Scaffold codi-brain repo | ✅ done | `640bc0a` |
| 0.2 | Absorb codebase_rag → `src/code_graph` | ✅ done | `bffc504` |
| 0.3 | Tests → `tests/test_code_graph` | ✅ done | `b400d74` |
| 0.4 | Merge dependency declarations | ✅ done | `8d4c8a0` |
| 0.5 | Delete CLI/MCP artifacts | ✅ done | `14042b1` |
| 0.6 | Absorbed tests green | ✅ done | `14efde3` |
| 0.7 | TDD-red: `project_id` kwarg on GraphUpdater | ✅ done | `ffc44bb` |
| 0.8 | TDD-green: GraphUpdater accepts `project_id` | ✅ done | `c6e18fa` |
| 0.9 | TDD-red: MemgraphIngestor persists `project_id` | ✅ done | `e328e68` |
| 0.10 | TDD-green: MemgraphIngestor auto-injects `project_id` | ✅ done | `2215903` |
| 0.11 | Explicit Memgraph host/port kwargs (signature test) | ✅ done | `522c493` |
| 0.12 | Week 0 smoke script | ✅ done | `cd9d73a` |

Test suite: **769 passed, 12 skipped, 2 xfailed** in ~2.7 min.
Week 0 smoke: `bash scripts/week0_smoke.sh` → `Week 0 smoke: OK`.
Next runnable task: **Week 1 — Task 1.1 (Dockerfile)**. Recommend switching codi-plan-execution from INLINE to SUBAGENT for the 28 Week 1 tasks.

### Deviations from the as-written plan, documented

1. **`xfail` instead of delete (Task 0.6):** two tests in `test_structural_relationships.py` (`test_contains_file_relationships`, `test_edge_cases_empty_folders_and_special_files`) were marked `@pytest.mark.xfail(strict=False)` rather than deleted. Both fail upstream in `code-graph-rag` too — confirmed — so they are not regressions from absorption. Kept visible with explicit reason strings so the next maintainer can revisit.
2. **Additional test deletions in Task 0.6** beyond the plan's explicit list: `test_protobuf_*.py`, `test_realtime_updater.py`, `test_main_smoke.py` — they target upstream-root modules (`codec/`, `realtime_updater.py`, `main.py`) that were not absorbed into codi-brain. Same spirit as the plan's "delete tests for removed code".
3. **Ingestor-level `project_id` propagation (Task 0.8):** rather than threading `project_id` into every `parsers/*_processor.py` collaborator (plan step 3), I set `self.ingestor.project_id = project_id` once in `GraphUpdater.__init__`. Task 0.10 then auto-injects on the ingestor side. Same end state with no processor edits.
4. **Testcontainer fixtures pulled forward (Task 0.9):** `memgraph_port`, `memgraph_client`, and `qdrant_url` fixtures were added to `tests/conftest.py` now (plan had them in Task 1.15 / 1.17). Needed by Task 0.9's test; cheap to add; unblocks.
5. **Conftest import rewrite (Task 0.6):** `from code_graph.tests.conftest import run_updater` across 124 files rewritten to `from conftest import run_updater`. Needed after moving tests out of `src/code_graph/tests/` into top-level `tests/test_code_graph/`.
6. **`uv.lock` included in Task 0.1 commit:** plan omitted it; added for reproducibility.
7. **Memgraph image pin bumped from `2.16.1` to `latest` (Task 0.10):** the pinned `memgraph/memgraph-mage:2.16.1` does not exist on Docker Hub — Memgraph's public tags jumped from `2.x` straight to `3.6.x`+. Bumped `tests/conftest.py` to `:latest` (matches upstream `code-graph-rag/docker-compose.yaml`). Week 1 Dockerfile + compose must use the same unpinned reference or pick an explicit `3.x` tag consistently.
8. **Task 0.9 test rewritten in Task 0.10 commit:** the committed `test_ingestor_project_id.py` from Task 0.9 called `ingestor.close()` (no such method) and skipped `__enter__` (left `self.conn=None`, silently no-opped the flush). Rewritten to use `with MemgraphIngestor(...) as ingestor:` before green-barring. Bundled into commit `2215903`.
9. **Task 0.11 was a no-op for production code:** upstream `MemgraphIngestor.__init__` already exposes `host: str, port: int` kwargs. Added `tests/test_code_graph/test_explicit_config.py` to pin that contract so future refactors cannot silently re-introduce env-var sniffing.
10. **Task 1.1 Dockerfile split into builder + runtime stages (code-review fix):** the as-written Dockerfile inherited `runtime` from a `base` stage that included `build-essential`, `git`, and `uv` — bloating the image to ~1.2GB and carrying toolchain CVEs into production. The code review surfaced this as a HIGH finding; the implementer's commit was amended to use a fresh `python:3.12-slim` runtime stage with only `curl` + `ca-certificates`, copying the prebuilt `/opt/venv` from the builder. Runtime image dropped to ~717MB. The Task 1.1 block above reflects the fixed version. Two code-review MEDIUMs (runtime filesystem not chown'd to `brain`; no `STOPSIGNAL`/init wrapper) are deferred — they will matter once the app actually runs caches/handles SIGTERM in Week 1 later tasks, not at image-build time.
11. **Task 1.2 docker-compose hardening (code-review fix):** original compose used `depends_on: condition: service_started`, which only waits for the container PID to exist. Memgraph needs ~10s to accept Bolt on 7687, so brain-api crashed on cold start. Amended commit adds healthchecks to both memgraph (`mgconsole` probe) and qdrant (bash TCP probe), switches brain-api to `condition: service_healthy`, and adds `restart: on-failure` as defense in depth. Also: bootstrapped `data/repos/` and `data/vaults/` with `.gitkeep` files and updated `.gitignore` with an allow-list (`/data/*` deny, `!/data/repos/` + `!/data/vaults/` allow, `!.gitkeep` allow) so the bind-mount targets exist on fresh clones — Docker would otherwise create them as root-owned. Three code-review MEDIUMs (ports bound to 0.0.0.0 instead of 127.0.0.1; `.env.example` 127.0.0.1 defaults misleading inside compose; `BRAIN_BEARER_TOKEN` placeholder too realistic) deferred to a Phase 1B hardening pass.
12. **Phase 0 plan audit before Task 1.4 — 5 plan patches applied.** Before writing more code, the remaining Week 1 tasks were cross-checked against the absorbed `code_graph` source and against Week 0's conftest state. Patches landed directly in this plan doc: (a) Task 1.22's adapter used `ingestor.client.cursor()` but Week 0's `MemgraphIngestor` exposes `self.conn` — changed all four call sites to `ingestor.conn.cursor()`; (b) Task 1.22 passed `repo_path` as a `str` but `GraphUpdater` expects `pathlib.Path` — added `from pathlib import Path` and `repo_path=Path(repo_path)`; (c) Task 1.22's `updater.run()` left embeddings on by default, which would call OpenAI with a fake test key — switched to `updater.run(incremental_embeddings=False, resume_embeddings=False)` (Week 1 scope is graph-only); (d) Tasks 1.15 and 1.17 told the implementer to rewrite `tests/conftest.py`, which would re-introduce the non-existent `memgraph-mage:2.16.1` pin and overwrite Week 0's fixtures — both tasks now skip the conftest step as an explicit no-op; (e) Task 1.26's `/code/search` and `/code/snippet` created `Settings()` inline instead of injecting via `Depends(get_settings)` — fixed to match Task 1.12's dependency-injection pattern. Qdrant `/healthz` on v1.11.3 verified to return 200 (no change needed).
13. **Task 1.4 side-effect: `code_graph.config.AppConfig` extra="ignore" fix.** Codi-brain's new `.env` file (from Task 1.2) shares the working directory with the absorbed code_graph library, whose module-level `AppConfig` used pydantic's default `extra="forbid"` and blew up on import as soon as `.env` contained codi-brain-specific keys. Added `extra="ignore"` to `AppConfig.model_config` so both `Settings` classes coexist. Separate commit (`d6a1d8d`) alongside Task 1.4.
14. **Task 1.5 + 1.7 + 1.9 test-env hygiene.** Task 1.9 fixture calls `get_settings.cache_clear()` before instantiating the app. Without that, an earlier test's cached Settings leaks into later tests and the bearer-token compare uses the wrong token (the F7 watch-item predicted in Phase 0 audit).
15. **Task 1.13 → 1.14 test rewrite.** As the plan anticipated, the rate-limit test from Task 1.13 was superseded by Task 1.14's version that uses `@limiter.limit` directly with the correct `Request` type hint. Task 1.14's commit touches both `src/codi_brain/rate_limit.py` and `tests/test_rate_limit.py`.
16. **Task 1.20 typer single-command-collapse workaround.** A Typer app with exactly one `@app.command()` collapses the subcommand into the app name — `runner.invoke(app, ["migrate"])` returns exit 2 (usage error) because typer treats `migrate` as the app itself, not a subcommand. Added a no-op `@app.callback()` to force multi-command mode. Will become load-bearing as more CLI commands are added in Week 2.
17. **Task 1.28 smoke — four real operational bugs fixed in one commit.** The Week 1 smoke script surfaced four issues that unit tests (testcontainers against host Python) did not:
    - **(a) tree-sitter segfault on linux/aarch64.** `tree-sitter==0.25.0` + `tree-sitter-python==0.25.0` manylinux_2_17_aarch64 wheels crash with SIGSEGV (exit 139) on `Parser.parse()` of any input, reproduced in a bare `python:3.12-slim` arm64 container. Building from sdist also fails (linker error: undefined symbol `tree_sitter_python_external_scanner_create`). Pinned tree-sitter 0.24 with `tree-sitter-python==0.23.6` works but other grammars (rust/scala/lua) need language version 15 which requires tree-sitter 0.25. Resolution: `platform: linux/amd64` on the brain-api service. Memgraph + Qdrant stay native arm64 (compose-network traffic is architecture-transparent). Matches the Week 3 VPS target (x86_64), so this is the correct long-term choice, not a workaround.
    - **(b) Runtime image non-root permission.** `/app/src` and `/opt/venv` were copied as root in the runtime stage; after `USER brain` the non-root user got `PermissionError` reading `code_graph/change_detector.py`. Fixed by adding `--chown=brain:brain` to both `COPY --from=builder` lines and creating the `brain` user before the COPYs. This was the MEDIUM finding deferred from the Task 1.1 code review — now load-bearing.
    - **(c) Runtime image missing `git`.** `GraphUpdater._save_last_indexed_commit()` shells out to `git` to record the HEAD commit. Added `git` to the runtime apt install alongside `curl` + `ca-certificates`. Size impact: ~25MB.
    - **(d) mgclient session visibility bug.** The wrapper's `_count_project_nodes` used `ingestor.conn.cursor()` to read node counts before/after `updater.run()`. Despite `autocommit=True` and `updater.run()` calling `flush_all()` mid-run, the same-connection cursor consistently returned 0 while a fresh `mgclient.connect(...)` saw the actual 70 nodes. Resolution: added `_count_project_nodes_fresh` / `_count_project_qualified_names_fresh` that open a new connection per count. Root cause is a Bolt session-snapshot issue in pymgclient 1.5.2 against Memgraph — will file upstream.

    Smoke outcome on fresh volumes: `nodes_added=70, qualified_names_count=46, duration_seconds≈1.3`. `GET /code/search?q=app` returns `codi_brain.app` module and `codi_brain.app.create_app` function. Week 1 ship criterion met.

### How to resume in a fresh session

Week 0 is complete. The next session opens Week 1.

```bash
cd ~/projects/codi-brain
git log --oneline | head -12             # confirm 12 commits on main
bash scripts/week0_smoke.sh              # expect: Week 0 smoke: OK (769 passed, 12 skipped, 2 xfailed)
```

Then start at **Task 1.1** (Dockerfile scaffold) per this impl plan. Recommended: switch `codi-plan-execution` mode from INLINE to SUBAGENT — Week 1 has 28 atomic tasks across Docker, FastAPI, auth, routes, and workers. Fresh subagent context per task + two-stage review keeps the main session clean.

Full handoff report at `docs/20260423_020000_[REPORT]_codi-brain-phase-1-week-0-progress.md` — now historical; Week 0 tasks 0.10–0.12 are all shipped.

---

## Week 0 — Absorb `code-graph-rag`

**Goal:** half a day of focused work. Move `code-graph-rag` into the new `codi-brain` repo as the `src/code_graph/` module. One repo, one release cycle, no external pin.

**Pre-flight:** `github.com/lehidalgo/codi-brain` repo created (empty, public). Local clone of `github.com/lehidalgo/code-graph-rag` available for copying.

### Task 0.1: Scaffold the `codi-brain` repo

- [ ] **Files**: `pyproject.toml`, `.gitignore`, `README.md`, `.python-version`
  **Est**: 3 minutes

  **Steps**:
  1. `cd ~/projects && git clone git@github.com:lehidalgo/codi-brain.git && cd codi-brain`
  2. Create `.python-version`:
     ```
     3.12
     ```
  3. Create `pyproject.toml`:
     ```toml
     [project]
     name = "codi-brain"
     version = "0.1.0"
     description = "Codi Brain — per-project memory and code intelligence service"
     requires-python = ">=3.12,<3.13"
     dependencies = []
     
     [tool.uv]
     package = true
     
     [tool.uv.workspace]
     members = []
     
     [build-system]
     requires = ["hatchling"]
     build-backend = "hatchling.build"
     
     [tool.hatch.build.targets.wheel]
     packages = ["src/codi_brain", "src/code_graph"]
     
     [tool.ruff]
     line-length = 100
     target-version = "py312"
     
     [tool.pytest.ini_options]
     testpaths = ["tests"]
     pythonpath = ["src"]
     ```
  4. Create `.gitignore`:
     ```
     __pycache__/
     *.py[cod]
     *$py.class
     .venv/
     .env
     .env.local
     .pytest_cache/
     .ruff_cache/
     .mypy_cache/
     *.egg-info/
     dist/
     build/
     /data/
     /backups/
     .DS_Store
     ```
  5. Create `README.md`:
     ```markdown
     # codi-brain
     
     Per-project memory and code intelligence service. See `docs/` in the `codi` repo for the design.
     ```
  6. Verify scaffolding: `uv sync` — expected: creates `.venv/`, no errors.
  7. Commit: `git add pyproject.toml .gitignore README.md .python-version && git commit -m "chore: scaffold codi-brain repo"`

  **Verification**: `uv sync && ls -la .venv` — expected: venv exists.

### Task 0.2: Copy `codebase_rag/` → `src/code_graph/`

- [ ] **Files**: `src/code_graph/**` (many files copied from the source repo)
  **Est**: 3 minutes

  **Steps**:
  1. From the codi-brain repo root, copy the upstream package:
     ```bash
     mkdir -p src
     cp -R ~/projects/code-graph-rag/codebase_rag src/code_graph
     ```
  2. Verify the copy landed:
     ```bash
     test -f src/code_graph/__init__.py && echo "OK" || echo "FAIL"
     test -d src/code_graph/parsers && echo "OK" || echo "FAIL"
     test -d src/code_graph/services && echo "OK" || echo "FAIL"
     ```
     Expected: `OK OK OK`.
  3. Rewrite import paths from `codebase_rag` to `code_graph`:
     ```bash
     find src/code_graph -type f -name "*.py" -print0 \
       | xargs -0 sed -i '' 's/\bcodebase_rag\b/code_graph/g'
     ```
     (On Linux drop the `''` after `-i`.)
  4. Verify no `codebase_rag` references remain:
     ```bash
     grep -r "codebase_rag" src/code_graph/ && echo "FAIL" || echo "OK"
     ```
     Expected: `OK`.
  5. Commit: `git add src/code_graph && git commit -m "feat(code_graph): absorb codebase_rag as src/code_graph"`

  **Verification**: `grep -r codebase_rag src/code_graph || echo "clean"` — expected: `clean`.

### Task 0.3: Copy tests → `tests/test_code_graph/`

- [ ] **Files**: `tests/test_code_graph/**`, `tests/__init__.py`, `tests/conftest.py`
  **Est**: 3 minutes

  **Steps**:
  1. Copy upstream tests:
     ```bash
     mkdir -p tests
     cp -R ~/projects/code-graph-rag/codebase_rag/tests tests/test_code_graph
     touch tests/__init__.py
     ```
  2. Fix import paths in the copied tests:
     ```bash
     find tests/test_code_graph -type f -name "*.py" -print0 \
       | xargs -0 sed -i '' 's/\bcodebase_rag\b/code_graph/g'
     ```
  3. Create a minimal `tests/conftest.py` (stub for Week 1 fixtures):
     ```python
     """Shared pytest fixtures for codi-brain tests."""
     ```
  4. Verify no `codebase_rag` refs remain:
     ```bash
     grep -r "codebase_rag" tests/ && echo "FAIL" || echo "OK"
     ```
     Expected: `OK`.
  5. Commit: `git add tests && git commit -m "test(code_graph): absorb upstream tests as tests/test_code_graph"`

  **Verification**: `grep -r codebase_rag tests/ || echo clean` — expected: `clean`.

### Task 0.4: Merge dependency declarations

- [ ] **Files**: `pyproject.toml`
  **Est**: 4 minutes

  **Steps**:
  1. Inspect the upstream deps list:
     ```bash
     cat ~/projects/code-graph-rag/pyproject.toml | grep -A 40 '\[project\]'
     ```
  2. Edit `pyproject.toml` and replace the `dependencies = []` line with the merged list (versions are the newer of the two when in conflict; if unsure, use the upstream version):
     ```toml
     dependencies = [
         "fastapi>=0.115.0",
         "uvicorn[standard]>=0.32.0",
         "pydantic>=2.9.0",
         "pydantic-settings>=2.6.0",
         "loguru>=0.7.2",
         "slowapi>=0.1.9",
         "pymgclient>=1.4.0",
         "qdrant-client>=1.12.0",
         "tree-sitter>=0.23.0",
         "tree-sitter-languages>=1.10.2",
         "pydantic-ai>=0.0.13",
         "openai>=1.54.0",
         "google-genai>=0.3.0",
         "watchdog>=5.0.0",
         "typer>=0.15.0",
         "rich>=13.9.0",
         "gitpython>=3.1.43",
     ]
     
     [dependency-groups]
     dev = [
         "pytest>=8.3.0",
         "pytest-asyncio>=0.24.0",
         "pytest-cov>=5.0.0",
         "testcontainers>=4.8.0",
         "httpx>=0.27.0",
         "ruff>=0.7.0",
         "mypy>=1.13.0",
     ]
     ```
  3. Run `uv sync` — expected: lockfile written, venv populated, no errors.
  4. Verify core imports work:
     ```bash
     uv run python -c "from code_graph import graph_updater; print('ok')"
     ```
     Expected: `ok` (may show tree-sitter grammar warnings — that's fine; we'll handle them in Task 0.8).
  5. Commit: `git add pyproject.toml uv.lock && git commit -m "chore: merge code_graph deps into pyproject.toml"`

  **Verification**: `uv run python -c "import code_graph"` — expected: exits 0.

### Task 0.5: Delete artifacts we do not ship

- [ ] **Files**: remove `src/code_graph/main.py`, `src/code_graph/mcp/`, `src/code_graph/build_binary.py` (if present)
  **Est**: 2 minutes

  **Steps**:
  1. Inspect what we are about to remove:
     ```bash
     ls src/code_graph/main.py src/code_graph/mcp 2>/dev/null
     ls src/code_graph/build_binary.py 2>/dev/null
     ```
  2. Remove CLI and MCP-stdio artifacts (brain-api is our shell; we don't ship the `cgr` CLI or the stdio MCP server):
     ```bash
     rm -f src/code_graph/main.py
     rm -rf src/code_graph/mcp
     rm -f src/code_graph/build_binary.py
     ```
  3. Verify nothing imports the removed files:
     ```bash
     grep -rE "from code_graph\.(main|mcp|build_binary)" src/ tests/ && echo "FAIL" || echo "OK"
     ```
     Expected: `OK`.
  4. Commit: `git add -A src/code_graph && git commit -m "refactor(code_graph): drop CLI and MCP-stdio entries (absorbed, not distributed)"`

  **Verification**: `ls src/code_graph/main.py 2>/dev/null || echo gone` — expected: `gone`.

### Task 0.6: Verify upstream symbols exist, then run absorbed tests

- [ ] **Files**: none modified; this is a verification task
  **Est**: 5 minutes

  **Steps**:
  1. Probe the upstream module layout for the symbols `brain-api` will import. Run each and record any `ImportError` or `AttributeError`; if one fails, check upstream's actual layout and make a note in `docs/` or an issue for follow-up. We must confirm all four before Week 1 Task 1.22:
     ```bash
     uv run python - <<'PY'
     import importlib, inspect, sys
     targets = [
         ("code_graph.graph_updater", "GraphUpdater"),
         ("code_graph.services.graph_service", "MemgraphIngestor"),
         ("code_graph.parser_loader", "load_parsers"),   # may differ upstream
     ]
     missing = []
     for mod, attr in targets:
         try:
             m = importlib.import_module(mod)
             if not hasattr(m, attr):
                 missing.append(f"{mod}.{attr}")
             else:
                 print(f"OK: {mod}.{attr}")
         except ImportError as e:
             missing.append(f"{mod}.{attr} (import failed: {e})")
     if missing:
         print("MISSING:", missing)
         sys.exit(1)
     print("All required symbols resolve.")
     PY
     ```
     If `load_parsers` is missing, search for the actual entry: `grep -rE "def (load|init|build).*(parsers|grammars)" src/code_graph/` — the real name might be `load_tree_sitter_parsers` or similar. Update Task 1.22's adapter import to match.
  2. Verify the ingestor supports the context-manager protocol (used by Task 1.22):
     ```bash
     uv run python -c "from code_graph.services.graph_service import MemgraphIngestor; assert hasattr(MemgraphIngestor, '__enter__') and hasattr(MemgraphIngestor, '__exit__'), 'MemgraphIngestor must be a context manager'"
     ```
     If it fails, add `__enter__`/`__exit__` to `MemgraphIngestor` returning `self` and calling `self.close()` respectively. Commit that fix under the `feat(code_graph)` scope.
  3. Run the absorbed tests:
     ```bash
     uv run pytest tests/test_code_graph/ -x --tb=short
     ```
  4. If any tests fail due to refactored imports or removed files (main, mcp), skip them explicitly by deleting those test files rather than fixing them (they test code we already removed):
     ```bash
     # Only if a failing test targets removed code:
     rm -f tests/test_code_graph/test_main.py tests/test_code_graph/test_mcp_*.py
     uv run pytest tests/test_code_graph/ -x --tb=short
     ```
  5. Once green, commit any deletions:
     ```bash
     git add -A tests/test_code_graph
     git diff --cached --quiet || git commit -m "test(code_graph): drop tests for removed CLI/MCP entries"
     ```

  **Verification**: `uv run pytest tests/test_code_graph/ -q` — expected: all tests pass or are skipped cleanly; the symbol probe prints "All required symbols resolve."

### Task 0.7: Add `project_id` property to `Module` ingestion — write test

- [ ] **Files**: `tests/test_code_graph/test_project_id_property.py`
  **Est**: 3 minutes

  **Steps**:
  1. Write a failing unit test for the `project_id` property threading:
     ```python
     # tests/test_code_graph/test_project_id_property.py
     """project_id must be set on every node written by GraphUpdater."""
     from code_graph.graph_updater import GraphUpdater
     
     
     def test_graph_updater_accepts_project_id_kwarg():
         """GraphUpdater.__init__ must accept a project_id keyword and store it."""
         # Uses a fake ingestor so no Memgraph is required
         class FakeIngestor:
             def __init__(self):
                 self.buffered_nodes: list[dict] = []
     
             def ensure_node(self, label: str, props: dict) -> None:
                 self.buffered_nodes.append({"label": label, "props": props})
     
             def flush_all(self) -> None:
                 pass
     
         ingestor = FakeIngestor()
         updater = GraphUpdater(
             ingestor=ingestor,
             repo_path="/tmp/doesnotexist",
             parsers={},
             queries={},
             project_id="test-project-id-0001",
         )
         assert updater.project_id == "test-project-id-0001"
     ```
  2. Run and verify failure:
     ```bash
     uv run pytest tests/test_code_graph/test_project_id_property.py -x
     ```
     Expected: test fails with `TypeError: __init__() got an unexpected keyword argument 'project_id'` (or similar — upstream GraphUpdater does not accept `project_id` yet).
  3. Commit the failing test:
     ```bash
     git add tests/test_code_graph/test_project_id_property.py
     git commit -m "test(code_graph): require project_id kwarg on GraphUpdater"
     ```

  **Verification**: test fails as above.

### Task 0.8: Add `project_id` property to `GraphUpdater` — implementation

- [ ] **Files**: `src/code_graph/graph_updater.py`
  **Est**: 5 minutes

  **Steps**:
  1. Open `src/code_graph/graph_updater.py` and locate the `GraphUpdater.__init__` signature.
  2. Add `project_id: str | None = None` to the signature and `self.project_id = project_id` in the body. Example patch shape (adapt to the upstream's actual signature):
     ```python
     class GraphUpdater:
         def __init__(
             self,
             *,
             ingestor,
             repo_path,
             parsers,
             queries,
             project_id: str | None = None,
             # ... other existing kwargs
         ):
             self.ingestor = ingestor
             self.repo_path = repo_path
             self.parsers = parsers
             self.queries = queries
             self.project_id = project_id
             # ... rest of the existing init body
     ```
  3. Find every call site inside `GraphUpdater` and its `parsers/*_processor.py` collaborators that writes a node (`ingestor.ensure_node(label, {...})` or the equivalent `MERGE` builder). For each, inject `project_id` into the node props:
     ```python
     # Before a node write, build props with project_id:
     props = {"qualified_name": qn, "name": name, "path": path, ...}
     if self.project_id is not None:
         props["project_id"] = self.project_id
     self.ingestor.ensure_node(label, props)
     ```
     Doing this in a helper `self._with_project_id(props: dict) -> dict` is cleaner. Add:
     ```python
     def _with_project_id(self, props: dict) -> dict:
         if self.project_id is not None:
             return {**props, "project_id": self.project_id}
         return props
     ```
     Use `self._with_project_id({...})` at every node write site.
  4. Run the test:
     ```bash
     uv run pytest tests/test_code_graph/test_project_id_property.py -x
     ```
     Expected: passes.
  5. Run the whole test suite to confirm no regression:
     ```bash
     uv run pytest tests/test_code_graph/ -q
     ```
     Expected: all green.
  6. Commit: `git add src/code_graph/graph_updater.py src/code_graph/parsers && git commit -m "feat(code_graph): thread project_id into every node write"`

  **Verification**: `uv run pytest tests/test_code_graph/ -q` — expected: all passing.

### Task 0.9: Add Cypher-filterable `project_id` to `MemgraphIngestor` — test

- [ ] **Files**: `tests/test_code_graph/test_ingestor_project_id.py`
  **Est**: 3 minutes

  **Steps**:
  1. Write a test that the ingestor actually persists `project_id` to Memgraph. Use a real in-container Memgraph (the `memgraph_client` fixture from Task 1.15) rather than a fake, so the assertion cannot pass on a substring coincidence:
     ```python
     # tests/test_code_graph/test_ingestor_project_id.py
     """MemgraphIngestor must write project_id as a queryable node property."""
     from code_graph.services.graph_service import MemgraphIngestor
     
     
     def test_ensure_node_persists_project_id(memgraph_port, memgraph_client):
         """After flush, project_id is queryable on the created node."""
         ingestor = MemgraphIngestor(host="127.0.0.1", port=memgraph_port)
     
         props = {
             "qualified_name": "proj-1.module.func",
             "name": "func",
             "project_id": "proj-1",
         }
         ingestor.ensure_node("Function", props)
         ingestor.flush_all()
         ingestor.client.close()
     
         cur = memgraph_client.cursor()
         cur.execute(
             "MATCH (n:Function {qualified_name: $qn}) RETURN n.project_id AS pid",
             {"qn": "proj-1.module.func"},
         )
         rows = cur.fetchall()
         cur.close()
     
         assert rows, "node was not created"
         assert rows[0][0] == "proj-1", f"expected project_id='proj-1', got {rows[0][0]}"
     ```
  2. Run and verify failure (may pass if the upstream already persists arbitrary props — investigate and rewrite the test to check `project_id` specifically; do not green-bar on a false positive):
     ```bash
     uv run pytest tests/test_code_graph/test_ingestor_project_id.py -xvs
     ```
     If it already passes, inspect `captured` contents to confirm `project_id` really is written — the upstream ingestor is likely prop-agnostic and this test is a safety net. Commit the passing test in that case.
  3. Commit:
     ```bash
     git add tests/test_code_graph/test_ingestor_project_id.py
     git commit -m "test(code_graph): pin project_id propagation through MemgraphIngestor"
     ```

  **Verification**: test runs (pass or fail); if fail, proceed to Task 0.10; if pass, Task 0.10 is a no-op commit message and can be skipped.

### Task 0.10: Ensure `MemgraphIngestor` persists `project_id` — implementation

- [ ] **Files**: `src/code_graph/services/graph_service.py`
  **Est**: 4 minutes

  **Steps**:
  1. Open `src/code_graph/services/graph_service.py` and locate `MemgraphIngestor.ensure_node` and its `_flush_node_buffer` / `flush_all` methods.
  2. Confirm the generated `UNWIND $batch AS row MERGE ... SET n += row` pattern already passes arbitrary props. If so, no code change is required — the test from Task 0.9 passes as-is. Confirm by re-running the test:
     ```bash
     uv run pytest tests/test_code_graph/test_ingestor_project_id.py -xvs
     ```
  3. If the ingestor filters props to a whitelist (unlikely), widen the whitelist to include `project_id`, then re-run the test until green.
  4. Commit any changes: `git add src/code_graph/services/graph_service.py && git commit -m "feat(code_graph): ensure project_id persists through ingestor buffer"` — or if no changes were needed, skip the commit.

  **Verification**: `uv run pytest tests/test_code_graph/ -q` — expected: all passing.

### Task 0.11: Make Memgraph/Qdrant connections injectable via explicit args

- [ ] **Files**: `src/code_graph/services/graph_service.py`, `src/code_graph/services/llm.py` (if it reads env directly), `tests/test_code_graph/test_explicit_config.py`
  **Est**: 5 minutes

  **Steps**:
  1. Write a failing test that `MemgraphIngestor` accepts explicit host/port without reading env:
     ```python
     # tests/test_code_graph/test_explicit_config.py
     """Services accept connection settings via explicit kwargs, not env vars only."""
     import inspect
     from code_graph.services.graph_service import MemgraphIngestor
     
     
     def test_memgraph_ingestor_accepts_explicit_host_port():
         sig = inspect.signature(MemgraphIngestor.__init__)
         params = sig.parameters
         assert "host" in params, f"MemgraphIngestor.__init__ missing 'host': {list(params)}"
         assert "port" in params, f"MemgraphIngestor.__init__ missing 'port': {list(params)}"
     ```
  2. Run: `uv run pytest tests/test_code_graph/test_explicit_config.py -x` — expected: fail if upstream reads env only.
  3. Open `src/code_graph/services/graph_service.py`, modify `MemgraphIngestor.__init__` to accept explicit `host: str | None = None`, `port: int | None = None`:
     ```python
     class MemgraphIngestor:
         def __init__(
             self,
             host: str | None = None,
             port: int | None = None,
             *,
             batch_size: int = 1000,
         ):
             self.host = host or os.getenv("MEMGRAPH_HOST", "127.0.0.1")
             self.port = int(port or os.getenv("MEMGRAPH_PORT", "7687"))
             self.batch_size = batch_size
             self.client = mgclient.connect(host=self.host, port=self.port)
             self.client.autocommit = True
             self.node_buffer = {}
             self.relationship_buffer = []
             self.node_buffer_size = 0
     ```
     (Adapt to the upstream's existing body; add `import os` if needed.)
  4. Run: `uv run pytest tests/test_code_graph/test_explicit_config.py -x` — expected: pass.
  5. Run full absorbed suite: `uv run pytest tests/test_code_graph/ -q` — expected: green.
  6. Commit: `git add src/code_graph/services/graph_service.py tests/test_code_graph/test_explicit_config.py && git commit -m "feat(code_graph): accept explicit Memgraph host/port via kwargs"`

  **Verification**: `uv run pytest tests/test_code_graph/ -q` — expected: all passing.

### Task 0.12: Lock in Week 0 ship criterion

- [ ] **Files**: `scripts/week0_smoke.sh`
  **Est**: 3 minutes

  **Steps**:
  1. Create a smoke script that proves Week 0 shipped:
     ```bash
     # scripts/week0_smoke.sh
     #!/usr/bin/env bash
     set -euo pipefail
     
     echo "1. uv sync succeeds..."
     uv sync
     
     echo "2. code_graph importable from fresh Python..."
     uv run python -c "from code_graph.graph_updater import GraphUpdater; print('GraphUpdater imports')"
     
     echo "3. No git+... refs in pyproject.toml..."
     ! grep -q "git+" pyproject.toml || { echo "FAIL: git+ ref present"; exit 1; }
     
     echo "4. All absorbed tests green..."
     uv run pytest tests/test_code_graph/ -q
     
     echo "Week 0 smoke: OK"
     ```
  2. `chmod +x scripts/week0_smoke.sh && bash scripts/week0_smoke.sh`
     Expected: prints `Week 0 smoke: OK` at the end.
  3. Commit: `git add scripts/week0_smoke.sh && git commit -m "chore: week 0 smoke script"`

  **Verification**: `bash scripts/week0_smoke.sh` — expected: prints `Week 0 smoke: OK`.

---

## Week 1 — Foundation + Code Brain

**Goal:** `docker compose up` produces a running brain-api that can ingest a repo and answer code queries. Bearer auth, Memgraph schema, Qdrant collection, three endpoints: `/healthz`, `POST /ingest/repo`, `GET /code/search`, `GET /code/snippet`.

### Task 1.1: Dockerfile for brain-api

- [ ] **Files**: `Dockerfile`
  **Est**: 4 minutes

  **Steps**:
  1. Create `Dockerfile` (multi-stage split; runtime image does not inherit the toolchain):
     ```dockerfile
     # syntax=docker/dockerfile:1.7
     
     # ---------- builder: has toolchain, git, uv ----------
     FROM python:3.12-slim AS builder
     ENV PYTHONUNBUFFERED=1 \
         PIP_DISABLE_PIP_VERSION_CHECK=1 \
         UV_PROJECT_ENVIRONMENT=/opt/venv
     
     RUN apt-get update \
         && apt-get install -y --no-install-recommends build-essential git ca-certificates \
         && rm -rf /var/lib/apt/lists/*
     
     RUN pip install --no-cache-dir uv==0.5.11
     
     WORKDIR /app
     COPY pyproject.toml uv.lock ./
     RUN uv sync --frozen --no-install-project --no-dev
     
     COPY src ./src
     RUN uv sync --frozen --no-dev
     
     # ---------- runtime: slim, no toolchain ----------
     FROM python:3.12-slim AS runtime
     ENV PYTHONUNBUFFERED=1 \
         PATH="/opt/venv/bin:${PATH}"
     
     RUN apt-get update \
         && apt-get install -y --no-install-recommends curl ca-certificates \
         && rm -rf /var/lib/apt/lists/*
     
     WORKDIR /app
     COPY --from=builder /opt/venv /opt/venv
     COPY --from=builder /app/src ./src
     
     RUN addgroup --system brain && adduser --system --ingroup brain brain
     USER brain
     
     EXPOSE 8000
     HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
         CMD curl --fail http://127.0.0.1:8000/healthz || exit 1
     
     CMD ["uvicorn", "codi_brain.app:app", "--host", "0.0.0.0", "--port", "8000"]
     ```
     Why the split: the prior single-`base`-stage version carried `build-essential`, `git`, and `uv` into the runtime image (~1.2GB). Splitting builder and runtime drops the runtime image to ~717MB and removes toolchain CVE surface.
  2. Verify the image builds (may take a few minutes the first time):
     ```bash
     docker build -t codi-brain:dev .
     ```
     Expected: finishes without errors. Image tagged `codi-brain:dev`.
  3. Commit: `git add Dockerfile && git commit -m "chore: add production Dockerfile (multi-stage, non-root)"`

  **Verification**: `docker images codi-brain:dev --format '{{.Repository}}:{{.Tag}}'` — expected: `codi-brain:dev`.

### Task 1.2: docker-compose for local stack

- [ ] **Files**: `docker-compose.yaml`, `.env.example`
  **Est**: 4 minutes

  **Steps**:
  1. Create `docker-compose.yaml` (healthchecks on both DBs; memgraph pinned to `:latest` — the `2.16.1` tag does not exist on Docker Hub, see Week 0 deviation):
     ```yaml
     services:
       brain-api:
         build: .
         image: codi-brain:dev
         env_file: .env
         environment:
           MEMGRAPH_HOST: memgraph
           MEMGRAPH_PORT: "7687"
           QDRANT_URL: http://qdrant:6333
           LOG_LEVEL: DEBUG
         ports:
           - "8000:8000"
         restart: on-failure
         depends_on:
           memgraph:
             condition: service_healthy
           qdrant:
             condition: service_healthy
         volumes:
           - ./data/vaults:/data/vaults
           - ./data/repos:/data/repos:ro
     
       memgraph:
         image: memgraph/memgraph-mage:latest
         ports:
           - "7688:7687"   # offset from the existing graph-code stack on 7687
           - "7444:7444"
         volumes:
           - memgraph_data:/var/lib/memgraph
         command:
           - "--storage-properties-on-edges=true"
         healthcheck:
           test: ["CMD-SHELL", "echo 'RETURN 1;' | mgconsole --host 127.0.0.1 --port 7687 || exit 1"]
           interval: 3s
           timeout: 3s
           retries: 20
           start_period: 15s
     
       qdrant:
         image: qdrant/qdrant:v1.11.3
         ports:
           - "6334:6333"   # offset from the existing graph-code stack on 6333
         volumes:
           - qdrant_data:/qdrant/storage
         healthcheck:
           test: ["CMD-SHELL", "exec 3<>/dev/tcp/127.0.0.1/6333"]
           interval: 3s
           timeout: 3s
           retries: 10
           start_period: 5s
     
     volumes:
       memgraph_data:
       qdrant_data:
     ```
     Why healthchecks: Memgraph needs ~10s to accept Bolt connections after the container starts. With `service_started`, brain-api crashed on first-run boot. `mgconsole` ships inside `memgraph-mage` (verified at `/usr/bin/mgconsole`, version 1.5). Qdrant's healthcheck uses a pure-bash TCP probe so it does not depend on `curl` being present in the image.
     Note: inside the compose network, brain-api talks to Memgraph on `memgraph:7687` and Qdrant on `qdrant:6333`. Port offsets only matter for host-to-container access and avoid collision with the existing `graph-code` stack on 7687 / 6333.
  2. Create `.env.example`:
     ```env
     # Required (no defaults; service will not start if unset)
     BRAIN_BEARER_TOKEN=replace-me-with-a-long-random-string
     GEMINI_API_KEY=
     OPENAI_API_KEY=
     PROJECT_ID=00000000-0000-4000-8000-000000000001
     
     # Host/port defaults (set explicitly inside Docker Compose)
     MEMGRAPH_HOST=127.0.0.1
     MEMGRAPH_PORT=7687
     QDRANT_URL=http://127.0.0.1:6333
     
     # Optional (defaults shown)
     PROJECT_NAME=codi-brain
     PROJECT_REPO_PATH=/data/repos/codi-brain
     ADMIN_USER_ID=00000000-0000-4000-8000-00000000aaaa
     LLM_MODEL=gemini-3-flash
     EMBEDDING_MODEL=text-embedding-3-small
     LOG_LEVEL=INFO
     RATE_LIMIT_PER_SECOND=60
     ```
  3. Append to `.gitignore` (if not already):
     ```bash
     printf ".env\n" >> .gitignore
     ```
  4. Verify the compose file parses:
     ```bash
     cp .env.example .env
     docker compose config > /dev/null
     ```
     Expected: no stderr output, exit 0.
  5. Commit: `git add docker-compose.yaml .env.example .gitignore && git commit -m "chore: add local docker-compose stack (memgraph 7688, qdrant 6334)"`

  **Verification**: `docker compose config --services` — expected: `brain-api memgraph qdrant` (in some order).

### Task 1.3: Pydantic Settings config — test

- [ ] **Files**: `tests/test_config.py`
  **Est**: 3 minutes

  **Steps**:
  1. Create the test:
     ```python
     # tests/test_config.py
     """Settings loads required fields from env and defaults optional ones."""
     import pytest
     
     
     def test_settings_loads_required_fields(monkeypatch):
         from codi_brain.config import Settings
         monkeypatch.setenv("BRAIN_BEARER_TOKEN", "t123")
         monkeypatch.setenv("GEMINI_API_KEY", "g123")
         monkeypatch.setenv("OPENAI_API_KEY", "o123")
         monkeypatch.setenv("MEMGRAPH_HOST", "memgraph")
         monkeypatch.setenv("QDRANT_URL", "http://qdrant:6333")
         monkeypatch.setenv("PROJECT_ID", "p-1")
         monkeypatch.setenv("PROJECT_NAME", "codi-brain")
         monkeypatch.setenv("PROJECT_REPO_PATH", "/data/repos/codi-brain")
     
         s = Settings()
         assert s.brain_bearer_token == "t123"
         assert s.gemini_api_key == "g123"
         assert s.openai_api_key == "o123"
         assert s.memgraph_host == "memgraph"
         assert s.memgraph_port == 7687
         assert s.qdrant_url == "http://qdrant:6333"
         assert s.project_id == "p-1"
         assert s.llm_model == "gemini-3-flash"
         assert s.embedding_model == "text-embedding-3-small"
         assert s.log_level == "INFO"
     
     
     def test_settings_fails_without_required(monkeypatch):
         from codi_brain.config import Settings
         for k in ["BRAIN_BEARER_TOKEN", "GEMINI_API_KEY", "OPENAI_API_KEY", "PROJECT_ID"]:
             monkeypatch.delenv(k, raising=False)
         with pytest.raises(Exception):
             Settings()
     ```
  2. Run: `uv run pytest tests/test_config.py -x` — expected: fail (module doesn't exist).
  3. Commit: `git add tests/test_config.py && git commit -m "test(config): require env-driven Settings"`

  **Verification**: test fails with `ModuleNotFoundError: No module named 'codi_brain.config'`.

### Task 1.4: Pydantic Settings config — implementation

- [ ] **Files**: `src/codi_brain/__init__.py`, `src/codi_brain/config.py`
  **Est**: 4 minutes

  **Steps**:
  1. Create the package:
     ```bash
     mkdir -p src/codi_brain
     touch src/codi_brain/__init__.py
     ```
  2. Add `src/codi_brain/__init__.py`:
     ```python
     """codi-brain — per-project memory and code intelligence service."""
     __version__ = "0.1.0"
     ```
  3. Create `src/codi_brain/config.py`:
     ```python
     """Runtime configuration loaded from environment."""
     from functools import lru_cache
     from pydantic import Field
     from pydantic_settings import BaseSettings, SettingsConfigDict
     
     
     class Settings(BaseSettings):
         """All runtime settings. Required keys raise on startup if missing."""
     
         model_config = SettingsConfigDict(
             env_file=".env",
             env_file_encoding="utf-8",
             case_sensitive=False,
             extra="ignore",
         )
     
         brain_bearer_token: str = Field(..., min_length=8)
         gemini_api_key: str = Field(..., min_length=1)
         openai_api_key: str = Field(..., min_length=1)
     
         memgraph_host: str = Field(default="127.0.0.1")
         memgraph_port: int = Field(default=7687)
         qdrant_url: str = Field(default="http://127.0.0.1:6333")
     
         project_id: str = Field(..., min_length=1)
         project_name: str = Field(default="codi-brain")
         project_repo_path: str = Field(default="/data/repos/codi-brain")
         admin_user_id: str = Field(default="00000000-0000-4000-8000-00000000aaaa")
     
         llm_model: str = Field(default="gemini-3-flash")
         embedding_model: str = Field(default="text-embedding-3-small")
         log_level: str = Field(default="INFO")
         rate_limit_per_second: int = Field(default=60)
     
     
     @lru_cache(maxsize=1)
     def get_settings() -> Settings:
         """Cached accessor — Settings is built once per process.
     
         Tests override via `app.dependency_overrides[get_settings] = ...` or by
         clearing the cache: `get_settings.cache_clear()` after `monkeypatch.setenv`.
         """
         return Settings()
     ```
  4. Run the test:
     ```bash
     uv run pytest tests/test_config.py -x
     ```
     Expected: both tests pass.
  5. Commit: `git add src/codi_brain/__init__.py src/codi_brain/config.py && git commit -m "feat(config): add Pydantic Settings with required keys"`

  **Verification**: `uv run pytest tests/test_config.py -q` — expected: 2 passed.

### Task 1.5: loguru JSON logger + request-id middleware — test

- [ ] **Files**: `tests/test_logging.py`
  **Est**: 3 minutes

  **Steps**:
  1. Create the test:
     ```python
     # tests/test_logging.py
     """Every log line must carry a request_id when one is bound."""
     import json
     from loguru import logger
     
     
     def test_configure_logging_emits_json_with_request_id(tmp_path, monkeypatch):
         from codi_brain.logging import configure_logging
         log_file = tmp_path / "out.log"
         monkeypatch.setenv("LOG_LEVEL", "DEBUG")
         configure_logging(sink=str(log_file))
     
         with logger.contextualize(request_id="req-abc123"):
             logger.info("hello")
     
         content = log_file.read_text().strip().splitlines()[-1]
         payload = json.loads(content)
         assert payload["record"]["extra"]["request_id"] == "req-abc123"
         assert payload["record"]["message"] == "hello"
     ```
  2. Run: `uv run pytest tests/test_logging.py -x` — expected: fail.
  3. Commit: `git add tests/test_logging.py && git commit -m "test(logging): require JSON logs with request_id"`

  **Verification**: test fails with `ModuleNotFoundError`.

### Task 1.6: loguru JSON logger — implementation

- [ ] **Files**: `src/codi_brain/logging.py`
  **Est**: 3 minutes

  **Steps**:
  1. Create `src/codi_brain/logging.py`:
     ```python
     """loguru configuration — JSON sink with request-id binding."""
     import os
     import sys
     from loguru import logger
     
     
     def configure_logging(sink=None, level: str | None = None) -> None:
         """Configure loguru. `sink` defaults to stderr; tests pass a file path."""
         logger.remove()
         level = level or os.getenv("LOG_LEVEL", "INFO")
         target = sink if sink is not None else sys.stderr
         logger.add(
             target,
             level=level,
             serialize=True,
             backtrace=False,
             diagnose=False,
         )
     ```
  2. Run the test:
     ```bash
     uv run pytest tests/test_logging.py -x
     ```
     Expected: pass.
  3. Commit: `git add src/codi_brain/logging.py && git commit -m "feat(logging): JSON loguru sink with request-id context"`

  **Verification**: `uv run pytest tests/test_logging.py -q` — expected: 1 passed.

### Task 1.7: request-id middleware — test

- [ ] **Files**: `tests/test_request_id.py`
  **Est**: 3 minutes

  **Steps**:
  1. Create the test:
     ```python
     # tests/test_request_id.py
     """Every response must have an X-Request-ID header, generated if absent."""
     from fastapi import FastAPI
     from fastapi.testclient import TestClient
     
     
     def test_request_id_is_generated_when_absent():
         from codi_brain.middleware import RequestIdMiddleware
         app = FastAPI()
         app.add_middleware(RequestIdMiddleware)
     
         @app.get("/ping")
         def ping():
             return {"ok": True}
     
         client = TestClient(app)
         r = client.get("/ping")
         assert r.status_code == 200
         assert "x-request-id" in r.headers
         assert len(r.headers["x-request-id"]) >= 8
     
     
     def test_request_id_is_preserved_when_provided():
         from codi_brain.middleware import RequestIdMiddleware
         app = FastAPI()
         app.add_middleware(RequestIdMiddleware)
     
         @app.get("/ping")
         def ping():
             return {"ok": True}
     
         client = TestClient(app)
         r = client.get("/ping", headers={"X-Request-ID": "client-supplied-42"})
         assert r.headers["x-request-id"] == "client-supplied-42"
     ```
  2. Run: `uv run pytest tests/test_request_id.py -x` — expected: fail.
  3. Commit: `git add tests/test_request_id.py && git commit -m "test(middleware): require X-Request-ID header on every response"`

  **Verification**: test fails with `ModuleNotFoundError`.

### Task 1.8: request-id middleware — implementation

- [ ] **Files**: `src/codi_brain/middleware.py`
  **Est**: 3 minutes

  **Steps**:
  1. Create `src/codi_brain/middleware.py`:
     ```python
     """FastAPI middleware for request-scoped context."""
     import uuid
     from loguru import logger
     from starlette.middleware.base import BaseHTTPMiddleware
     from starlette.requests import Request
     from starlette.responses import Response
     
     
     class RequestIdMiddleware(BaseHTTPMiddleware):
         """Attach an X-Request-ID header and bind it into loguru context."""
     
         HEADER = "X-Request-ID"
     
         async def dispatch(self, request: Request, call_next) -> Response:
             rid = request.headers.get(self.HEADER) or f"req-{uuid.uuid4().hex[:12]}"
             with logger.contextualize(request_id=rid):
                 response = await call_next(request)
             response.headers[self.HEADER] = rid
             return response
     ```
  2. Run: `uv run pytest tests/test_request_id.py -x` — expected: both tests pass.
  3. Commit: `git add src/codi_brain/middleware.py && git commit -m "feat(middleware): add RequestIdMiddleware"`

  **Verification**: `uv run pytest tests/test_request_id.py -q` — expected: 2 passed.

### Task 1.9: Bearer auth dependency — test

- [ ] **Files**: `tests/test_auth.py`
  **Est**: 4 minutes

  **Steps**:
  1. Create the test:
     ```python
     # tests/test_auth.py
     """require_bearer validates the token against BRAIN_BEARER_TOKEN via constant-time compare."""
     import pytest
     from fastapi import Depends, FastAPI
     from fastapi.testclient import TestClient
     
     
     @pytest.fixture
     def client(monkeypatch):
         monkeypatch.setenv("BRAIN_BEARER_TOKEN", "secret-token-xyz")
         monkeypatch.setenv("GEMINI_API_KEY", "g")
         monkeypatch.setenv("OPENAI_API_KEY", "o")
         monkeypatch.setenv("PROJECT_ID", "p-1")
         from codi_brain.auth import require_bearer
         app = FastAPI()
     
         @app.get("/protected")
         def protected(auth=Depends(require_bearer)):
             return {"project_id": auth.project_id, "user_id": auth.user_id}
     
         return TestClient(app)
     
     
     def test_accepts_matching_bearer(client):
         r = client.get("/protected", headers={"Authorization": "Bearer secret-token-xyz"})
         assert r.status_code == 200
         body = r.json()
         assert body["project_id"] == "p-1"
         assert body["user_id"]  # hardcoded admin UUID
     
     
     def test_rejects_missing_bearer(client):
         r = client.get("/protected")
         assert r.status_code == 401
     
     
     def test_rejects_wrong_bearer(client):
         r = client.get("/protected", headers={"Authorization": "Bearer wrong"})
         assert r.status_code == 401
     
     
     def test_rejects_wrong_scheme(client):
         r = client.get("/protected", headers={"Authorization": "Basic c2VjcmV0"})
         assert r.status_code == 401
     ```
  2. Run: `uv run pytest tests/test_auth.py -x` — expected: fail.
  3. Commit: `git add tests/test_auth.py && git commit -m "test(auth): require constant-time bearer validation"`

  **Verification**: test fails with `ModuleNotFoundError`.

### Task 1.10: Bearer auth dependency — implementation

- [ ] **Files**: `src/codi_brain/auth.py`
  **Est**: 3 minutes

  **Steps**:
  1. Create `src/codi_brain/auth.py`:
     ```python
     """Bearer-token auth dependency. Phase 1 = single shared token from env."""
     import hmac
     from dataclasses import dataclass
     from fastapi import Depends, Header, HTTPException, status
     from codi_brain.config import Settings, get_settings
     
     
     @dataclass(frozen=True)
     class AuthContext:
         user_id: str
         project_id: str
     
     
     def require_bearer(
         authorization: str | None = Header(default=None),
         settings: Settings = Depends(get_settings),
     ) -> AuthContext:
         """Validate the bearer token with a constant-time compare."""
         if not authorization or not authorization.startswith("Bearer "):
             raise HTTPException(
                 status_code=status.HTTP_401_UNAUTHORIZED,
                 detail="missing bearer",
             )
         supplied = authorization[7:]
         if not hmac.compare_digest(supplied, settings.brain_bearer_token):
             raise HTTPException(
                 status_code=status.HTTP_401_UNAUTHORIZED,
                 detail="invalid bearer",
             )
         return AuthContext(user_id=settings.admin_user_id, project_id=settings.project_id)
     ```
  2. Run: `uv run pytest tests/test_auth.py -x` — expected: 4 passed.
  3. Commit: `git add src/codi_brain/auth.py && git commit -m "feat(auth): bearer-token dependency (constant-time compare)"`

  **Verification**: `uv run pytest tests/test_auth.py -q` — expected: 4 passed.

### Task 1.11: FastAPI app factory + /healthz — test

- [ ] **Files**: `tests/test_health.py`
  **Est**: 3 minutes

  Per spec §5.8, `/healthz` is a single endpoint that inspects dependencies and returns 200 when all are reachable, 503 otherwise. No `/readyz` split.

  **Steps**:
  1. Create the test:
     ```python
     # tests/test_health.py
     """/healthz inspects Memgraph + Qdrant and returns per-check detail."""
     import pytest
     from fastapi.testclient import TestClient
     
     
     @pytest.fixture
     def client(monkeypatch):
         monkeypatch.setenv("BRAIN_BEARER_TOKEN", "test-token-12345")
         monkeypatch.setenv("GEMINI_API_KEY", "g")
         monkeypatch.setenv("OPENAI_API_KEY", "o")
         monkeypatch.setenv("PROJECT_ID", "p")
         monkeypatch.setenv("MEMGRAPH_HOST", "127.0.0.1")
         monkeypatch.setenv("MEMGRAPH_PORT", "1")  # unreachable port on purpose
         monkeypatch.setenv("QDRANT_URL", "http://127.0.0.1:1")  # unreachable
         from codi_brain.config import get_settings
         get_settings.cache_clear()
         from codi_brain.app import create_app
         return TestClient(create_app())
     
     
     def test_healthz_returns_503_when_deps_unreachable(client):
         r = client.get("/healthz")
         assert r.status_code == 503
         body = r.json()
         assert body["status"] == "degraded"
         checks = body["checks"]
         assert set(checks.keys()) >= {"memgraph", "qdrant"}
         assert checks["memgraph"].startswith("fail")
         assert checks["qdrant"].startswith("fail")
     
     
     def test_healthz_returns_200_when_deps_reachable(memgraph_port, qdrant_url, monkeypatch):
         monkeypatch.setenv("BRAIN_BEARER_TOKEN", "test-token-12345")
         monkeypatch.setenv("GEMINI_API_KEY", "g")
         monkeypatch.setenv("OPENAI_API_KEY", "o")
         monkeypatch.setenv("PROJECT_ID", "p")
         monkeypatch.setenv("MEMGRAPH_HOST", "127.0.0.1")
         monkeypatch.setenv("MEMGRAPH_PORT", str(memgraph_port))
         monkeypatch.setenv("QDRANT_URL", qdrant_url)
         from codi_brain.config import get_settings
         get_settings.cache_clear()
         from codi_brain.app import create_app
         c = TestClient(create_app())
         r = c.get("/healthz")
         assert r.status_code == 200, r.text
         body = r.json()
         assert body["status"] == "ok"
         assert body["checks"]["memgraph"] == "ok"
         assert body["checks"]["qdrant"] == "ok"
         assert "version" in body
     ```
  2. Run: `uv run pytest tests/test_health.py -x` — expected: fail.
  3. Commit: `git add tests/test_health.py && git commit -m "test(health): /healthz inspects deps, 200/503"`

  **Verification**: test fails with `ModuleNotFoundError`.

### Task 1.12: FastAPI app factory + /healthz — implementation

- [ ] **Files**: `src/codi_brain/app.py`, `src/codi_brain/routes/__init__.py`, `src/codi_brain/routes/health.py`
  **Est**: 5 minutes

  **Steps**:
  1. Create `src/codi_brain/routes/__init__.py`:
     ```python
     """FastAPI route modules."""
     ```
  2. Create `src/codi_brain/routes/health.py`:
     ```python
     """Health endpoint — inspects Memgraph + Qdrant, returns 200 or 503."""
     import mgclient
     import httpx
     from fastapi import APIRouter, Depends
     from fastapi.responses import JSONResponse
     from codi_brain import __version__
     from codi_brain.config import Settings, get_settings
     
     router = APIRouter()
     
     
     @router.get("/healthz")
     def healthz(settings: Settings = Depends(get_settings)):
         """Liveness + readiness in one endpoint per spec §5.8."""
         checks: dict[str, str] = {}
     
         try:
             conn = mgclient.connect(host=settings.memgraph_host, port=settings.memgraph_port)
             cur = conn.cursor()
             cur.execute("RETURN 1")
             cur.fetchall()
             cur.close()
             conn.close()
             checks["memgraph"] = "ok"
         except Exception as e:
             checks["memgraph"] = f"fail: {type(e).__name__}"
     
         try:
             with httpx.Client(timeout=2.0) as c:
                 r = c.get(f"{settings.qdrant_url}/healthz")
                 r.raise_for_status()
             checks["qdrant"] = "ok"
         except Exception as e:
             checks["qdrant"] = f"fail: {type(e).__name__}"
     
         all_ok = all(v == "ok" for v in checks.values())
         body = {
             "status": "ok" if all_ok else "degraded",
             "checks": checks,
             "version": __version__,
         }
         return JSONResponse(status_code=200 if all_ok else 503, content=body)
     ```
  3. Create `src/codi_brain/app.py`:
     ```python
     """FastAPI application factory."""
     from fastapi import FastAPI
     from codi_brain import __version__
     from codi_brain.logging import configure_logging
     from codi_brain.middleware import RequestIdMiddleware
     from codi_brain.routes import health
     
     
     def create_app() -> FastAPI:
         configure_logging()
         app = FastAPI(
             title="codi-brain",
             version=__version__,
         )
         app.add_middleware(RequestIdMiddleware)
         app.include_router(health.router)
         return app
     
     
     app = create_app()
     ```
  4. Run: `uv run pytest tests/test_health.py -x` — expected: both tests pass.
  5. Commit: `git add src/codi_brain/app.py src/codi_brain/routes && git commit -m "feat(app): FastAPI factory with /healthz dep-check endpoint"`

  **Verification**: `uv run pytest tests/test_health.py -q` — expected: 2 passed.

### Task 1.13: Rate-limit middleware — test

- [ ] **Files**: `tests/test_rate_limit.py`
  **Est**: 3 minutes

  **Steps**:
  1. Create the test:
     ```python
     # tests/test_rate_limit.py
     """Rate limiter caps requests per client per second."""
     import pytest
     from fastapi import FastAPI, Depends
     from fastapi.testclient import TestClient
     
     
     def test_rate_limit_rejects_burst(monkeypatch):
         monkeypatch.setenv("BRAIN_BEARER_TOKEN", "test-token-12345")
         monkeypatch.setenv("GEMINI_API_KEY", "g")
         monkeypatch.setenv("OPENAI_API_KEY", "o")
         monkeypatch.setenv("PROJECT_ID", "p")
         monkeypatch.setenv("RATE_LIMIT_PER_SECOND", "2")
         from codi_brain.rate_limit import install_rate_limit, rate_limit
     
         app = FastAPI()
         install_rate_limit(app)
     
         @app.get("/ping")
         @rate_limit("2/second")
         def ping(request):
             return {"ok": True}
     
         client = TestClient(app)
         results = [client.get("/ping").status_code for _ in range(5)]
         assert 429 in results, f"expected at least one 429 in {results}"
     ```
  2. Run: `uv run pytest tests/test_rate_limit.py -x` — expected: fail.
  3. Commit: `git add tests/test_rate_limit.py && git commit -m "test(rate-limit): 429 on burst"`

  **Verification**: test fails with `ModuleNotFoundError`.

### Task 1.14: Rate-limit middleware — implementation

- [ ] **Files**: `src/codi_brain/rate_limit.py`
  **Est**: 4 minutes

  **Steps**:
  1. Create `src/codi_brain/rate_limit.py`:
     ```python
     """SlowAPI-based per-IP rate limiting.
     
     We do NOT read Settings at module import — doing so breaks tests that
     monkeypatch env at test-run time. Instead, `install_rate_limit` reads
     the current rate limit when the app boots.
     """
     from fastapi import FastAPI
     from slowapi import Limiter, _rate_limit_exceeded_handler
     from slowapi.errors import RateLimitExceeded
     from slowapi.util import get_remote_address
     
     limiter = Limiter(key_func=get_remote_address)
     
     
     def install_rate_limit(app: FastAPI) -> None:
         """Register the limiter and a 429 handler on the app."""
         app.state.limiter = limiter
         app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
     ```
  2. Update `tests/test_rate_limit.py` to use `limiter.limit` directly with the correct Request type hint (fixes the SlowAPI signature requirement — handlers must declare `request: Request`):
     ```python
     # tests/test_rate_limit.py (overwrite what Task 1.13 wrote)
     """Rate limiter caps requests per client per second."""
     from fastapi import FastAPI
     from fastapi.testclient import TestClient
     from starlette.requests import Request
     
     
     def test_rate_limit_rejects_burst():
         from codi_brain.rate_limit import install_rate_limit, limiter
     
         app = FastAPI()
         install_rate_limit(app)
     
         @app.get("/ping")
         @limiter.limit("2/second")
         def ping(request: Request):
             return {"ok": True}
     
         client = TestClient(app)
         results = [client.get("/ping").status_code for _ in range(5)]
         assert 429 in results, f"expected at least one 429 in {results}"
     ```
  3. Run: `uv run pytest tests/test_rate_limit.py -x` — expected: pass.
  4. Commit: `git add src/codi_brain/rate_limit.py tests/test_rate_limit.py && git commit -m "feat(rate-limit): per-IP rate limiting via SlowAPI"`

  **Verification**: `uv run pytest tests/test_rate_limit.py -q` — expected: 1 passed.

### Task 1.15: Memgraph schema migrations — test

- [ ] **Files**: `tests/test_memgraph_migrations.py`
  **Est**: 3 minutes

  **Steps**:
  1. **No-op — skip the plan's original conftest step.** The `memgraph_port` and `memgraph_client` fixtures are already in `tests/conftest.py` from Week 0 (pinned to `memgraph/memgraph-mage:latest`, not the non-existent `2.16.1`). Do NOT overwrite `tests/conftest.py`. Only add the new test file below.
  2. Create the migration test:
     ```python
     # tests/test_memgraph_migrations.py
     """Migrations create the constraints required for Phase 1."""
     
     def test_migrations_create_phase_1_constraints(memgraph_client):
         from codi_brain.schema.memgraph import apply_constraints
         apply_constraints(memgraph_client)
     
         cur = memgraph_client.cursor()
         cur.execute("SHOW CONSTRAINT INFO")
         rows = cur.fetchall()
         cur.close()
     
         # Expect at least one constraint per label, each on qualified_name or path
         labels_with_uniq = {r[1] for r in rows}
         for label in ("Function", "Class", "Method", "Module"):
             assert label in labels_with_uniq, f"missing uniqueness on {label}: {labels_with_uniq}"
     ```
  3. Run: `uv run pytest tests/test_memgraph_migrations.py -x` — expected: fail.
  4. Commit: `git add tests/test_memgraph_migrations.py && git commit -m "test(schema): require Phase 1 uniqueness constraints"`

  **Verification**: test fails with `ModuleNotFoundError`.

### Task 1.16: Memgraph schema migrations — implementation

- [ ] **Files**: `src/codi_brain/schema/__init__.py`, `src/codi_brain/schema/memgraph.py`
  **Est**: 4 minutes

  **Steps**:
  1. Create the package:
     ```bash
     mkdir -p src/codi_brain/schema
     touch src/codi_brain/schema/__init__.py
     ```
  2. Create `src/codi_brain/schema/memgraph.py`:
     ```python
     """Memgraph schema migrations — Phase 1 constraints.
     
     Phase 1 creates only code-node constraints. User, UserKey, and Project
     nodes do not exist in Phase 1 (identity is env-hardcoded; see spec §4.3).
     """
     import mgclient
     
     PHASE_1_CONSTRAINTS: list[str] = [
         "CREATE CONSTRAINT ON (n:Function) ASSERT n.qualified_name IS UNIQUE",
         "CREATE CONSTRAINT ON (n:Class) ASSERT n.qualified_name IS UNIQUE",
         "CREATE CONSTRAINT ON (n:Method) ASSERT n.qualified_name IS UNIQUE",
         "CREATE CONSTRAINT ON (n:Module) ASSERT n.qualified_name IS UNIQUE",
         "CREATE CONSTRAINT ON (n:Interface) ASSERT n.qualified_name IS UNIQUE",
         "CREATE CONSTRAINT ON (n:Type) ASSERT n.qualified_name IS UNIQUE",
         "CREATE CONSTRAINT ON (n:Enum) ASSERT n.qualified_name IS UNIQUE",
         "CREATE CONSTRAINT ON (n:Union) ASSERT n.qualified_name IS UNIQUE",
         "CREATE CONSTRAINT ON (n:Package) ASSERT n.qualified_name IS UNIQUE",
         "CREATE CONSTRAINT ON (n:ExternalPackage) ASSERT n.qualified_name IS UNIQUE",
         "CREATE CONSTRAINT ON (n:File) ASSERT n.path IS UNIQUE",
         "CREATE CONSTRAINT ON (n:Folder) ASSERT n.path IS UNIQUE",
     ]
     
     
     def apply_constraints(client: mgclient.Connection) -> None:
         """Apply every Phase 1 constraint, idempotent where Memgraph allows."""
         cur = client.cursor()
         for stmt in PHASE_1_CONSTRAINTS:
             try:
                 cur.execute(stmt)
             except mgclient.DatabaseError as e:
                 # Memgraph raises if the constraint already exists — tolerate.
                 msg = str(e).lower()
                 if "exists" not in msg and "already" not in msg:
                     raise
         cur.close()
     ```
  3. Run: `uv run pytest tests/test_memgraph_migrations.py -x` — expected: pass.
  4. Commit: `git add src/codi_brain/schema && git commit -m "feat(schema): apply Phase 1 Memgraph uniqueness constraints"`

  **Verification**: `uv run pytest tests/test_memgraph_migrations.py -q` — expected: 1 passed.

### Task 1.17: Qdrant collection setup — test

- [ ] **Files**: `tests/test_qdrant_setup.py`
  **Est**: 3 minutes

  **Steps**:
  1. **No-op — skip the plan's original conftest step.** The `qdrant_url` fixture is already in `tests/conftest.py` from Week 0. Do NOT append to `tests/conftest.py`. Only add the new test file below.
  2. Create the Qdrant test:
     ```python
     # tests/test_qdrant_setup.py
     """Ensure the code_embeddings collection is created with the right dims."""
     from qdrant_client import QdrantClient
     
     
     def test_ensure_collection_creates_code_embeddings(qdrant_url):
         from codi_brain.schema.qdrant import ensure_collections
         client = QdrantClient(url=qdrant_url)
         ensure_collections(client, vector_size=1536)
     
         collections = {c.name for c in client.get_collections().collections}
         assert "code_embeddings" in collections
     
         info = client.get_collection("code_embeddings")
         assert info.config.params.vectors.size == 1536
     ```
  3. Run: `uv run pytest tests/test_qdrant_setup.py -x` — expected: fail.
  4. Commit: `git add tests/test_qdrant_setup.py && git commit -m "test(schema): require code_embeddings collection with 1536 dims"`

  **Verification**: test fails with `ModuleNotFoundError`.

### Task 1.18: Qdrant collection setup — implementation

- [ ] **Files**: `src/codi_brain/schema/qdrant.py`
  **Est**: 3 minutes

  **Steps**:
  1. Create `src/codi_brain/schema/qdrant.py`:
     ```python
     """Qdrant collection setup — Phase 1 uses code_embeddings only."""
     from qdrant_client import QdrantClient
     from qdrant_client.models import Distance, VectorParams
     
     CODE_COLLECTION = "code_embeddings"
     
     
     def ensure_collections(client: QdrantClient, vector_size: int = 1536) -> None:
         """Create the collections required for Phase 1 if they do not exist."""
         names = {c.name for c in client.get_collections().collections}
         if CODE_COLLECTION not in names:
             client.create_collection(
                 collection_name=CODE_COLLECTION,
                 vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
             )
     ```
  2. Run: `uv run pytest tests/test_qdrant_setup.py -x` — expected: pass.
  3. Commit: `git add src/codi_brain/schema/qdrant.py && git commit -m "feat(schema): ensure code_embeddings Qdrant collection exists"`

  **Verification**: `uv run pytest tests/test_qdrant_setup.py -q` — expected: 1 passed.

### Task 1.19: Migrate CLI (`codi-brain migrate`) — test

- [ ] **Files**: `tests/test_cli_migrate.py`
  **Est**: 3 minutes

  **Steps**:
  1. Create the test:
     ```python
     # tests/test_cli_migrate.py
     """`codi_brain.cli migrate` must apply Memgraph constraints and Qdrant collections."""
     from typer.testing import CliRunner
     
     
     def test_migrate_runs_both_stores(memgraph_port, qdrant_url, monkeypatch):
         monkeypatch.setenv("BRAIN_BEARER_TOKEN", "test-token-12345")
         monkeypatch.setenv("GEMINI_API_KEY", "g")
         monkeypatch.setenv("OPENAI_API_KEY", "o")
         monkeypatch.setenv("PROJECT_ID", "p")
         monkeypatch.setenv("MEMGRAPH_HOST", "127.0.0.1")
         monkeypatch.setenv("MEMGRAPH_PORT", str(memgraph_port))
         monkeypatch.setenv("QDRANT_URL", qdrant_url)
     
         from codi_brain.cli import app
         runner = CliRunner()
         r = runner.invoke(app, ["migrate"])
         assert r.exit_code == 0, r.stdout
         assert "memgraph constraints applied" in r.stdout.lower()
         assert "qdrant collections ensured" in r.stdout.lower()
     ```
  2. Run: `uv run pytest tests/test_cli_migrate.py -x` — expected: fail.
  3. Commit: `git add tests/test_cli_migrate.py && git commit -m "test(cli): require migrate to run both stores"`

  **Verification**: test fails with `ModuleNotFoundError`.

### Task 1.20: Migrate CLI — implementation

- [ ] **Files**: `src/codi_brain/cli.py`
  **Est**: 3 minutes

  **Steps**:
  1. Create `src/codi_brain/cli.py`:
     ```python
     """codi-brain CLI — runtime operational commands."""
     import typer
     import mgclient
     from qdrant_client import QdrantClient
     from codi_brain.config import Settings
     from codi_brain.schema.memgraph import apply_constraints
     from codi_brain.schema.qdrant import ensure_collections
     
     app = typer.Typer(help="codi-brain operational CLI")
     
     
     @app.command()
     def migrate() -> None:
         """Apply Memgraph constraints and ensure Qdrant collections exist."""
         settings = Settings()
         mg = mgclient.connect(host=settings.memgraph_host, port=settings.memgraph_port)
         mg.autocommit = True
         apply_constraints(mg)
         mg.close()
         typer.echo("memgraph constraints applied")
     
         q = QdrantClient(url=settings.qdrant_url)
         ensure_collections(q)
         typer.echo("qdrant collections ensured")
     ```
  2. Extend `pyproject.toml` with a script entry (add at the end of `[project]`):
     ```toml
     [project.scripts]
     codi-brain = "codi_brain.cli:app"
     ```
  3. Re-sync: `uv sync` — expected: the `codi-brain` entry point is installed into the venv.
  4. Run the test: `uv run pytest tests/test_cli_migrate.py -x` — expected: pass.
  5. Commit: `git add src/codi_brain/cli.py pyproject.toml uv.lock && git commit -m "feat(cli): add 'codi-brain migrate' command"`

  **Verification**: `uv run pytest tests/test_cli_migrate.py -q` — expected: 1 passed.

### Task 1.21: `code_graph` wrapper — test

- [ ] **Files**: `tests/test_code_graph_adapter.py`
  **Est**: 3 minutes

  **Steps**:
  1. Create the test:
     ```python
     # tests/test_code_graph_adapter.py
     """The thin adapter exposes ingest, search, snippet with explicit kwargs."""
     import inspect
     from codi_brain.integrations import code_graph as adapter
     
     
     def test_adapter_exposes_expected_callables():
         assert callable(adapter.ingest_repo)
         assert callable(adapter.search_code)
         assert callable(adapter.get_snippet)
     
     
     def test_ingest_repo_signature_accepts_project_id_and_path():
         sig = inspect.signature(adapter.ingest_repo)
         params = set(sig.parameters)
         assert "project_id" in params
         assert "repo_path" in params
     ```
  2. Run: `uv run pytest tests/test_code_graph_adapter.py -x` — expected: fail.
  3. Commit: `git add tests/test_code_graph_adapter.py && git commit -m "test(adapter): require ingest/search/snippet signatures"`

  **Verification**: test fails with `ModuleNotFoundError`.

### Task 1.22: `code_graph` wrapper — implementation

- [ ] **Files**: `src/codi_brain/integrations/__init__.py`, `src/codi_brain/integrations/code_graph.py`
  **Est**: 5 minutes

  **Steps**:
  1. Create the package:
     ```bash
     mkdir -p src/codi_brain/integrations
     touch src/codi_brain/integrations/__init__.py
     ```
  2. Create `src/codi_brain/integrations/code_graph.py`:
     ```python
     """Thin adapter over the absorbed code_graph module."""
     import time
     from dataclasses import dataclass
     from pathlib import Path
     from code_graph.graph_updater import GraphUpdater
     from code_graph.services.graph_service import MemgraphIngestor
     from code_graph.parser_loader import load_parsers
     
     
     @dataclass
     class IngestResult:
         project_id: str
         nodes_added: int
         nodes_updated: int
         nodes_deleted: int
         qualified_names_count: int
         duration_seconds: float
     
     
     def ingest_repo(
         *,
         project_id: str,
         repo_path: str,
         memgraph_host: str,
         memgraph_port: int,
     ) -> IngestResult:
         """Ingest the repo into Memgraph with the given project_id.
     
         Week 1 scope: graph-ingest only — no embeddings. Reports `nodes_added`
         as the delta of project-scoped nodes before vs. after, and
         `qualified_names_count` as the current total. `nodes_updated` and
         `nodes_deleted` are `0` in Week 1; real diff accounting arrives in
         Week 2 with the `force` re-ingest path.
         """
         t0 = time.monotonic()
         parsers, queries = load_parsers()
         with MemgraphIngestor(host=memgraph_host, port=memgraph_port) as ingestor:
             before_nodes = _count_project_nodes(ingestor, project_id)
             updater = GraphUpdater(
                 ingestor=ingestor,
                 repo_path=Path(repo_path),
                 parsers=parsers,
                 queries=queries,
                 project_id=project_id,
             )
             # Week 1 is graph-only; embeddings require OpenAI and are out of scope.
             updater.run(incremental_embeddings=False, resume_embeddings=False)
             after_nodes = _count_project_nodes(ingestor, project_id)
             qn_count = _count_project_qualified_names(ingestor, project_id)
     
         return IngestResult(
             project_id=project_id,
             nodes_added=max(after_nodes - before_nodes, 0),
             nodes_updated=0,
             nodes_deleted=0,
             qualified_names_count=qn_count,
             duration_seconds=round(time.monotonic() - t0, 3),
         )
     
     
     def _count_project_qualified_names(ingestor: MemgraphIngestor, project_id: str) -> int:
         cur = ingestor.conn.cursor()
         cur.execute(
             "MATCH (n) WHERE n.project_id = $pid AND n.qualified_name IS NOT NULL "
             "RETURN count(DISTINCT n.qualified_name) AS c",
             {"pid": project_id},
         )
         rows = cur.fetchall()
         cur.close()
         return int(rows[0][0]) if rows else 0
     
     
     def _count_project_nodes(ingestor: MemgraphIngestor, project_id: str) -> int:
         cur = ingestor.conn.cursor()
         cur.execute(
             "MATCH (n) WHERE n.project_id = $pid RETURN count(n) AS c",
             {"pid": project_id},
         )
         rows = cur.fetchall()
         cur.close()
         return int(rows[0][0]) if rows else 0
     
     
     def search_code(
         *,
         project_id: str,
         query: str,
         memgraph_host: str,
         memgraph_port: int,
         limit: int = 10,
     ) -> list[dict]:
         """Simple Cypher contains-match filtered by project_id. Phase 1 baseline."""
         with MemgraphIngestor(host=memgraph_host, port=memgraph_port) as ingestor:
             cur = ingestor.conn.cursor()
             cypher = (
                 "MATCH (n) WHERE n.project_id = $pid AND "
                 "(n.qualified_name CONTAINS $q OR n.name CONTAINS $q) "
                 "RETURN labels(n) AS labels, n.qualified_name AS qn, n.path AS path, "
                 "n.start_line AS sl, n.end_line AS el, n.docstring AS doc "
                 "LIMIT $lim"
             )
             cur.execute(cypher, {"pid": project_id, "q": query, "lim": limit})
             rows = cur.fetchall()
             cur.close()
     
         results: list[dict] = []
         for labels, qn, path, sl, el, doc in rows:
             if not qn:
                 continue
             results.append({
                 "qualified_name": qn,
                 "label": (labels[0] if labels else "Node"),
                 "path": path,
                 "start_line": sl,
                 "end_line": el,
                 "score": 1.0,
                 "docstring": doc,
             })
         return results
     
     
     def get_snippet(
         *,
         project_id: str,
         qualified_name: str,
         memgraph_host: str,
         memgraph_port: int,
     ) -> dict | None:
         """Return {path, start_line, end_line, source, docstring} for a qualified name."""
         with MemgraphIngestor(host=memgraph_host, port=memgraph_port) as ingestor:
             cur = ingestor.conn.cursor()
             cur.execute(
                 "MATCH (n) WHERE n.project_id = $pid AND n.qualified_name = $qn "
                 "RETURN n.path AS path, n.start_line AS sl, n.end_line AS el, "
                 "n.docstring AS doc LIMIT 1",
                 {"pid": project_id, "qn": qualified_name},
             )
             rows = cur.fetchall()
             cur.close()
     
         if not rows:
             return None
         path, sl, el, doc = rows[0]
         source = _read_source_range(path, sl, el) if path and sl and el else ""
         return {
             "qualified_name": qualified_name,
             "path": path,
             "start_line": sl,
             "end_line": el,
             "source": source,
             "docstring": doc,
         }
     
     
     def _read_source_range(path: str, start_line: int, end_line: int) -> str:
         try:
             with open(path, "r", encoding="utf-8", errors="replace") as f:
                 lines = f.readlines()
         except (FileNotFoundError, IsADirectoryError):
             return ""
         return "".join(lines[start_line - 1 : end_line])
     ```
  3. Run: `uv run pytest tests/test_code_graph_adapter.py -x` — expected: pass.
  4. Commit: `git add src/codi_brain/integrations && git commit -m "feat(integrations): code_graph adapter with explicit args"`

  **Verification**: `uv run pytest tests/test_code_graph_adapter.py -q` — expected: 2 passed.

### Task 1.23: `POST /ingest/repo` — test

- [ ] **Files**: `tests/test_ingest_endpoint.py`
  **Est**: 5 minutes

  **Steps**:
  1. Create the test:
     ```python
     # tests/test_ingest_endpoint.py
     """Hitting POST /ingest/repo ingests the repo and returns counts."""
     import os
     import shutil
     import subprocess
     import pytest
     from fastapi.testclient import TestClient
     
     
     @pytest.fixture
     def tiny_repo(tmp_path):
         repo = tmp_path / "tiny"
         repo.mkdir()
         (repo / "module_a.py").write_text(
             "def hello_world():\n"
             "    '''say hello'''\n"
             "    return 'hello'\n"
         )
         subprocess.run(["git", "init", "-q"], cwd=repo, check=True)
         subprocess.run(["git", "add", "-A"], cwd=repo, check=True)
         subprocess.run(
             ["git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "init"],
             cwd=repo, check=True,
         )
         return repo
     
     
     def test_ingest_repo_returns_positive_node_count(
         memgraph_port, qdrant_url, tiny_repo, monkeypatch
     ):
         monkeypatch.setenv("BRAIN_BEARER_TOKEN", "test-token-12345")
         monkeypatch.setenv("GEMINI_API_KEY", "g")
         monkeypatch.setenv("OPENAI_API_KEY", "o")
         monkeypatch.setenv("PROJECT_ID", "proj-tiny")
         monkeypatch.setenv("MEMGRAPH_HOST", "127.0.0.1")
         monkeypatch.setenv("MEMGRAPH_PORT", str(memgraph_port))
         monkeypatch.setenv("QDRANT_URL", qdrant_url)
         monkeypatch.setenv("PROJECT_REPO_PATH", str(tiny_repo))
     
         from codi_brain.config import get_settings
         get_settings.cache_clear()
         from codi_brain.cli import app as cli_app
         from typer.testing import CliRunner
         CliRunner().invoke(cli_app, ["migrate"])
     
         from codi_brain.config import get_settings
         get_settings.cache_clear()
         from codi_brain.app import create_app
         client = TestClient(create_app())
         r = client.post(
             "/ingest/repo",
             headers={"Authorization": "Bearer test-token-12345"},
             json={"path": str(tiny_repo)},
         )
         assert r.status_code == 200, r.text
         body = r.json()
         assert body["project_id"] == "proj-tiny"
         assert body["nodes_added"] >= 1, f"expected nodes, got {body}"
         assert body["qualified_names_count"] >= 1
         assert body["duration_seconds"] >= 0
     
         # The invariant from spec §3.3: every node carries project_id.
         import mgclient
         mg = mgclient.connect(host="127.0.0.1", port=memgraph_port)
         cur = mg.cursor()
         cur.execute(
             "MATCH (n) WHERE n.project_id = $pid RETURN count(n) AS c",
             {"pid": "proj-tiny"},
         )
         count = int(cur.fetchall()[0][0])
         cur.close()
         mg.close()
         assert count >= 1, f"no nodes tagged with project_id='proj-tiny' after ingest"
     ```
  2. Run: `uv run pytest tests/test_ingest_endpoint.py -x` — expected: fail (no route).
  3. Commit: `git add tests/test_ingest_endpoint.py && git commit -m "test(ingest): require POST /ingest/repo to return counts"`

  **Verification**: test fails with 404 or `ModuleNotFoundError`.

### Task 1.24: `POST /ingest/repo` — implementation

- [ ] **Files**: `src/codi_brain/routes/ingest.py`, `src/codi_brain/app.py`
  **Est**: 4 minutes

  **Steps**:
  1. Create `src/codi_brain/routes/ingest.py`:
     ```python
     """POST /ingest/repo — trigger an incremental ingest."""
     from fastapi import APIRouter, Depends
     from pydantic import BaseModel
     from codi_brain.auth import AuthContext, require_bearer
     from codi_brain.config import Settings, get_settings
     from codi_brain.integrations import code_graph
     
     router = APIRouter()
     
     
     class IngestBody(BaseModel):
         path: str | None = None
         force: bool = False
     
     
     class IngestResponse(BaseModel):
         project_id: str
         nodes_added: int
         nodes_updated: int
         nodes_deleted: int
         qualified_names_count: int
         duration_seconds: float
     
     
     @router.post("/ingest/repo", response_model=IngestResponse)
     def ingest_repo(
         body: IngestBody,
         auth: AuthContext = Depends(require_bearer),
         settings: Settings = Depends(get_settings),
     ) -> IngestResponse:
         repo_path = body.path or settings.project_repo_path
         result = code_graph.ingest_repo(
             project_id=auth.project_id,
             repo_path=repo_path,
             memgraph_host=settings.memgraph_host,
             memgraph_port=settings.memgraph_port,
         )
         return IngestResponse(
             project_id=result.project_id,
             nodes_added=result.nodes_added,
             nodes_updated=result.nodes_updated,
             nodes_deleted=result.nodes_deleted,
             qualified_names_count=result.qualified_names_count,
             duration_seconds=result.duration_seconds,
         )
     ```
  2. Wire the router into `src/codi_brain/app.py` (edit):
     ```python
     """FastAPI application factory."""
     from fastapi import FastAPI
     from codi_brain import __version__
     from codi_brain.logging import configure_logging
     from codi_brain.middleware import RequestIdMiddleware
     from codi_brain.routes import health, ingest
     
     
     def create_app() -> FastAPI:
         configure_logging()
         app = FastAPI(
             title="codi-brain",
             version=__version__,
         )
         app.add_middleware(RequestIdMiddleware)
         app.include_router(health.router)
         app.include_router(ingest.router)
         return app
     
     
     app = create_app()
     ```
  3. Run: `uv run pytest tests/test_ingest_endpoint.py -x --tb=short` — expected: pass (may be slow on first run).
  4. Commit: `git add src/codi_brain/routes/ingest.py src/codi_brain/app.py && git commit -m "feat(ingest): POST /ingest/repo wrapping code_graph.ingest_repo"`

  **Verification**: `uv run pytest tests/test_ingest_endpoint.py -q` — expected: 1 passed.

### Task 1.25: `GET /code/search` — test

- [ ] **Files**: `tests/test_code_search.py`
  **Est**: 4 minutes

  **Steps**:
  1. Create the test:
     ```python
     # tests/test_code_search.py
     """After ingest, /code/search returns matches filtered by project_id."""
     import subprocess
     import pytest
     from fastapi.testclient import TestClient
     
     
     @pytest.fixture
     def tiny_repo(tmp_path):
         repo = tmp_path / "search"
         repo.mkdir()
         (repo / "auth.py").write_text(
             "def verify_token(token):\n"
             "    '''verify a bearer token'''\n"
             "    return True\n"
         )
         subprocess.run(["git", "init", "-q"], cwd=repo, check=True)
         subprocess.run(["git", "add", "-A"], cwd=repo, check=True)
         subprocess.run(
             ["git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "init"],
             cwd=repo, check=True,
         )
         return repo
     
     
     def test_search_returns_hit_after_ingest(memgraph_port, qdrant_url, tiny_repo, monkeypatch):
         monkeypatch.setenv("BRAIN_BEARER_TOKEN", "test-token-12345")
         monkeypatch.setenv("GEMINI_API_KEY", "g")
         monkeypatch.setenv("OPENAI_API_KEY", "o")
         monkeypatch.setenv("PROJECT_ID", "proj-search")
         monkeypatch.setenv("MEMGRAPH_HOST", "127.0.0.1")
         monkeypatch.setenv("MEMGRAPH_PORT", str(memgraph_port))
         monkeypatch.setenv("QDRANT_URL", qdrant_url)
         monkeypatch.setenv("PROJECT_REPO_PATH", str(tiny_repo))
     
         from codi_brain.cli import app as cli_app
         from typer.testing import CliRunner
         CliRunner().invoke(cli_app, ["migrate"])
     
         from codi_brain.app import create_app
         client = TestClient(create_app())
     
         r = client.post(
             "/ingest/repo",
             headers={"Authorization": "Bearer test-token-12345"},
             json={},
         )
         assert r.status_code == 200, r.text
     
         r = client.get(
             "/code/search",
             params={"q": "verify_token", "limit": 5},
             headers={"Authorization": "Bearer test-token-12345"},
         )
         assert r.status_code == 200, r.text
         body = r.json()
         assert body["results"], f"expected non-empty results: {body}"
         assert any("verify_token" in hit["qualified_name"] for hit in body["results"])
     ```
  2. Run: `uv run pytest tests/test_code_search.py -x --tb=short` — expected: fail (no route).
  3. Commit: `git add tests/test_code_search.py && git commit -m "test(search): /code/search returns hit after ingest"`

  **Verification**: test fails with 404.

### Task 1.26: `GET /code/search` + `GET /code/snippet` — implementation

- [ ] **Files**: `src/codi_brain/routes/code.py`, `src/codi_brain/app.py`
  **Est**: 5 minutes

  **Steps**:
  1. Create `src/codi_brain/routes/code.py`:
     ```python
     """Code endpoints: /code/search and /code/snippet."""
     from fastapi import APIRouter, Depends, HTTPException, Query
     from pydantic import BaseModel
     from codi_brain.auth import AuthContext, require_bearer
     from codi_brain.config import Settings, get_settings
     from codi_brain.integrations import code_graph
     
     router = APIRouter()
     
     
     class SearchHit(BaseModel):
         qualified_name: str
         label: str
         path: str | None = None
         start_line: int | None = None
         end_line: int | None = None
         score: float
         docstring: str | None = None
     
     
     class SearchResponse(BaseModel):
         results: list[SearchHit]
     
     
     class Snippet(BaseModel):
         qualified_name: str
         path: str | None
         start_line: int | None
         end_line: int | None
         source: str
         docstring: str | None
     
     
     @router.get("/code/search", response_model=SearchResponse)
     def code_search(
         q: str = Query(..., min_length=1),
         limit: int = Query(10, ge=1, le=50),
         auth: AuthContext = Depends(require_bearer),
         settings: Settings = Depends(get_settings),
     ) -> SearchResponse:
         hits = code_graph.search_code(
             project_id=auth.project_id,
             query=q,
             memgraph_host=settings.memgraph_host,
             memgraph_port=settings.memgraph_port,
             limit=limit,
         )
         return SearchResponse(results=[SearchHit(**h) for h in hits])
     
     
     @router.get("/code/snippet", response_model=Snippet)
     def code_snippet(
         qualified_name: str = Query(..., min_length=1),
         auth: AuthContext = Depends(require_bearer),
         settings: Settings = Depends(get_settings),
     ) -> Snippet:
         hit = code_graph.get_snippet(
             project_id=auth.project_id,
             qualified_name=qualified_name,
             memgraph_host=settings.memgraph_host,
             memgraph_port=settings.memgraph_port,
         )
         if hit is None:
             raise HTTPException(status_code=404, detail="snippet not found")
         return Snippet(**hit)
     ```
  2. Wire the router into `src/codi_brain/app.py` (edit — add `code` to the imports and `include_router` call). Full updated file:
     ```python
     """FastAPI application factory."""
     from fastapi import FastAPI
     from codi_brain import __version__
     from codi_brain.logging import configure_logging
     from codi_brain.middleware import RequestIdMiddleware
     from codi_brain.routes import code, health, ingest
     
     
     def create_app() -> FastAPI:
         configure_logging()
         app = FastAPI(title="codi-brain", version=__version__)
         app.add_middleware(RequestIdMiddleware)
         app.include_router(health.router)
         app.include_router(ingest.router)
         app.include_router(code.router)
         return app
     
     
     app = create_app()
     ```
  3. Run: `uv run pytest tests/test_code_search.py -x --tb=short` — expected: pass.
  4. Commit: `git add src/codi_brain/routes/code.py src/codi_brain/app.py && git commit -m "feat(code): /code/search and /code/snippet endpoints"`

  **Verification**: `uv run pytest tests/test_code_search.py -q` — expected: 1 passed.

### Task 1.27: Full test suite green

- [ ] **Files**: none modified
  **Est**: 3 minutes

  **Steps**:
  1. Run the full test suite:
     ```bash
     uv run pytest -q --tb=short
     ```
     Expected: all tests pass. If there are failures, fix them in place (likely import cycles, fixture scope issues).
  2. Run lint and type check:
     ```bash
     uv run ruff check src tests
     uv run mypy src/codi_brain || true   # advisory for Week 1; hard-fail gate arrives in Week 2
     ```
     Fix every ruff finding before proceeding.
  3. If any fixes were made, commit: `git add -A && git commit -m "chore: fix lint in Week 1 deliverables"`

  **Verification**: `uv run pytest -q` — expected: all green.

### Task 1.28: Week 1 smoke script — `docker compose up` + real ingest

- [ ] **Files**: `scripts/week1_smoke.sh`
  **Est**: 5 minutes

  **Steps**:
  1. Create `scripts/week1_smoke.sh`:
     ```bash
     #!/usr/bin/env bash
     # scripts/week1_smoke.sh — Week 1 ship criterion verification.
     set -euo pipefail
     
     SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
     REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
     cd "$REPO_ROOT"
     
     if [ ! -f .env ]; then
       echo "1. Creating .env from .env.example..."
       cp .env.example .env
       # Replace placeholder token with a random one for local testing
       python3 -c "import secrets; open('.env', 'a').write(f'\nBRAIN_BEARER_TOKEN={secrets.token_urlsafe(24)}\n')"
     fi
     
     # Load bearer for the curl tests
     BRAIN_BEARER_TOKEN=$(grep ^BRAIN_BEARER_TOKEN .env | cut -d= -f2)
     
     echo "2. docker compose up -d..."
     docker compose up -d --build
     
     echo "3. Waiting for /healthz..."
     for i in $(seq 1 30); do
       if curl -sf http://127.0.0.1:8000/healthz >/dev/null; then break; fi
       sleep 2
     done
     curl -sf http://127.0.0.1:8000/healthz | python3 -m json.tool
     
     echo "4. Running migrate..."
     docker compose exec -T brain-api codi-brain migrate
     
     echo "5. Mounting codi-brain repo into brain-api for ingest..."
     mkdir -p data/repos
     rsync -a --delete --exclude '.venv' --exclude 'data' --exclude '.git' . data/repos/codi-brain/
     
     echo "6. POST /ingest/repo..."
     curl -sf -X POST http://127.0.0.1:8000/ingest/repo \
       -H "Authorization: Bearer $BRAIN_BEARER_TOKEN" \
       -H "Content-Type: application/json" \
       -d '{"path": "/data/repos/codi-brain"}' | python3 -m json.tool
     
     echo "7. GET /code/search?q=app..."
     curl -sf "http://127.0.0.1:8000/code/search?q=app&limit=3" \
       -H "Authorization: Bearer $BRAIN_BEARER_TOKEN" | python3 -m json.tool
     
     echo "Week 1 smoke: OK"
     ```
  2. Run: `chmod +x scripts/week1_smoke.sh && bash scripts/week1_smoke.sh`
     Expected: prints `Week 1 smoke: OK` at the end. The `/code/search` response includes at least one hit with a qualified name like `codi_brain.app` or similar.
  3. Tear down the stack when done: `docker compose down -v`
  4. Commit: `git add scripts/week1_smoke.sh && git commit -m "chore: week 1 smoke script — docker compose + real ingest"`

  **Verification**: `bash scripts/week1_smoke.sh` — expected: prints `Week 1 smoke: OK`.

---

## Ship criteria recap

**Week 0 ship criterion (after Task 0.12):**
- `uv sync` green from a fresh clone.
- `from code_graph.graph_updater import GraphUpdater` works.
- No `git+...` dependency in `pyproject.toml`.
- `uv run pytest tests/test_code_graph/` all green.

**Week 1 ship criterion (after Task 1.28):**
- `docker compose up -d --build` starts the stack.
- `GET /healthz` returns 200.
- `POST /ingest/repo` on the codi-brain repo itself returns `nodes_added >= 1`.
- `GET /code/search?q=app` returns at least one result.
- Full `uv run pytest` suite green.

---

## Out of scope for this plan (Week 2 and Week 3)

**Week 2** (next plan doc): `Note` node schema, `POST /notes`, `GET /notes/search`, `GET /hot`, `PUT /hot`, `VaultReconciler`, `.obsidian/` template, frontmatter rendering, wikilink resolution, git commit + push, three skills in Codi source (`brain-query`, `brain-save`, `brain-hot`), Mac-local `brain-vault` skill, `brain-hooks.sh`, `brain-usage.md` rule, `codi add brain` CLI, end-to-end scenario C locally.

**Week 3** (next next plan doc): production Dockerfile polishing, `rl3-infra-vps` patches (`client.yaml`, `brain_api` env_builder, backup crons), GitHub vault repo + deploy key, Coolify provisioning, DNS + TLS, scenario C against `https://brain.rl3.dev`, weekly restore drill workflow.

**Decisions to resolve before Week 2 starts:**
- `codi-brain` repo visibility (public or private; leaning public).
- Vault Git remote for Phase 1A (throwaway local bare repo or real GitHub; leaning real GitHub).

---

## Execution

After this plan is approved by the user, hand off to **codi-plan-execution**. That skill asks the user to pick **INLINE** (sequential, watch-along) or **SUBAGENT** (fresh subagent per task with two-stage review) mode.

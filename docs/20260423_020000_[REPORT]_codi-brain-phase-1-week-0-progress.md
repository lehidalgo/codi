# Codi Brain — Phase 1 Week 0 Progress Report and Handoff

- **Date**: 2026-04-23 02:00
- **Document**: 20260423_020000_[REPORT]_codi-brain-phase-1-week-0-progress.md
- **Category**: REPORT
- **Purpose**: Capture the state of Phase 1 Week 0 execution at the mid-point so a fresh session can resume without re-reading the full prior conversation.

## TL;DR

- **Week 0 is 9/12 shipped, all committed on `main` in `~/projects/codi-brain`.**
- **Test suite**: 766 passed, 12 skipped, 2 xfailed (upstream-broken, documented).
- **One expected-red test** sits uncommitted-ly-green: `test_ingestor_project_id.py` is the TDD-red companion to Task 0.10 — next task in the sequence.
- **No GitHub remote yet.** Local-only repo; `git remote add origin …` whenever the user creates the GitHub empty repo.
- **No Week 1 work started.**

## Repo state

```
~/projects/codi-brain/
├── pyproject.toml          # full deps merged (fastapi + code_graph stack), uv.lock committed
├── Dockerfile              # NOT YET (Task 1.1 in Week 1)
├── docker-compose.yaml     # NOT YET (Task 1.2)
├── .gitignore, .python-version, README.md
├── src/
│   ├── code_graph/         # absorbed from code-graph-rag (no mcp/, no main.py, no build_binary.py)
│   └── codi_brain/         # NOT YET (first code lands in Week 1 Task 1.4)
└── tests/
    ├── conftest.py         # memgraph_port + memgraph_client + qdrant_url testcontainer fixtures
    └── test_code_graph/    # absorbed upstream tests, imports rewritten
        ├── test_project_id_property.py     # Task 0.7 test (passes)
        └── test_ingestor_project_id.py     # Task 0.9 test (currently red — Task 0.10 makes it green)
```

## Commit log (main branch, local only)

```
e328e68 test(code_graph): require project_id persistence via MemgraphIngestor (TDD red)
c6e18fa feat(code_graph): accept project_id kwarg on GraphUpdater, propagate to ingestor
ffc44bb test(code_graph): require project_id kwarg on GraphUpdater
14efde3 test(code_graph): absorb tests green (765 passed, 2 xfail upstream-broken)
14042b1 refactor(code_graph): drop CLI and MCP-stdio entries (absorbed, not distributed)
8d4c8a0 chore: merge code_graph deps into pyproject.toml
b400d74 test(code_graph): absorb upstream tests as tests/test_code_graph
bffc504 feat(code_graph): absorb codebase_rag as src/code_graph
640bc0a chore: scaffold codi-brain repo
```

## Prerequisites next session inherits

- **Docker is running locally.**
- **Memgraph image is cached**: `memgraph/memgraph-mage:2.16.1` was pulled once — subsequent testcontainer spin-ups take a few seconds rather than minutes.
- **uv 0.9.18** is installed system-wide.
- **Python 3.12.11** is the active interpreter via `.python-version`.
- **`~/projects/code-graph-rag/`** still exists; the next session can compare our absorbed copy against it if needed.

## Deviations from the as-written plan (already documented in impl plan §Progress log)

1. `xfail` on two pre-existing upstream test failures (not regressions from absorption).
2. Extra test-file deletions in Task 0.6 for upstream-root modules we never absorbed (`codec/`, `realtime_updater.py`, `main.py`).
3. Ingestor-level `project_id` propagation via `setattr(ingestor, 'project_id', ...)` rather than threading through every processor.
4. Testcontainer fixtures pulled forward from Task 1.15 / 1.17 into `tests/conftest.py`.
5. 124 test files' imports rewritten from `code_graph.tests.conftest` to `from conftest` after the move.
6. `uv.lock` included in the scaffold commit (plan omitted it).

## What to run first in the next session

```bash
cd ~/projects/codi-brain
git log --oneline | head -10             # sanity: 9 commits starting with 640bc0a
uv run pytest tests/test_code_graph/ -q  # expect: 766 passed, 1 failed, 12 skipped, 2 xfailed
```

The single failing test is `test_ingestor_project_id.py::test_ensure_node_persists_project_id`. That is the intended red state — do NOT "fix" it by reverting. Proceed directly to **Task 0.10**.

## Task 0.10 — green-bar the red test

**File to edit:** `src/code_graph/services/graph_service.py`.

**Change needed:** make `MemgraphIngestor.ensure_node_batch` (and the flush path) inject `self.project_id` into every node's property dict when the attribute is set.

The attribute is populated by `GraphUpdater.__init__` via `setattr(self.ingestor, "project_id", project_id)` when a `project_id` kwarg is passed (see commit `c6e18fa`, graph_updater.py line ~285).

**Minimal patch sketch:**

```python
# inside MemgraphIngestor
def ensure_node_batch(self, label: str, props: dict) -> None:
    pid = getattr(self, "project_id", None)
    if pid is not None and "project_id" not in props:
        props = {**props, "project_id": pid}
    # … existing buffering logic unchanged
```

Then `uv run pytest tests/test_code_graph/test_ingestor_project_id.py` → expect green. Full suite → 767 passed, 12 skipped, 2 xfailed. Commit: `feat(code_graph): MemgraphIngestor auto-injects project_id from attribute`.

## Task 0.11 — explicit Memgraph host/port kwargs

Minor change in the same file. `MemgraphIngestor.__init__` should accept `host: str | None = None, port: int | None = None` (already may accept — verify) and prefer them over env vars. Signature test at `tests/test_code_graph/test_explicit_config.py`; behavioral test follows.

## Task 0.12 — Week 0 smoke script

Shell script at `scripts/week0_smoke.sh` per the impl plan §12.0 ship criterion. No new Python code.

## After Week 0 — open decision for Week 1

The user chose option **B** (fresh session). Recommended next-session opening move is to switch execution mode from **INLINE** to **SUBAGENT** for Week 1's 28 tasks — keeps context clean and each task gets its own fresh implementer + spec-reviewer + code-quality reviewer. The `codi-plan-execution` skill asks for the mode at start.

## Pending decisions left open

Nothing blocks Task 0.10–0.12. Week 1 still has two small questions from impl plan §16:
1. Vault Git remote for Phase 1A — throwaway local bare repo or real GitHub. Leaning real GitHub; zero code cost, exercises the git path from Week 2.
2. `codi-brain` repo visibility — public or private. Leaning public to match `code-graph-rag`'s archived-public state.

Neither blocks Week 0 completion.

## How to pick up — one-sentence version

> "Resume Codi Brain Phase 1 from `~/projects/codi-brain` at Task 0.10 per `docs/20260423_010000_[PLAN]_codi-brain-phase-1-impl.md`; the failing test at `tests/test_code_graph/test_ingestor_project_id.py` is the intended TDD red for Task 0.10."

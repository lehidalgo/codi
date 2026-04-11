# codi-notebooklm

Google NotebookLM research assistant. Queries NotebookLM notebooks for source-grounded, citation-backed answers. Uses Patchright (a Playwright fork with anti-detection) for reliable browser automation. A virtual environment is created automatically on first run.

## Prerequisites

| Dependency | Install | Purpose |
|------------|---------|---------|
| Python 3.9+ | required | runtime |
| Google account | required | NotebookLM authentication |
| Chrome / Chromium | installed by Patchright | browser automation |

No manual `pip install` is needed — `run.py` creates `.venv` and installs all packages automatically on first use.

## Scripts

All scripts live in `scripts/python/`. **Always use `run.py` as the entry point** — never call scripts directly.

| File | Purpose |
|------|---------|
| `scripts/python/run.py` | Entry point: creates venv, installs deps, runs any script |
| `scripts/python/auth_manager.py` | Google authentication setup and status check |
| `scripts/python/notebook_manager.py` | List, add, and activate notebooks |
| `scripts/python/ask_question.py` | Query the active notebook with a question |

## Quick Start

```bash
# 1. Check or set up authentication (one-time)
python scripts/python/run.py auth_manager.py status
python scripts/python/run.py auth_manager.py setup   # if not authenticated

# 2. List your notebooks
python scripts/python/run.py notebook_manager.py list

# 3. Activate a notebook
python scripts/python/run.py notebook_manager.py activate --id <notebook-id>

# 4. Ask a question
python scripts/python/run.py ask_question.py --question "What does the architecture document say about caching?"
```

## Authentication

Authentication stores a session in `.notebooklm_session/`. Run `auth_manager.py setup` once and follow the interactive browser login. Sessions persist across queries until they expire.

## Dependencies (auto-installed by run.py)

- `patchright` — Playwright fork with stealth capabilities
- `playwright` — browser automation base

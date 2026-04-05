# API Reference

Complete reference for all NotebookLM skill scripts.

> **Always use `python run.py <script>` — never call scripts directly.**

---

## ask_question.py

Query a NotebookLM notebook and get a source-grounded answer.

```bash
python run.py ask_question.py \
  --question "Your question" \
  [--notebook-id ID] \
  [--notebook-url URL] \
  [--show-browser]
```

**Arguments:**

| Argument | Required | Description |
|----------|:--------:|-------------|
| `--question` | Yes | Question to ask |
| `--notebook-id` | No | Notebook ID from library |
| `--notebook-url` | No | NotebookLM URL directly |
| `--show-browser` | No | Show browser for debugging |

**Notebook resolution order:**
1. `--notebook-url` if provided
2. `--notebook-id` looked up in library
3. Active notebook in library (if set)
4. Error with list of available notebooks

**Output:** Prints answer to stdout, followed by the follow-up reminder.

**Timeout:** 120 seconds for answer to appear.

---

## notebook_manager.py

Manage a local library of NotebookLM notebooks.

### add

```bash
python run.py notebook_manager.py add \
  --url "https://notebooklm.google.com/notebook/..." \
  --name "Display Name" \
  --description "What this notebook contains" \
  --topics "topic1,topic2,topic3" \
  [--use-cases "use1,use2"] \
  [--tags "tag1,tag2"]
```

All of `--url`, `--name`, `--description`, and `--topics` are required. Never use generic descriptions.

### list

```bash
python run.py notebook_manager.py list
```

Lists all notebooks with ID, topics, and use count. Marks the active notebook.

### search

```bash
python run.py notebook_manager.py search --query "keyword"
```

Searches name, description, topics, tags, and use-cases.

### activate

```bash
python run.py notebook_manager.py activate --id notebook-id
```

Sets the notebook as default for future queries.

### remove

```bash
python run.py notebook_manager.py remove --id notebook-id
```

Removes the notebook from the library (does not affect NotebookLM itself).

### stats

```bash
python run.py notebook_manager.py stats
```

Shows total notebooks, topics, use count, and most-used notebook.

---

## auth_manager.py

Manage Google authentication and browser state.

### setup

```bash
python run.py auth_manager.py setup [--headless] [--timeout 10]
```

Opens a visible browser for manual Google login. After login, saves browser state. Run once per 7 days or after expiry.

### status

```bash
python run.py auth_manager.py status
```

Shows authentication status, state age, and last auth time.

### validate

```bash
python run.py auth_manager.py validate
```

Opens a headless browser and navigates to NotebookLM to confirm auth works.

### reauth

```bash
python run.py auth_manager.py reauth [--timeout 10]
```

Clears existing auth and runs setup again.

### clear

```bash
python run.py auth_manager.py clear
```

Deletes all auth data (state.json, auth_info.json, browser profile).

---

## cleanup_manager.py

Clean up skill data.

```bash
python run.py cleanup_manager.py                     # Preview only
python run.py cleanup_manager.py --confirm           # Execute cleanup
python run.py cleanup_manager.py --preserve-library  # Keep library.json
```

Never deletes `.venv`.

---

## run.py

Script wrapper — use this for all invocations.

```bash
python run.py <script_name>.py [arguments]
```

Automatically:
1. Creates `.venv` if missing
2. Installs dependencies (patchright, python-dotenv)
3. Installs Chrome browser via patchright
4. Runs the script with the correct Python

---

## Data Storage

All data stored in `<skill-dir>/data/`:

```
data/
├── library.json          # Notebook metadata
├── auth_info.json        # Auth status and timestamps
└── browser_state/
    ├── state.json        # Cookies and localStorage
    └── browser_profile/  # Chrome user profile
```

Protected by `.gitignore` — never commit.

---

## Environment Variables

Copy `[[/scripts/.env.example]]` to the skill root as `.env` and adjust:

```bash
cp [[/scripts/.env.example]] .env
```

Available settings (all optional, defaults shown):

```env
HEADLESS=true            # Run browser in headless mode
SHOW_BROWSER=false       # Always show browser window (overrides HEADLESS)
STEALTH_ENABLED=true     # Human-like typing behavior
TYPING_WPM_MIN=160       # Typing speed minimum (words per minute)
TYPING_WPM_MAX=240       # Typing speed maximum
DEFAULT_NOTEBOOK_ID=     # Default notebook when none is specified
```

---

## Python Module API

Classes available after venv exists:

### NotebookLibrary (`notebook_manager.py`)

```python
library = NotebookLibrary()
library.add_notebook(url, name, description, topics, use_cases, tags)
library.list_notebooks()           # → List[Dict]
library.search_notebooks(query)    # → List[Dict]
library.get_notebook(notebook_id)  # → Optional[Dict]
library.select_notebook(notebook_id)
library.get_active_notebook()      # → Optional[Dict]
library.remove_notebook(notebook_id)
library.get_stats()                # → Dict
```

### AuthManager (`auth_manager.py`)

```python
auth = AuthManager()
auth.is_authenticated()            # → bool
auth.get_auth_info()               # → Dict
auth.setup_auth(headless=False)    # → bool
auth.validate_auth()               # → bool
auth.re_auth()                     # → bool
auth.clear_auth()                  # → bool
```

### BrowserFactory (`browser_utils.py`)

```python
from patchright.sync_api import sync_playwright
playwright = sync_playwright().start()
context = BrowserFactory.launch_persistent_context(playwright, headless=True)
```

### StealthUtils (`browser_utils.py`)

```python
StealthUtils.human_type(page, selector, text)
StealthUtils.realistic_click(page, selector)
StealthUtils.random_delay(min_ms=100, max_ms=500)
StealthUtils.random_mouse_movement(page)
```

---

## Rate Limits

- Free Google accounts: ~50 queries/day
- Resets at midnight Pacific time
- Workaround: switch accounts via `auth_manager.py reauth`

---

## Advanced: Parallel Queries

```python
import concurrent.futures
import subprocess

def query(question: str, notebook_id: str) -> str:
    result = subprocess.run(
        ["python", "run.py", "ask_question.py",
         "--question", question, "--notebook-id", notebook_id],
        capture_output=True, text=True
    )
    return result.stdout

with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
    futures = [
        executor.submit(query, q, nb)
        for q, nb in zip(questions, notebook_ids)
    ]
    results = [f.result() for f in futures]
```

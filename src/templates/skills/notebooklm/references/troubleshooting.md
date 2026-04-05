# Troubleshooting

## Quick Reference

| Problem | Solution |
|---------|----------|
| `ModuleNotFoundError` | Use `run.py` wrapper — never call scripts directly |
| Authentication fails | Browser must be visible: `auth_manager.py setup` |
| Rate limit hit (~50/day) | Wait until tomorrow or switch Google account |
| Browser crashes | `cleanup_manager.py --preserve-library` then retry |
| Notebook not found | Check with `notebook_manager.py list` |
| Timeout waiting for answer | Use `--show-browser` to debug |
| State expired (7+ days) | Run `auth_manager.py reauth` |
| No query input found | NotebookLM UI may have changed — check with `--show-browser` |

---

## Authentication Issues

### "Not authenticated" error

```bash
python run.py auth_manager.py status
```

If not authenticated:
```bash
python run.py auth_manager.py setup
```

The browser window opens visibly. Log in to Google, then wait for the URL to reach `notebooklm.google.com`.

### Auth expires / "redirected to login"

Auth state saved in `state.json` expires. Re-authenticate:

```bash
python run.py auth_manager.py reauth
```

### Auth setup timeout

Increase timeout if Google login is slow:

```bash
python run.py auth_manager.py setup --timeout 20
```

### Auth validation fails even after setup

The skill uses real Chrome (not Chromium) for reliability. If Chrome is not installed:

```bash
# Re-run setup to install Chrome
python run.py setup_environment.py
```

---

## Browser Issues

### Browser crashes immediately

Clear all browser data and retry:

```bash
python run.py cleanup_manager.py --preserve-library --confirm
python run.py auth_manager.py setup
```

### Patchright / Playwright version mismatch

Delete `.venv` and let `run.py` recreate it:

```bash
rm -rf .venv
python run.py auth_manager.py status  # Triggers setup
```

### Port conflict or "already running" error

Another instance may be open. Kill all Python processes using Chrome:

```bash
pkill -f patchright
```

---

## Notebook Issues

### "Notebook not found" in library

Check library contents:

```bash
python run.py notebook_manager.py list
```

The notebook ID is derived from the name (lowercase, hyphens). Pass the correct ID to `--notebook-id`.

### Notebook URL changed

Update the URL in the library — remove and re-add:

```bash
python run.py notebook_manager.py remove --id OLD-ID
python run.py notebook_manager.py add --url NEW-URL --name NAME --description DESC --topics TOPICS
```

---

## Query Issues

### Timeout waiting for answer

1. Use `--show-browser` to see what's happening visually:
   ```bash
   python run.py ask_question.py --question "..." --show-browser
   ```
2. Check if the notebook has sources uploaded
3. Check if NotebookLM shows an error message in the browser
4. Try a simpler question to confirm the session works

### Query input not found (selector issue)

NotebookLM updates its CSS selectors occasionally. If `textarea.query-box-input` fails, check `config.py` and update `QUERY_INPUT_SELECTORS` with the current selector from the page.

### Partial or empty answers

Each query opens a fresh session. Include all context in each question — the session has no memory of previous queries.

### Answer cuts off mid-response

The stable-count polling (3 consecutive identical responses) may trigger too early if the answer pauses. Increase `stable_count >= 3` to `>= 5` in `ask_question.py` as a workaround.

---

## Rate Limit Issues

NotebookLM free tier allows approximately 50 queries per day.

- If rate-limited, wait until the next day
- For higher limits, upgrade to NotebookLM Plus or Pro
- For research-heavy use, consider multiple Google accounts (one per project)

---

## Environment Issues

### `ModuleNotFoundError: No module named 'patchright'`

You called a script directly instead of using `run.py`:

```bash
# Wrong
python [[/scripts/python/ask_question.py]] --question "..."

# Correct
python run.py ask_question.py --question "..."
```

### `.venv` creation fails

Check that Python 3.9+ is installed:
```bash
python3 --version
```

If Python is available but venv creation fails:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install patchright==1.55.2 python-dotenv==1.0.0
python -m patchright install chrome
```

---

## Recovery Procedures

### Full reset (preserves notebook library)

```bash
python run.py cleanup_manager.py --preserve-library --confirm
python run.py auth_manager.py setup
```

### Complete reset (deletes everything including library)

```bash
python run.py cleanup_manager.py --confirm
python run.py auth_manager.py setup
# Then re-add notebooks
```

### Backup library before reset

```bash
cp data/library.json ~/notebooklm-library-backup.json
python run.py cleanup_manager.py --confirm
cp ~/notebooklm-library-backup.json data/library.json
```

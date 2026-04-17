# codi-audio-transcriber

Transcribes audio and video files to text using OpenAI Whisper. Runs a local web server at `http://localhost:8765` with file upload, concurrent chunk processing, clipboard copy, `.txt` download, and optional Google Sheets output.

## Prerequisites

| Dependency | Install |
|------------|---------|
| Python 3.9+ | `python3 --version` |
| ffmpeg | `brew install ffmpeg` / `sudo apt-get install ffmpeg` |
| Python packages | `pip install -r scripts/requirements.txt` |
| OpenAI API key | Set `OPENAI_API_KEY` in environment |

## Scripts

| File | Purpose |
|------|---------|
| `scripts/server.py` | HTTP server — exposes the web UI and calls Whisper |
| `scripts/transcriber.py` | Chunked transcription logic using the Whisper API |
| `scripts/sheets_handler.py` | Optional Google Sheets output (requires `credentials.json`) |
| `scripts/requirements.txt` | Python dependency list |
| `scripts/index.html` | Web UI served by the server |

## Quick Start

```bash
# 1. Install ffmpeg (macOS)
brew install ffmpeg

# 2. Install Python packages
pip install -r scripts/requirements.txt

# 3. Set your OpenAI API key
export OPENAI_API_KEY=sk-...

# 4. Start the server
python scripts/server.py

# 5. Open the UI
open http://localhost:8765
```

## Google Sheets (optional)

Place a `credentials.json` file (Google Cloud service account or OAuth client) in the project root before starting the server. The UI exposes a sheet ID input when credentials are detected.

## Runtime Compatibility — Intentional Deviation

The skill-creator standard says executable scripts must ship both a Python
and a TypeScript version (`scripts/python/` + `scripts/ts/`). This skill
deviates by design: the scripts are a full Flask web application
(`server.py`, `transcriber.py`, `sheets_handler.py`, `index.html`), and
porting the server to Node.js would double maintenance with no runtime
benefit — the skill already runs in both Claude Code and Claude.ai
because Python is available in both. The scripts live at `scripts/*.py`
directly rather than under `scripts/python/`.

## Follow-ups

No Python test suite yet. Candidate units for `tests/python/`:

- `transcriber.py` — chunk-boundary logic, overlap handling, reassembly order
- `sheets_handler.py` — spreadsheet URL parsing, worksheet resolution


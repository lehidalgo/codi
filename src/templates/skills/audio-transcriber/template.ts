import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Use when transcribing audio or video files to text using OpenAI Whisper. Launches a local web interface with file upload, concurrent chunk processing, copy/download transcript, and optional Google Sheets output.
category: Productivity
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
version: 1
---

## When to Activate

- User wants to transcribe audio or video files (mp3, wav, m4a, mp4, webm, mov, etc.)
- User asks to convert speech to text
- User wants to save transcriptions to Google Sheets
- User needs to process large audio files with concurrent chunking

## When NOT to Use

- Real-time microphone transcription (this processes existing files)
- Speech synthesis / text-to-speech tasks

# Audio Transcriber

Runs a local web server with a clean UI for audio/video transcription using OpenAI Whisper.

**Features**: File upload · Concurrent chunk processing · Copy to clipboard · Download as .txt · Google Sheets output

---

## Quick Start

### 1. Install system dependency

\\\`\\\`\\\`bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg
\\\`\\\`\\\`

### 2. Install Python packages

\\\`\\\`\\\`bash
pip install -r \${CLAUDE_SKILL_DIR}/scripts/requirements.txt
\\\`\\\`\\\`

### 3. Start the server

\\\`\\\`\\\`bash
python \${CLAUDE_SKILL_DIR}/scripts/server.py
\\\`\\\`\\\`

### 4. Open the UI

Navigate to **http://localhost:8765** in your browser.

---

## Using the Interface

### Transcription

1. Enter your **OpenAI API key** (stored only in your browser session, never sent anywhere except OpenAI)
2. Select **language** or leave on Auto-detect
3. Drop or browse an audio/video file
4. Click **Transcribe** — the terminal shows progress for large chunked files
5. Use **Copy** or **Download .txt** to save the result

### Google Sheets (optional)

To enable saving transcripts to a Google Sheet:

1. Follow the one-time setup in \\\`references/google-sheets-setup.md\\\`
2. Click **Connect Google Account** — a browser tab opens for authorization
3. Paste the **Spreadsheet URL** and click **Load sheets**
4. Select a worksheet → **Save to Sheet**

Each saved row contains: timestamp, source file, duration, cost estimate, full transcript.

---

## Architecture

| File | Purpose |
|------|---------|
| \\\`scripts/server.py\\\` | Flask server on port 8765, all API routes |
| \\\`scripts/transcriber.py\\\` | Chunking + concurrent Whisper API calls |
| \\\`scripts/sheets_handler.py\\\` | gspread OAuth + spreadsheet read/write |
| \\\`scripts/index.html\\\` | Single-page UI (served by Flask) |
| \\\`scripts/requirements.txt\\\` | Python dependencies |
| \\\`references/google-sheets-setup.md\\\` | One-time Google Cloud setup guide |

### Chunking logic

Files larger than 5 MB are split into overlapping chunks and transcribed concurrently
(up to 10 parallel API requests). Chunks are reassembled in order. For most files
this provides a significant speedup over sequential processing.

---

## Configuration

Environment variable overrides:

\\\`\\\`\\\`bash
PORT=9000 python \${CLAUDE_SKILL_DIR}/scripts/server.py
\\\`\\\`\\\`

Code-level defaults (in \\\`transcriber.py\\\`):

| Constant | Default | Description |
|----------|---------|-------------|
| \\\`DEFAULT_MAX_DIRECT_MB\\\` | 5 | File size threshold before chunking |
| \\\`DEFAULT_CHUNK_OVERLAP_MS\\\` | 1000 | Overlap between chunks (avoids cutting words) |
| \\\`DEFAULT_MAX_WORKERS\\\` | 10 | Concurrent Whisper API requests |
| \\\`WHISPER_COST_PER_MINUTE\\\` | 0.006 | For cost estimation only |

---

## Supported Formats

| Type | Extensions |
|------|-----------|
| Audio | mp3, wav, m4a, ogg, flac, aac, wma |
| Video | mp4, webm, mov, avi, mkv, m4v |

Video files have their audio track extracted automatically before transcription.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| \\\`ffmpeg not found\\\` | Install ffmpeg (see Quick Start above) |
| \\\`Module not found\\\` | Run \\\`pip install -r requirements.txt\\\` |
| File too large / timeout | Reduce \\\`DEFAULT_MAX_DIRECT_MB\\\` or check network connection |
| Google Sheets auth fails | See \\\`references/google-sheets-setup.md\\\` |
| Port 8765 already in use | Run with \\\`PORT=9000 python server.py\\\` |
`;

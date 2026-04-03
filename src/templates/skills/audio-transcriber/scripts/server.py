"""
server.py — Audio Transcriber local web server.

Run: python server.py
Then open http://localhost:8765 in your browser.

Requirements:
    pip install flask openai pydub gspread google-auth-oauthlib
    Also: ffmpeg must be installed (brew install ffmpeg / apt install ffmpeg)
"""

import json
import os
import sys
import tempfile
import threading
from pathlib import Path

from flask import Flask, jsonify, request, send_file, send_from_directory

sys.path.insert(0, os.path.dirname(__file__))
import sheets_handler
import transcriber as tr

PORT = int(os.environ.get("PORT", 8765))
SCRIPT_DIR = Path(__file__).parent
app = Flask(__name__, static_folder=str(SCRIPT_DIR))

# ── In-memory job store (single-user localhost) ──────────────────────

_jobs: dict[str, dict] = {}  # job_id → {status, result, error}
_job_lock = threading.Lock()


def _new_job(job_id: str) -> None:
    with _job_lock:
        _jobs[job_id] = {"status": "queued", "result": None, "error": None, "progress": []}


def _update_job(job_id: str, **kwargs) -> None:
    with _job_lock:
        _jobs[job_id].update(kwargs)


def _append_progress(job_id: str, msg: str) -> None:
    with _job_lock:
        _jobs[job_id]["progress"].append(msg)


# ── Frontend ──────────────────────────────────────────────────────────


@app.route("/")
def index():
    return send_from_directory(str(SCRIPT_DIR), "index.html")


# ── Transcription ─────────────────────────────────────────────────────


@app.route("/api/transcribe", methods=["POST"])
def api_transcribe():
    """
    Multipart POST:
      - file: audio/video file
      - api_key: OpenAI API key
      - model: whisper model (default: whisper-1)
      - language: ISO code or empty for auto-detect
    Returns JSON with transcript text and metadata.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    uploaded = request.files["file"]
    api_key = request.form.get("api_key", "").strip()
    model = request.form.get("model", "whisper-1").strip()
    language = request.form.get("language", "").strip() or None

    if not api_key:
        return jsonify({"error": "OpenAI API key is required"}), 400

    # Validate extension
    suffix = Path(uploaded.filename).suffix.lower() if uploaded.filename else ""
    if suffix not in tr.SUPPORTED_EXTENSIONS:
        return jsonify({"error": f"Unsupported file type: {suffix}"}), 400

    # Save upload to temp file
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    uploaded.save(tmp.name)
    tmp_path = Path(tmp.name)

    progress_log: list[str] = []

    def on_progress(p: tr.TranscriptionProgress) -> None:
        msg = p.message or p.status
        if p.total > 0:
            msg = f"[{p.current}/{p.total}] {msg}"
        progress_log.append(msg)
        print(f"  {msg}")

    try:
        result = tr.transcribe_file(
            file_path=str(tmp_path),
            api_key=api_key,
            model=model,
            language=language,
            on_progress=on_progress,
        )
        return jsonify({
            "text": result.text,
            "cost": result.cost,
            "duration_minutes": result.duration_minutes,
            "num_chunks": result.num_chunks,
            "processing_seconds": result.processing_seconds,
            "source_file": uploaded.filename,
            "progress": progress_log,
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        tmp_path.unlink(missing_ok=True)


# ── Google Sheets ─────────────────────────────────────────────────────


@app.route("/api/sheets/connect", methods=["POST"])
def api_sheets_connect():
    """
    Trigger gspread OAuth flow. First call opens a browser for authorization.
    Subsequent calls use the cached token at ~/.config/gspread/authorized_user.json.
    """
    try:
        token = sheets_handler.connect()
        return jsonify({"connected": True, "message": "Connected to Google Sheets"})
    except Exception as exc:
        return jsonify({"connected": False, "error": str(exc)}), 500


@app.route("/api/sheets/status", methods=["GET"])
def api_sheets_status():
    return jsonify({"connected": sheets_handler.is_connected()})


@app.route("/api/sheets/worksheets", methods=["POST"])
def api_sheets_worksheets():
    """POST body: {"url": "https://docs.google.com/spreadsheets/d/..."}"""
    data = request.get_json(force=True) or {}
    url = data.get("url", "").strip()
    if not url:
        return jsonify({"error": "Spreadsheet URL is required"}), 400
    try:
        sheets = sheets_handler.list_worksheets(url)
        return jsonify({"worksheets": sheets})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/sheets/save", methods=["POST"])
def api_sheets_save():
    """
    POST body:
      {
        "url": "...",
        "worksheet": "Sheet1",
        "transcript": "...",
        "source_file": "audio.mp3",
        "duration_minutes": 5.2,
        "cost": 0.031
      }
    """
    data = request.get_json(force=True) or {}
    required = ["url", "worksheet", "transcript"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"Missing field: {field}"}), 400
    try:
        row = sheets_handler.save_transcript(
            spreadsheet_url=data["url"],
            worksheet_name=data["worksheet"],
            transcript=data["transcript"],
            source_file=data.get("source_file", ""),
            duration_minutes=float(data.get("duration_minutes", 0)),
            cost=float(data.get("cost", 0)),
        )
        return jsonify({"saved": True, "row": row})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


# ── Start ─────────────────────────────────────────────────────────────


if __name__ == "__main__":
    print(f"🎙  Audio Transcriber running at http://localhost:{PORT}")
    print("    Press Ctrl+C to stop.\n")
    app.run(host="0.0.0.0", port=PORT, debug=False)

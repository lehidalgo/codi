"""
transcriber.py — Audio/video transcription using OpenAI Whisper.

Handles chunking, concurrent processing, and video audio extraction.
"""

import os
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from openai import OpenAI
from pydub import AudioSegment


# ── Configuration defaults ────────────────────────────────────────────

DEFAULT_MAX_DIRECT_MB = 5
DEFAULT_CHUNK_OVERLAP_MS = 1000
DEFAULT_MAX_WORKERS = 10
WHISPER_COST_PER_MINUTE = 0.006

VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".avi", ".mkv", ".m4v"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".wma"}
SUPPORTED_EXTENSIONS = AUDIO_EXTENSIONS | VIDEO_EXTENSIONS


# ── Data classes ──────────────────────────────────────────────────────


@dataclass
class ChunkTask:
    index: int
    audio_segment: AudioSegment


@dataclass
class TranscriptionProgress:
    status: str
    current: int = 0
    total: int = 0
    message: str = ""


@dataclass
class TranscriptionResult:
    text: str
    cost: float
    duration_minutes: float
    num_chunks: int
    processing_seconds: float
    source_file: str


# ── Audio helpers ─────────────────────────────────────────────────────


def extract_audio_from_video(video_path: Path) -> Path:
    """Extract audio track from a video file, return path to temp mp3."""
    audio = AudioSegment.from_file(str(video_path))
    temp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
    audio.export(temp.name, format="mp3", bitrate="128k")
    return Path(temp.name)


def calculate_chunk_duration_ms(
    file_size_mb: float,
    duration_s: float,
    max_mb: float = DEFAULT_MAX_DIRECT_MB,
) -> int:
    """Calculate chunk duration targeting max_mb per chunk."""
    bitrate = (file_size_mb * 1024 * 1024 * 8) / duration_s
    seconds_per_chunk = (max_mb * 1024 * 1024 * 8) / bitrate
    return int(seconds_per_chunk * 1000 * 0.9)


def create_chunks(
    audio: AudioSegment,
    chunk_duration_ms: int,
    overlap_ms: int = DEFAULT_CHUNK_OVERLAP_MS,
) -> list[ChunkTask]:
    """Split audio into overlapping chunks."""
    chunks: list[ChunkTask] = []
    position = 0
    index = 0

    while position < len(audio):
        start = max(0, position - overlap_ms if position > 0 else 0)
        end = min(len(audio), start + chunk_duration_ms)
        chunks.append(ChunkTask(index=index, audio_segment=audio[start:end]))
        index += 1
        position += chunk_duration_ms - overlap_ms

    return chunks


def export_chunk(chunk: ChunkTask) -> Path:
    """Export a chunk to a temporary mp3 file."""
    temp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
    chunk.audio_segment.export(temp.name, format="mp3", bitrate="128k")
    return Path(temp.name)


# ── Single-chunk transcription ────────────────────────────────────────


def transcribe_chunk(
    client: OpenAI,
    chunk: ChunkTask,
    model: str = "whisper-1",
    language: Optional[str] = None,
) -> tuple[int, str, Optional[str]]:
    """Transcribe one chunk. Returns (index, text, error_or_None)."""
    temp_path: Optional[Path] = None
    try:
        temp_path = export_chunk(chunk)
        kwargs: dict = {
            "model": model,
            "file": open(temp_path, "rb"),
            "response_format": "text",
        }
        if language:
            kwargs["language"] = language

        text = client.audio.transcriptions.create(**kwargs)
        return (chunk.index, text, None)
    except Exception as exc:
        return (chunk.index, "", str(exc))
    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink(missing_ok=True)


# ── Main transcription entry point ────────────────────────────────────


def transcribe_file(
    file_path: str,
    api_key: str,
    model: str = "whisper-1",
    language: Optional[str] = None,
    max_workers: int = DEFAULT_MAX_WORKERS,
    on_progress: Optional[callable] = None,
) -> TranscriptionResult:
    """
    Transcribe an audio or video file.

    Args:
        file_path: Path to audio/video file.
        api_key: OpenAI API key.
        model: Whisper model name.
        language: ISO language code or None for auto-detect.
        max_workers: Max concurrent API requests.
        on_progress: Callback(TranscriptionProgress) for status updates.
    """
    start_time = time.time()
    path = Path(file_path)
    client = OpenAI(api_key=api_key)

    def notify(status: str, current: int = 0, total: int = 0, msg: str = "") -> None:
        if on_progress:
            on_progress(TranscriptionProgress(status, current, total, msg))

    # Handle video files
    extracted: Optional[Path] = None
    if path.suffix.lower() in VIDEO_EXTENSIONS:
        notify("extracting", message=f"Extracting audio from {path.name}")
        extracted = extract_audio_from_video(path)
        process_path = extracted
    else:
        process_path = path

    try:
        file_size_mb = process_path.stat().st_size / (1024 * 1024)
        audio = AudioSegment.from_file(str(process_path))
        duration_s = len(audio) / 1000
        duration_min = duration_s / 60
        cost = duration_min * WHISPER_COST_PER_MINUTE

        notify("loaded", message=f"{duration_min:.1f} min, {file_size_mb:.1f} MB")

        # Direct upload for small files
        if file_size_mb <= DEFAULT_MAX_DIRECT_MB:
            notify("transcribing", current=1, total=1, message="Direct upload")
            kwargs: dict = {
                "model": model,
                "file": open(process_path, "rb"),
                "response_format": "text",
            }
            if language:
                kwargs["language"] = language
            text = client.audio.transcriptions.create(**kwargs)
            num_chunks = 1
        else:
            # Chunked + concurrent transcription
            chunk_ms = calculate_chunk_duration_ms(file_size_mb, duration_s)
            chunks = create_chunks(audio, chunk_ms)
            num_chunks = len(chunks)
            notify("chunking", total=num_chunks, message=f"Split into {num_chunks} chunks")

            results: list[tuple[int, str, Optional[str]]] = []
            with ThreadPoolExecutor(max_workers=max_workers) as pool:
                futures = {
                    pool.submit(transcribe_chunk, client, c, model, language): c.index
                    for c in chunks
                }
                done_count = 0
                for future in as_completed(futures):
                    idx, txt, err = future.result()
                    results.append((idx, txt, err))
                    done_count += 1
                    status = "error" if err else "transcribing"
                    notify(status, current=done_count, total=num_chunks,
                           message=f"Chunk {done_count}/{num_chunks}")

            results.sort(key=lambda r: r[0])
            text = " ".join(txt for _, txt, err in results if not err)

        elapsed = time.time() - start_time
        notify("done", message=f"Completed in {elapsed:.1f}s")

        return TranscriptionResult(
            text=text,
            cost=cost,
            duration_minutes=duration_min,
            num_chunks=num_chunks,
            processing_seconds=elapsed,
            source_file=str(path),
        )
    finally:
        if extracted and extracted.exists():
            extracted.unlink(missing_ok=True)

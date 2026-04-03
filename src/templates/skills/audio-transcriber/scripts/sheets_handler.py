"""
sheets_handler.py — Google Sheets integration via gspread OAuth.

Uses gspread's built-in OAuth flow: on first connect, a browser window
opens for Google account authorization. Credentials are cached at
~/.config/gspread/authorized_user.json for subsequent runs.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Optional

import gspread


# ── OAuth connection ──────────────────────────────────────────────────


_client: Optional[gspread.Client] = None


def connect() -> str:
    """
    Authenticate with Google using gspread OAuth flow.

    First call opens a browser for authorization. Subsequent calls use
    the cached token. Returns the authenticated user's email.

    Requires ~/.config/gspread/credentials.json — see references/google-sheets-setup.md.
    """
    global _client
    _client = gspread.oauth()
    return _client.auth.token


def is_connected() -> bool:
    """Return True if a Google session is active."""
    return _client is not None


# ── Spreadsheet helpers ───────────────────────────────────────────────


def _extract_spreadsheet_id(url: str) -> str:
    """Parse spreadsheet ID from a Google Sheets URL."""
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9_-]+)", url)
    if not match:
        raise ValueError(f"Could not extract spreadsheet ID from URL: {url}")
    return match.group(1)


def list_worksheets(spreadsheet_url: str) -> list[str]:
    """Return a list of worksheet (tab) names for a spreadsheet URL."""
    if not _client:
        raise RuntimeError("Not connected to Google. Call connect() first.")
    sheet_id = _extract_spreadsheet_id(spreadsheet_url)
    spreadsheet = _client.open_by_key(sheet_id)
    return [ws.title for ws in spreadsheet.worksheets()]


def save_transcript(
    spreadsheet_url: str,
    worksheet_name: str,
    transcript: str,
    source_file: str,
    duration_minutes: float,
    cost: float,
) -> int:
    """
    Append a transcript row to the specified worksheet.

    Columns: Timestamp | Source File | Duration (min) | Cost ($) | Transcript

    Returns the row number where data was written.
    """
    if not _client:
        raise RuntimeError("Not connected to Google. Call connect() first.")

    from datetime import datetime

    sheet_id = _extract_spreadsheet_id(spreadsheet_url)
    spreadsheet = _client.open_by_key(sheet_id)
    worksheet = spreadsheet.worksheet(worksheet_name)

    # Add header row if the sheet is empty
    if worksheet.row_count == 0 or not worksheet.get_all_values():
        worksheet.append_row(
            ["Timestamp", "Source File", "Duration (min)", "Cost ($)", "Transcript"]
        )

    row = [
        datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        source_file,
        round(duration_minutes, 2),
        round(cost, 4),
        transcript,
    ]
    worksheet.append_row(row)

    all_values = worksheet.get_all_values()
    return len(all_values)

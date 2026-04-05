"""
Configuration for NotebookLM Skill.

Centralizes constants, selectors, and paths.
Loads optional .env file from the skill root directory.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Paths — data lives inside the skill directory
SKILL_DIR = Path(__file__).parent.parent.parent
DATA_DIR = SKILL_DIR / "data"
BROWSER_STATE_DIR = DATA_DIR / "browser_state"
BROWSER_PROFILE_DIR = BROWSER_STATE_DIR / "browser_profile"
STATE_FILE = BROWSER_STATE_DIR / "state.json"
AUTH_INFO_FILE = DATA_DIR / "auth_info.json"
LIBRARY_FILE = DATA_DIR / "library.json"

# Load .env from skill root (does not override existing env vars)
_env_file = SKILL_DIR / ".env"
load_dotenv(_env_file)

# Environment-configurable settings
HEADLESS = os.getenv("HEADLESS", "true").lower() == "true"
SHOW_BROWSER = os.getenv("SHOW_BROWSER", "false").lower() == "true"
STEALTH_ENABLED = os.getenv("STEALTH_ENABLED", "true").lower() == "true"
TYPING_WPM_MIN = int(os.getenv("TYPING_WPM_MIN", "160"))
TYPING_WPM_MAX = int(os.getenv("TYPING_WPM_MAX", "240"))
DEFAULT_NOTEBOOK_ID = os.getenv("DEFAULT_NOTEBOOK_ID", "")

# NotebookLM CSS selectors (ordered by reliability)
QUERY_INPUT_SELECTORS = [
    "textarea.query-box-input",
    'textarea[aria-label="Input for queries"]',
    'textarea[aria-label="Feld für Anfragen"]',
]

RESPONSE_SELECTORS = [
    ".to-user-container .message-text-content",
    "[data-message-author='bot']",
    "[data-message-author='assistant']",
]

# Browser launch arguments
BROWSER_ARGS = [
    "--disable-blink-features=AutomationControlled",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--no-first-run",
    "--no-default-browser-check",
]

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

# Timeouts
LOGIN_TIMEOUT_MINUTES = 10
QUERY_TIMEOUT_SECONDS = 120
PAGE_LOAD_TIMEOUT = 30000

"""
NotebookLM Skill Scripts

Auto-checks virtual environment on first import.
"""

import os
import sys
import subprocess
from pathlib import Path


def _ensure_venv() -> None:
    """Create venv and install dependencies if not already running inside one."""
    skill_dir = Path(__file__).parent.parent.parent
    venv_dir = skill_dir / ".venv"

    # Skip if already in the skill venv
    if hasattr(sys, "real_prefix") or (
        hasattr(sys, "base_prefix") and sys.base_prefix != sys.prefix
    ):
        return

    if not venv_dir.exists():
        setup_script = Path(__file__).parent / "setup_environment.py"
        subprocess.run([sys.executable, str(setup_script)], check=True)


_ensure_venv()

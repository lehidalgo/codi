#!/usr/bin/env python3
"""
Environment setup for NotebookLM skill.

Creates a virtual environment, installs pip dependencies,
and installs the Chrome browser via Patchright.
"""

import subprocess
import sys
from pathlib import Path


def main() -> int:
    skill_dir = Path(__file__).parent.parent.parent
    venv_dir = skill_dir / ".venv"
    requirements = Path(__file__).parent / "requirements.txt"

    # Create venv
    print("Creating virtual environment...")
    result = subprocess.run(
        [sys.executable, "-m", "venv", str(venv_dir)],
    )
    if result.returncode != 0:
        print("Failed to create virtual environment")
        return 1

    # Determine pip path
    if sys.platform == "win32":
        pip_path = venv_dir / "Scripts" / "pip"
        python_path = venv_dir / "Scripts" / "python"
    else:
        pip_path = venv_dir / "bin" / "pip"
        python_path = venv_dir / "bin" / "python"

    # Install dependencies
    print("Installing dependencies...")
    result = subprocess.run(
        [str(pip_path), "install", "-r", str(requirements), "-q"],
    )
    if result.returncode != 0:
        print("Failed to install dependencies")
        return 1

    # Install Chrome browser via Patchright
    print("Installing Chrome browser...")
    result = subprocess.run(
        [str(python_path), "-m", "patchright", "install", "chrome"],
    )
    if result.returncode != 0:
        print("Failed to install Chrome (non-critical — may already be available)")

    print("Setup complete!")
    return 0


if __name__ == "__main__":
    sys.exit(main())

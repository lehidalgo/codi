#!/usr/bin/env python3
"""
Universal runner for NotebookLM skill scripts.

Ensures all scripts run with the correct virtual environment.
Creates .venv and installs dependencies on first run.
"""

import os
import sys
import subprocess
from pathlib import Path


def get_venv_python() -> Path:
    """Return the virtual-environment Python executable."""
    skill_dir = Path(__file__).parent.parent.parent
    venv_dir = skill_dir / ".venv"

    if os.name == "nt":
        return venv_dir / "Scripts" / "python.exe"
    return venv_dir / "bin" / "python"


def ensure_venv() -> Path:
    """Create the virtual environment if it does not exist yet."""
    skill_dir = Path(__file__).parent.parent.parent
    venv_dir = skill_dir / ".venv"
    setup_script = Path(__file__).parent / "setup_environment.py"

    if not venv_dir.exists():
        print("First-time setup: Creating virtual environment...")
        print("   This may take a minute...")

        result = subprocess.run([sys.executable, str(setup_script)])
        if result.returncode != 0:
            print("Failed to set up environment")
            sys.exit(1)

        print("Environment ready!")

    return get_venv_python()


def main() -> None:
    """Parse arguments and delegate to the target script inside .venv."""
    if len(sys.argv) < 2:
        print("Usage: python run.py <script_name> [args...]")
        print()
        print("Available scripts:")
        print("  ask_question.py     - Query NotebookLM")
        print("  notebook_manager.py - Manage notebook library")
        print("  auth_manager.py     - Handle authentication")
        print("  cleanup_manager.py  - Clean up skill data")
        sys.exit(1)

    script_name = sys.argv[1]
    script_args = sys.argv[2:]

    # Accept both "scripts/script.py" and "script.py"
    if script_name.startswith("scripts/"):
        script_name = script_name[len("scripts/"):]

    if not script_name.endswith(".py"):
        script_name += ".py"

    script_path = Path(__file__).parent / script_name

    if not script_path.exists():
        print(f"Script not found: {script_name}")
        print(f"   Looked for: {script_path}")
        sys.exit(1)

    venv_python = ensure_venv()

    cmd = [str(venv_python), str(script_path), *script_args]

    try:
        result = subprocess.run(cmd)
        sys.exit(result.returncode)
    except KeyboardInterrupt:
        print("\nInterrupted by user")
        sys.exit(130)
    except Exception as exc:
        print(f"Error: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()

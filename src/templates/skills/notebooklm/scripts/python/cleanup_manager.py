#!/usr/bin/env python3
"""
Cleanup manager for NotebookLM skill.

Manages deletion of skill data: browser state, auth, sessions.
Never deletes .venv (skill infrastructure).
"""

import shutil
import argparse
import sys
from pathlib import Path
from typing import Dict, List, Any


class CleanupManager:
    """Manages cleanup of NotebookLM skill data."""

    def __init__(self) -> None:
        self.skill_dir = Path(__file__).parent.parent.parent
        self.data_dir = self.skill_dir / "data"

    def _get_size(self, path: Path) -> int:
        """Return size of a file or directory in bytes."""
        if path.is_file():
            return path.stat().st_size
        if path.is_dir():
            total = 0
            try:
                for item in path.rglob("*"):
                    if item.is_file():
                        total += item.stat().st_size
            except Exception:
                pass
            return total
        return 0

    def _format_size(self, size: int) -> str:
        """Format byte count as a human-readable string."""
        for unit in ["B", "KB", "MB", "GB"]:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size //= 1024
        return f"{size:.1f} TB"

    def get_cleanup_paths(
        self, preserve_library: bool = False
    ) -> Dict[str, Any]:
        """Return paths that would be cleaned up and their sizes."""
        categories: Dict[str, List[Dict[str, Any]]] = {
            "browser_state": [],
            "library": [],
            "auth": [],
            "other": [],
        }
        total_size = 0

        if not self.data_dir.exists():
            return {"categories": categories, "total_size": 0, "total_items": 0}

        browser_state_dir = self.data_dir / "browser_state"
        if browser_state_dir.exists():
            for item in browser_state_dir.iterdir():
                size = self._get_size(item)
                categories["browser_state"].append(
                    {
                        "path": str(item),
                        "size": size,
                        "type": "dir" if item.is_dir() else "file",
                    }
                )
                total_size += size

        if not preserve_library:
            library_file = self.data_dir / "library.json"
            if library_file.exists():
                size = library_file.stat().st_size
                categories["library"].append(
                    {"path": str(library_file), "size": size, "type": "file"}
                )
                total_size += size

        auth_info = self.data_dir / "auth_info.json"
        if auth_info.exists():
            size = auth_info.stat().st_size
            categories["auth"].append(
                {"path": str(auth_info), "size": size, "type": "file"}
            )
            total_size += size

        known_names = {"browser_state", "sessions.json", "library.json", "auth_info.json"}
        for item in self.data_dir.iterdir():
            if item.name not in known_names:
                size = self._get_size(item)
                categories["other"].append(
                    {
                        "path": str(item),
                        "size": size,
                        "type": "dir" if item.is_dir() else "file",
                    }
                )
                total_size += size

        return {
            "categories": categories,
            "total_size": total_size,
            "total_items": sum(len(v) for v in categories.values()),
        }

    def preview(self, preserve_library: bool = False) -> None:
        """Print a preview of what would be deleted."""
        data = self.get_cleanup_paths(preserve_library)
        categories = data["categories"]

        print("\nCleanup Preview:")
        print(f"  Total: {data['total_items']} items, {self._format_size(data['total_size'])}")
        print()

        labels = {
            "browser_state": "Browser State",
            "library": "Notebook Library",
            "auth": "Auth Info",
            "other": "Other Data",
        }

        for key, label in labels.items():
            items = categories[key]
            if items:
                print(f"  {label}:")
                for item in items:
                    print(
                        f"    {item['type'].upper()} {item['path']} "
                        f"({self._format_size(item['size'])})"
                    )

        if preserve_library:
            print("\n  [library.json will be preserved]")

        print()
        print("Note: .venv is NEVER deleted")

    def perform_cleanup(
        self, preserve_library: bool = False, dry_run: bool = False
    ) -> Dict[str, Any]:
        """Perform the actual cleanup."""
        data = self.get_cleanup_paths(preserve_library)
        deleted: List[str] = []
        failed: List[str] = []
        deleted_size = 0

        for items in data["categories"].values():
            for item in items:
                path = Path(item["path"])
                if not path.exists():
                    continue

                if dry_run:
                    print(f"  [dry-run] Would delete: {path}")
                    continue

                try:
                    if path.is_dir():
                        shutil.rmtree(path)
                    else:
                        path.unlink()
                    deleted.append(str(path))
                    deleted_size += item["size"]
                    print(f"  Deleted: {path}")
                except Exception as exc:
                    failed.append(str(path))
                    print(f"  Failed to delete {path}: {exc}")

        return {
            "deleted": deleted,
            "failed": failed,
            "deleted_size": deleted_size,
            "total_size": data["total_size"],
        }


def main() -> None:
    """CLI for cleanup management."""
    parser = argparse.ArgumentParser(
        description="Clean up NotebookLM skill data"
    )
    parser.add_argument(
        "--confirm", action="store_true", help="Execute cleanup (default: preview only)"
    )
    parser.add_argument(
        "--preserve-library",
        action="store_true",
        help="Keep library.json (notebook metadata)",
    )

    args = parser.parse_args()
    manager = CleanupManager()

    manager.preview(preserve_library=args.preserve_library)

    if not args.confirm:
        print("Run with --confirm to execute cleanup")
        return

    print("Performing cleanup...")
    result = manager.perform_cleanup(preserve_library=args.preserve_library)

    print(f"\nCleanup complete:")
    print(f"  Deleted: {len(result['deleted'])} items")
    if result["failed"]:
        print(f"  Failed: {len(result['failed'])} items")
    print(f"  Freed: {manager._format_size(result['deleted_size'])}")


if __name__ == "__main__":
    main()

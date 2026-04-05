#!/usr/bin/env python3
"""
Notebook library management for NotebookLM.

Manages a local JSON library of NotebookLM notebooks with metadata,
topics, and usage tracking.
"""

import json
import argparse
import sys
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime


class NotebookLibrary:
    """Manages a collection of NotebookLM notebooks with metadata."""

    def __init__(self) -> None:
        skill_dir = Path(__file__).parent.parent.parent
        self.data_dir = skill_dir / "data"
        self.data_dir.mkdir(parents=True, exist_ok=True)

        self.library_file = self.data_dir / "library.json"
        self.notebooks: Dict[str, Dict[str, Any]] = {}
        self.active_notebook_id: Optional[str] = None

        self._load_library()

    def _load_library(self) -> None:
        """Load library from disk."""
        if self.library_file.exists():
            try:
                with open(self.library_file, "r") as f:
                    data = json.load(f)
                    self.notebooks = data.get("notebooks", {})
                    self.active_notebook_id = data.get("active_notebook_id")
                    print(
                        f"Loaded library with {len(self.notebooks)} notebooks"
                    )
            except Exception as exc:
                print(f"Warning: Error loading library: {exc}")
                self.notebooks = {}
                self.active_notebook_id = None
        else:
            self._save_library()

    def _save_library(self) -> None:
        """Persist library to disk."""
        try:
            data = {
                "notebooks": self.notebooks,
                "active_notebook_id": self.active_notebook_id,
                "updated_at": datetime.now().isoformat(),
            }
            with open(self.library_file, "w") as f:
                json.dump(data, f, indent=2)
        except Exception as exc:
            print(f"Error saving library: {exc}")

    def add_notebook(
        self,
        url: str,
        name: str,
        description: str,
        topics: List[str],
        use_cases: Optional[List[str]] = None,
        tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Add a new notebook to the library."""
        notebook_id = name.lower().replace(" ", "-").replace("_", "-")

        if notebook_id in self.notebooks:
            raise ValueError(f"Notebook with ID '{notebook_id}' already exists")

        notebook: Dict[str, Any] = {
            "id": notebook_id,
            "url": url,
            "name": name,
            "description": description,
            "topics": topics,
            "use_cases": use_cases or [],
            "tags": tags or [],
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "use_count": 0,
            "last_used": None,
        }

        self.notebooks[notebook_id] = notebook

        if len(self.notebooks) == 1:
            self.active_notebook_id = notebook_id

        self._save_library()
        print(f"Added notebook: {name} ({notebook_id})")
        return notebook

    def remove_notebook(self, notebook_id: str) -> bool:
        """Remove a notebook from the library."""
        if notebook_id not in self.notebooks:
            print(f"Notebook not found: {notebook_id}")
            return False

        del self.notebooks[notebook_id]

        if self.active_notebook_id == notebook_id:
            self.active_notebook_id = None
            if self.notebooks:
                self.active_notebook_id = next(iter(self.notebooks))

        self._save_library()
        print(f"Removed notebook: {notebook_id}")
        return True

    def get_notebook(self, notebook_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific notebook by ID."""
        return self.notebooks.get(notebook_id)

    def list_notebooks(self) -> List[Dict[str, Any]]:
        """List all notebooks in the library."""
        return list(self.notebooks.values())

    def search_notebooks(self, query: str) -> List[Dict[str, Any]]:
        """Search notebooks by name, description, topics, or tags."""
        query_lower = query.lower()
        results: List[Dict[str, Any]] = []

        for notebook in self.notebooks.values():
            searchable = [
                notebook["name"].lower(),
                notebook["description"].lower(),
                " ".join(notebook["topics"]).lower(),
                " ".join(notebook["tags"]).lower(),
                " ".join(notebook.get("use_cases", [])).lower(),
            ]
            if any(query_lower in field for field in searchable):
                results.append(notebook)

        return results

    def select_notebook(self, notebook_id: str) -> Dict[str, Any]:
        """Set a notebook as active."""
        if notebook_id not in self.notebooks:
            raise ValueError(f"Notebook not found: {notebook_id}")

        self.active_notebook_id = notebook_id
        self._save_library()

        notebook = self.notebooks[notebook_id]
        print(f"Activated notebook: {notebook['name']}")
        return notebook

    def get_active_notebook(self) -> Optional[Dict[str, Any]]:
        """Return the currently active notebook."""
        if self.active_notebook_id:
            return self.notebooks.get(self.active_notebook_id)
        return None

    def increment_use_count(self, notebook_id: str) -> Dict[str, Any]:
        """Increment usage counter for a notebook."""
        if notebook_id not in self.notebooks:
            raise ValueError(f"Notebook not found: {notebook_id}")

        notebook = self.notebooks[notebook_id]
        notebook["use_count"] += 1
        notebook["last_used"] = datetime.now().isoformat()

        self._save_library()
        return notebook

    def get_stats(self) -> Dict[str, Any]:
        """Return library statistics."""
        total_topics: set[str] = set()
        total_use_count = 0

        for notebook in self.notebooks.values():
            total_topics.update(notebook["topics"])
            total_use_count += notebook["use_count"]

        most_used = None
        if self.notebooks:
            most_used = max(
                self.notebooks.values(), key=lambda n: n["use_count"]
            )

        return {
            "total_notebooks": len(self.notebooks),
            "total_topics": len(total_topics),
            "total_use_count": total_use_count,
            "active_notebook": self.get_active_notebook(),
            "most_used_notebook": most_used,
            "library_path": str(self.library_file),
        }


def main() -> None:
    """CLI for notebook management."""
    parser = argparse.ArgumentParser(
        description="Manage NotebookLM library"
    )
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    add_p = subparsers.add_parser("add", help="Add a notebook")
    add_p.add_argument("--url", required=True, help="NotebookLM URL")
    add_p.add_argument("--name", required=True, help="Display name")
    add_p.add_argument("--description", required=True, help="Description")
    add_p.add_argument(
        "--topics", required=True, help="Comma-separated topics"
    )
    add_p.add_argument("--use-cases", help="Comma-separated use cases")
    add_p.add_argument("--tags", help="Comma-separated tags")

    subparsers.add_parser("list", help="List all notebooks")

    search_p = subparsers.add_parser("search", help="Search notebooks")
    search_p.add_argument("--query", required=True, help="Search query")

    activate_p = subparsers.add_parser(
        "activate", help="Set active notebook"
    )
    activate_p.add_argument("--id", required=True, help="Notebook ID")

    remove_p = subparsers.add_parser("remove", help="Remove a notebook")
    remove_p.add_argument("--id", required=True, help="Notebook ID")

    subparsers.add_parser("stats", help="Show library statistics")

    args = parser.parse_args()
    library = NotebookLibrary()

    if args.command == "add":
        topics = [t.strip() for t in args.topics.split(",")]
        use_cases = (
            [u.strip() for u in args.use_cases.split(",")]
            if args.use_cases
            else None
        )
        tags = (
            [t.strip() for t in args.tags.split(",")]
            if args.tags
            else None
        )

        notebook = library.add_notebook(
            url=args.url,
            name=args.name,
            description=args.description,
            topics=topics,
            use_cases=use_cases,
            tags=tags,
        )
        print(json.dumps(notebook, indent=2))

    elif args.command == "list":
        notebooks = library.list_notebooks()
        if notebooks:
            print("\nNotebook Library:")
            for nb in notebooks:
                active = (
                    " [ACTIVE]"
                    if nb["id"] == library.active_notebook_id
                    else ""
                )
                print(f"\n  {nb['name']}{active}")
                print(f"     ID: {nb['id']}")
                print(f"     Topics: {', '.join(nb['topics'])}")
                print(f"     Uses: {nb['use_count']}")
        else:
            print(
                "Library is empty. Add notebooks with: "
                "notebook_manager.py add"
            )

    elif args.command == "search":
        results = library.search_notebooks(args.query)
        if results:
            print(f"\nFound {len(results)} notebooks:")
            for nb in results:
                print(f"\n  {nb['name']} ({nb['id']})")
                print(f"     {nb['description']}")
        else:
            print(f"No notebooks found for: {args.query}")

    elif args.command == "activate":
        notebook = library.select_notebook(args.id)
        print(f"Now using: {notebook['name']}")

    elif args.command == "remove":
        if library.remove_notebook(args.id):
            print("Notebook removed from library")

    elif args.command == "stats":
        stats = library.get_stats()
        print("\nLibrary Statistics:")
        print(f"  Total notebooks: {stats['total_notebooks']}")
        print(f"  Total topics: {stats['total_topics']}")
        print(f"  Total uses: {stats['total_use_count']}")
        if stats["active_notebook"]:
            print(f"  Active: {stats['active_notebook']['name']}")
        if stats["most_used_notebook"]:
            most = stats["most_used_notebook"]
            print(f"  Most used: {most['name']} ({most['use_count']} uses)")
        print(f"  Library path: {stats['library_path']}")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()

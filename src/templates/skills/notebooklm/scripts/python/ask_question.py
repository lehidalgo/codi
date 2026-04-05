#!/usr/bin/env python3
"""
NotebookLM question interface.

Opens a fresh browser session, navigates to a NotebookLM notebook,
types the question with human-like behavior, waits for a stable
response (3 consecutive polls), appends a follow-up reminder, and
returns the answer. 120-second timeout.

Uses hybrid auth: persistent browser profile + cookie injection.
See references/authentication.md for details.
"""

import argparse
import sys
import time
import re
from pathlib import Path
from typing import Optional

from patchright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).parent))

from auth_manager import AuthManager
from notebook_manager import NotebookLibrary
from config import (
    QUERY_INPUT_SELECTORS,
    RESPONSE_SELECTORS,
    QUERY_TIMEOUT_SECONDS,
    HEADLESS,
    SHOW_BROWSER,
    DEFAULT_NOTEBOOK_ID,
)
from browser_utils import BrowserFactory, StealthUtils


FOLLOW_UP_REMINDER = (
    "\n\nEXTREMELY IMPORTANT: Is that ALL you need to know? "
    "You can always ask another question! Think about it carefully: "
    "before you reply to the user, review their original request and "
    "this answer. If anything is still unclear or missing, ask me "
    "another comprehensive question that includes all necessary context "
    "(since each question opens a new browser session)."
)


def ask_notebooklm(
    question: str, notebook_url: str, headless: bool = HEADLESS
) -> Optional[str]:
    """
    Ask a question to NotebookLM.

    Args:
        question: Question to ask.
        notebook_url: NotebookLM notebook URL.
        headless: Run browser in headless mode.

    Returns:
        Answer text from NotebookLM, or None on failure.
    """
    auth = AuthManager()

    if not auth.is_authenticated():
        print("Not authenticated. Run: python run.py auth_manager.py setup")
        return None

    print(f"Asking: {question}")
    print(f"Notebook: {notebook_url}")

    playwright = None
    context = None

    try:
        playwright = sync_playwright().start()

        context = BrowserFactory.launch_persistent_context(
            playwright, headless=headless
        )

        page = context.new_page()
        print("  Opening notebook...")
        page.goto(notebook_url, wait_until="domcontentloaded")

        page.wait_for_url(
            re.compile(r"^https://notebooklm\.google\.com/"), timeout=10000
        )

        # Wait for query input
        print("  Waiting for query input...")
        query_element = None

        for selector in QUERY_INPUT_SELECTORS:
            try:
                query_element = page.wait_for_selector(
                    selector, timeout=10000, state="visible"
                )
                if query_element:
                    print(f"  Found input: {selector}")
                    break
            except Exception:
                continue

        if not query_element:
            print("  Could not find query input")
            return None

        # Type question with human-like speed
        print("  Typing question...")
        input_selector = QUERY_INPUT_SELECTORS[0]
        StealthUtils.human_type(page, input_selector, question)

        # Submit
        print("  Submitting...")
        page.keyboard.press("Enter")
        StealthUtils.random_delay(500, 1500)

        # Wait for response — poll for stable text
        print("  Waiting for answer...")

        answer: Optional[str] = None
        stable_count = 0
        last_text: Optional[str] = None
        deadline = time.time() + QUERY_TIMEOUT_SECONDS

        while time.time() < deadline:
            # Check if NotebookLM is still thinking
            try:
                thinking = page.query_selector("div.thinking-message")
                if thinking and thinking.is_visible():
                    time.sleep(1)
                    continue
            except Exception:
                pass

            for selector in RESPONSE_SELECTORS:
                try:
                    elements = page.query_selector_all(selector)
                    if elements:
                        latest = elements[-1]
                        text = latest.inner_text().strip()

                        if text:
                            if text == last_text:
                                stable_count += 1
                                if stable_count >= 3:
                                    answer = text
                                    break
                            else:
                                stable_count = 0
                                last_text = text
                except Exception:
                    continue

            if answer:
                break

            time.sleep(1)

        if not answer:
            print("  Timeout waiting for answer")
            return None

        print("  Got answer!")
        return answer + FOLLOW_UP_REMINDER

    except Exception as exc:
        print(f"  Error: {exc}")
        import traceback

        traceback.print_exc()
        return None

    finally:
        if context:
            try:
                context.close()
            except Exception:
                pass
        if playwright:
            try:
                playwright.stop()
            except Exception:
                pass


def main() -> int:
    """CLI for asking NotebookLM questions."""
    parser = argparse.ArgumentParser(
        description="Ask NotebookLM a question"
    )
    parser.add_argument("--question", required=True, help="Question to ask")
    parser.add_argument("--notebook-url", help="NotebookLM notebook URL")
    parser.add_argument("--notebook-id", help="Notebook ID from library")
    parser.add_argument(
        "--show-browser", action="store_true", help="Show browser"
    )

    args = parser.parse_args()

    # Resolve notebook URL
    notebook_url = args.notebook_url
    notebook_id = args.notebook_id or DEFAULT_NOTEBOOK_ID or None

    if not notebook_url and notebook_id:
        args.notebook_id = notebook_id

    if not notebook_url and args.notebook_id:
        library = NotebookLibrary()
        notebook = library.get_notebook(args.notebook_id)
        if notebook:
            notebook_url = notebook["url"]
        else:
            print(f"Notebook '{args.notebook_id}' not found")
            return 1

    if not notebook_url:
        library = NotebookLibrary()
        active = library.get_active_notebook()
        if active:
            notebook_url = active["url"]
            print(f"Using active notebook: {active['name']}")
        else:
            notebooks = library.list_notebooks()
            if notebooks:
                print("\nAvailable notebooks:")
                for nb in notebooks:
                    mark = (
                        " [ACTIVE]"
                        if nb.get("id") == library.active_notebook_id
                        else ""
                    )
                    print(f"  {nb['id']}: {nb['name']}{mark}")
                print("\nSpecify with --notebook-id or set active:")
                print(
                    "python run.py notebook_manager.py activate --id ID"
                )
            else:
                print("No notebooks in library. Add one first:")
                print(
                    "python run.py notebook_manager.py add "
                    "--url URL --name NAME --description DESC --topics TOPICS"
                )
            return 1

    # --show-browser flag or SHOW_BROWSER/.env var both disable headless
    show_browser = args.show_browser or SHOW_BROWSER
    answer = ask_notebooklm(
        question=args.question,
        notebook_url=notebook_url,
        headless=not show_browser,
    )

    if answer:
        print()
        print("=" * 60)
        print(f"Question: {args.question}")
        print("=" * 60)
        print()
        print(answer)
        print()
        print("=" * 60)
        return 0

    print("\nFailed to get answer")
    return 1


if __name__ == "__main__":
    sys.exit(main())

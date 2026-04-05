#!/usr/bin/env python3
"""
Authentication manager for NotebookLM.

Handles Google login and browser state persistence.
Uses hybrid auth: persistent browser profile + manual cookie injection
to work around Playwright bug #36139 (session cookies not persisting).

See references/authentication.md for architecture details.
"""

import json
import time
import argparse
import shutil
import re
import sys
from pathlib import Path
from typing import Dict, Any

from patchright.sync_api import sync_playwright, BrowserContext

sys.path.insert(0, str(Path(__file__).parent))

from config import BROWSER_STATE_DIR, STATE_FILE, AUTH_INFO_FILE, DATA_DIR
from browser_utils import BrowserFactory


class AuthManager:
    """Manages authentication and browser state for NotebookLM."""

    def __init__(self) -> None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        BROWSER_STATE_DIR.mkdir(parents=True, exist_ok=True)

        self.state_file = STATE_FILE
        self.auth_info_file = AUTH_INFO_FILE
        self.browser_state_dir = BROWSER_STATE_DIR

    def is_authenticated(self) -> bool:
        """Check if valid authentication exists."""
        if not self.state_file.exists():
            return False

        age_days = (time.time() - self.state_file.stat().st_mtime) / 86400
        if age_days > 7:
            print(
                f"  Warning: Browser state is {age_days:.1f} days old, "
                "may need re-authentication"
            )

        return True

    def get_auth_info(self) -> Dict[str, Any]:
        """Return authentication status information."""
        info: Dict[str, Any] = {
            "authenticated": self.is_authenticated(),
            "state_file": str(self.state_file),
            "state_exists": self.state_file.exists(),
        }

        if self.auth_info_file.exists():
            try:
                with open(self.auth_info_file, "r") as f:
                    info.update(json.load(f))
            except Exception:
                pass

        if info["state_exists"]:
            info["state_age_hours"] = (
                time.time() - self.state_file.stat().st_mtime
            ) / 3600

        return info

    def setup_auth(
        self, headless: bool = False, timeout_minutes: int = 10
    ) -> bool:
        """Perform interactive authentication setup (browser visible)."""
        print("Starting authentication setup...")
        print(f"  Timeout: {timeout_minutes} minutes")

        playwright = None
        context = None

        try:
            playwright = sync_playwright().start()
            context = BrowserFactory.launch_persistent_context(
                playwright, headless=headless
            )

            page = context.new_page()
            page.goto(
                "https://notebooklm.google.com", wait_until="domcontentloaded"
            )

            # Already authenticated?
            if (
                "notebooklm.google.com" in page.url
                and "accounts.google.com" not in page.url
            ):
                print("  Already authenticated!")
                self._save_browser_state(context)
                return True

            # Wait for manual login
            print()
            print("  Please log in to your Google account...")
            print(f"  Waiting up to {timeout_minutes} minutes for login...")

            try:
                timeout_ms = int(timeout_minutes * 60 * 1000)
                page.wait_for_url(
                    re.compile(r"^https://notebooklm\.google\.com/"),
                    timeout=timeout_ms,
                )
                print("  Login successful!")
                self._save_browser_state(context)
                self._save_auth_info()
                return True

            except Exception as exc:
                print(f"  Authentication timeout: {exc}")
                return False

        except Exception as exc:
            print(f"  Error: {exc}")
            return False

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

    def _save_browser_state(self, context: BrowserContext) -> None:
        """Save browser state (cookies + localStorage) to disk."""
        try:
            context.storage_state(path=str(self.state_file))
            print(f"  Saved browser state to: {self.state_file}")
        except Exception as exc:
            print(f"  Failed to save browser state: {exc}")
            raise

    def _save_auth_info(self) -> None:
        """Save authentication metadata."""
        try:
            info = {
                "authenticated_at": time.time(),
                "authenticated_at_iso": time.strftime("%Y-%m-%d %H:%M:%S"),
            }
            with open(self.auth_info_file, "w") as f:
                json.dump(info, f, indent=2)
        except Exception:
            pass

    def clear_auth(self) -> bool:
        """Clear all authentication data."""
        print("Clearing authentication data...")

        try:
            if self.state_file.exists():
                self.state_file.unlink()
                print("  Removed browser state")

            if self.auth_info_file.exists():
                self.auth_info_file.unlink()
                print("  Removed auth info")

            if self.browser_state_dir.exists():
                shutil.rmtree(self.browser_state_dir)
                self.browser_state_dir.mkdir(parents=True, exist_ok=True)
                print("  Cleared browser data")

            return True

        except Exception as exc:
            print(f"  Error clearing auth: {exc}")
            return False

    def re_auth(
        self, headless: bool = False, timeout_minutes: int = 10
    ) -> bool:
        """Clear existing auth and set up fresh authentication."""
        print("Starting re-authentication...")
        self.clear_auth()
        return self.setup_auth(headless, timeout_minutes)

    def validate_auth(self) -> bool:
        """Validate that stored authentication still works."""
        if not self.is_authenticated():
            return False

        print("Validating authentication...")

        playwright = None
        context = None

        try:
            playwright = sync_playwright().start()
            context = BrowserFactory.launch_persistent_context(
                playwright, headless=True
            )

            page = context.new_page()
            page.goto(
                "https://notebooklm.google.com",
                wait_until="domcontentloaded",
                timeout=30000,
            )

            if (
                "notebooklm.google.com" in page.url
                and "accounts.google.com" not in page.url
            ):
                print("  Authentication is valid")
                return True

            print("  Authentication is invalid (redirected to login)")
            return False

        except Exception as exc:
            print(f"  Validation failed: {exc}")
            return False

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


def main() -> None:
    """CLI for authentication management."""
    parser = argparse.ArgumentParser(
        description="Manage NotebookLM authentication"
    )
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    setup_p = subparsers.add_parser("setup", help="Setup authentication")
    setup_p.add_argument(
        "--headless", action="store_true", help="Run in headless mode"
    )
    setup_p.add_argument(
        "--timeout",
        type=float,
        default=10,
        help="Login timeout in minutes (default: 10)",
    )

    subparsers.add_parser("status", help="Check authentication status")
    subparsers.add_parser("validate", help="Validate authentication")
    subparsers.add_parser("clear", help="Clear authentication")

    reauth_p = subparsers.add_parser(
        "reauth", help="Re-authenticate (clear + setup)"
    )
    reauth_p.add_argument(
        "--timeout",
        type=float,
        default=10,
        help="Login timeout in minutes (default: 10)",
    )

    args = parser.parse_args()
    auth = AuthManager()

    if args.command == "setup":
        ok = auth.setup_auth(
            headless=args.headless, timeout_minutes=args.timeout
        )
        if ok:
            print("\nAuthentication setup complete!")
        else:
            print("\nAuthentication setup failed")
            sys.exit(1)

    elif args.command == "status":
        info = auth.get_auth_info()
        print("\nAuthentication Status:")
        print(
            f"  Authenticated: {'Yes' if info['authenticated'] else 'No'}"
        )
        if info.get("state_age_hours"):
            print(f"  State age: {info['state_age_hours']:.1f} hours")
        if info.get("authenticated_at_iso"):
            print(f"  Last auth: {info['authenticated_at_iso']}")
        print(f"  State file: {info['state_file']}")

    elif args.command == "validate":
        if auth.validate_auth():
            print("Authentication is valid and working")
        else:
            print("Authentication is invalid or expired")
            print("Run: auth_manager.py setup")

    elif args.command == "clear":
        if auth.clear_auth():
            print("Authentication cleared")

    elif args.command == "reauth":
        ok = auth.re_auth(timeout_minutes=args.timeout)
        if ok:
            print("\nRe-authentication complete!")
        else:
            print("\nRe-authentication failed")
            sys.exit(1)

    else:
        parser.print_help()


if __name__ == "__main__":
    main()

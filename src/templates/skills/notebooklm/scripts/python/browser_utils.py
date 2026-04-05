"""
Browser utilities for NotebookLM skill.

Handles browser launching, stealth features, and common interactions.
Uses Patchright (Playwright fork with anti-detection patches).
"""

import json
import time
import random
from typing import Optional

from patchright.sync_api import Playwright, BrowserContext, Page

from config import (
    BROWSER_PROFILE_DIR,
    STATE_FILE,
    BROWSER_ARGS,
    USER_AGENT,
    STEALTH_ENABLED,
    TYPING_WPM_MIN,
    TYPING_WPM_MAX,
)


class BrowserFactory:
    """Factory for creating configured browser contexts."""

    @staticmethod
    def launch_persistent_context(
        playwright: Playwright,
        headless: bool = True,
        user_data_dir: str = str(BROWSER_PROFILE_DIR),
    ) -> BrowserContext:
        """Launch a persistent browser context with anti-detection and cookie workaround."""
        context = playwright.chromium.launch_persistent_context(
            user_data_dir=user_data_dir,
            channel="chrome",
            headless=headless,
            no_viewport=True,
            ignore_default_args=["--enable-automation"],
            user_agent=USER_AGENT,
            args=BROWSER_ARGS,
        )

        # Workaround for Playwright bug #36139:
        # Session cookies (expires=-1) don't persist in user_data_dir,
        # so we inject them manually from state.json.
        BrowserFactory._inject_cookies(context)

        return context

    @staticmethod
    def _inject_cookies(context: BrowserContext) -> None:
        """Inject cookies from state.json if available."""
        if not STATE_FILE.exists():
            return
        try:
            with open(STATE_FILE, "r") as f:
                state = json.load(f)
                cookies = state.get("cookies", [])
                if cookies:
                    context.add_cookies(cookies)
        except Exception as exc:
            print(f"  Warning: Could not load state.json: {exc}")


class StealthUtils:
    """Human-like interaction utilities to avoid bot detection."""

    @staticmethod
    def random_delay(min_ms: int = 100, max_ms: int = 500) -> None:
        """Add a random delay in milliseconds."""
        time.sleep(random.uniform(min_ms / 1000, max_ms / 1000))

    @staticmethod
    def human_type(
        page: Page,
        selector: str,
        text: str,
        wpm_min: int = TYPING_WPM_MIN,
        wpm_max: int = TYPING_WPM_MAX,
    ) -> None:
        """Type text with human-like speed variations (or fast if stealth disabled)."""
        element = page.query_selector(selector)
        if not element:
            try:
                element = page.wait_for_selector(selector, timeout=2000)
            except Exception:
                pass

        if not element:
            print(f"  Warning: Element not found for typing: {selector}")
            return

        element.click()

        if not STEALTH_ENABLED:
            element.fill(text)
            return

        # Calculate delay from WPM (average 5 chars per word)
        avg_wpm = (wpm_min + wpm_max) / 2
        base_delay_ms = 60000 / (avg_wpm * 5)

        for char in text:
            delay = random.uniform(
                base_delay_ms * 0.6, base_delay_ms * 1.4
            ) / 1000
            element.type(char, delay=delay * 1000)
            # Occasional pause to mimic human hesitation
            if random.random() < 0.05:
                time.sleep(random.uniform(0.15, 0.4))

    @staticmethod
    def realistic_click(page: Page, selector: str) -> None:
        """Click with realistic mouse movement."""
        element = page.query_selector(selector)
        if not element:
            return

        box = element.bounding_box()
        if box:
            x = box["x"] + box["width"] / 2
            y = box["y"] + box["height"] / 2
            page.mouse.move(x, y, steps=5)

        StealthUtils.random_delay(100, 300)
        element.click()
        StealthUtils.random_delay(100, 300)

    @staticmethod
    def random_mouse_movement(page: Page) -> None:
        """Simulate random mouse movement to appear human."""
        for _ in range(random.randint(1, 3)):
            x = random.randint(100, 800)
            y = random.randint(100, 600)
            page.mouse.move(x, y, steps=random.randint(3, 8))
            StealthUtils.random_delay(50, 200)

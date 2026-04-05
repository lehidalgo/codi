# Authentication Architecture

## Overview

This skill uses a **hybrid authentication approach** combining:

1. **Persistent Browser Profile** (`user_data_dir`) — consistent browser fingerprint across restarts
2. **Manual Cookie Injection** from `state.json` — reliable session cookie persistence

## Why This Approach?

### The Problem

Playwright/Patchright has a known bug ([#36139](https://github.com/microsoft/playwright/issues/36139)) where **session cookies** (cookies without an `Expires` attribute) do not persist when using `launch_persistent_context()` with `user_data_dir`.

- Persistent cookies (with `Expires` date) → saved correctly to browser profile
- Session cookies (without `Expires`) → **lost after browser restarts**

Some Google auth cookies are session cookies. Without them, users experience random authentication failures.

### Python vs TypeScript

The MCP Server (TypeScript) can work around this by passing `storage_state` as a parameter:

```typescript
// TypeScript — works
const context = await chromium.launchPersistentContext(userDataDir, {
  storageState: "state.json",
  channel: "chrome"
});
```

Python's Playwright API does not support `storage_state` with `launch_persistent_context` ([#14949](https://github.com/microsoft/playwright/issues/14949)), so we inject cookies manually.

## Our Solution: Hybrid Approach

### Phase 1: Setup (`auth_manager.py setup`)

1. Launch persistent context with `user_data_dir`
2. User logs in manually
3. Save state to `state.json` via `context.storage_state()`

### Phase 2: Runtime (`ask_question.py`)

1. Launch persistent context with `user_data_dir` (loads fingerprint + persistent cookies)
2. Manually inject cookies from `state.json` (adds session cookies)

```python
# Step 1: Launch with browser profile
context = playwright.chromium.launch_persistent_context(
    user_data_dir="browser_profile/",
    channel="chrome"
)

# Step 2: Inject session cookies from state.json
with open("state.json", "r") as f:
    state = json.load(f)
    context.add_cookies(state["cookies"])
```

## Comparison

| Feature | Our Approach | Pure `user_data_dir` | Pure `storage_state` |
|---------|:------------:|:-------------------:|:-------------------:|
| Browser Fingerprint Consistency | ✓ | ✓ | ✗ |
| Session Cookie Persistence | ✓ (manual inject) | ✗ (bug) | ✓ |
| Persistent Cookie Persistence | ✓ | ✓ | ✓ |
| Google Trust | ✓ (same browser) | ✓ | ✗ (new browser) |
| Cross-platform Reliability | ✓ Chrome required | ⚠ Chromium issues | ✓ |

## File Structure

```
data/
├── auth_info.json                 # Authentication metadata
└── browser_state/
    ├── state.json                 # Cookies + localStorage (manual injection)
    └── browser_profile/           # Chrome user profile
        └── Default/
            ├── Cookies            # Persistent cookies only
            ├── Local Storage/
            └── Cache/
```

## Why `state.json` is Still Needed

Even with `user_data_dir`, `state.json` is required because:
1. Session cookies are not saved to the browser profile (Playwright bug)
2. Manual injection is the only reliable way to load session cookies
3. Cookie validation — check expiry before launching

## Related Issues

- [microsoft/playwright#36139](https://github.com/microsoft/playwright/issues/36139) — session cookies not persisting
- [microsoft/playwright#14949](https://github.com/microsoft/playwright/issues/14949) — storage state with persistent context

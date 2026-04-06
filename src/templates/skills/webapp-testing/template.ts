import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Use when the user wants to test, debug, or automate a local web application using Playwright. Supports verifying frontend functionality, capturing screenshots, and reading browser logs.
category: ${SKILL_CATEGORY.CODE_QUALITY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 9
---

## When to Activate

- User wants to test, verify, or automate a local web application
- User needs a browser screenshot of a running app
- User wants to check browser console logs or network requests
- User needs to interact with UI elements programmatically

# Web Application Testing

To test local web applications, write native Python Playwright scripts.

**Helper Scripts Available** (TypeScript and Python — use whichever runtime is available):
- TypeScript: \\\`\${CLAUDE_SKILL_DIR}[[/scripts/ts/with-server.ts]]\\\` — Manages server lifecycle (supports multiple servers)
- Python: \\\`\${CLAUDE_SKILL_DIR}[[/scripts/python/with_server.py]]\\\` — Same functionality, Python variant

Use TypeScript by default (\\\`npx tsx\\\`). Use Python when \\\`python3\\\` is available and the project prefers it.

**Always run scripts with \\\`--help\\\` first** to see usage. DO NOT read the source until you try running the script first and find that a customized solution is absolutely necessary. These scripts can be very large and thus pollute your context window. They exist to be called directly as black-box scripts rather than ingested into your context window.

## Decision Tree: Choosing Your Approach

\\\`\\\`\\\`
User task → Is it static HTML?
    ├─ Yes → Read HTML file directly to identify selectors
    │         ├─ Success → Write Playwright script using selectors
    │         └─ Fails/Incomplete → Treat as dynamic (below)
    │
    └─ No (dynamic webapp) → Is the server already running?
        ├─ No → Run: npx tsx \${CLAUDE_SKILL_DIR}[[/scripts/ts/with-server.ts]] --help
        │        Then use the helper + write simplified Playwright script
        │
        └─ Yes → Reconnaissance-then-action:
            1. Navigate and wait for networkidle
            2. Take screenshot or inspect DOM
            3. Identify selectors from rendered state
            4. Execute actions with discovered selectors
\\\`\\\`\\\`

## Example: Using with_server.py

To start a server, run \\\`--help\\\` first, then use the helper:

**Single server (TypeScript):**
\\\`\\\`\\\`bash
npx tsx \${CLAUDE_SKILL_DIR}[[/scripts/ts/with-server.ts]] --server "npm run dev" --port 5173 -- node your_automation.js
\\\`\\\`\\\`

**Single server (Python):**
\\\`\\\`\\\`bash
python3 \${CLAUDE_SKILL_DIR}[[/scripts/python/with_server.py]] --server "npm run dev" --port 5173 -- python3 your_automation.py
\\\`\\\`\\\`

**Multiple servers (e.g., backend + frontend):**
\\\`\\\`\\\`bash
npx tsx \${CLAUDE_SKILL_DIR}[[/scripts/ts/with-server.ts]] \\\\
  --server "cd backend && node server.js" --port 3000 \\\\
  --server "cd frontend && npm run dev" --port 5173 \\\\
  -- node your_automation.js
\\\`\\\`\\\`

To create an automation script, include only Playwright logic (servers are managed automatically):
\\\`\\\`\\\`python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True) # Always launch chromium in headless mode
    page = browser.new_page()
    page.goto('http://localhost:5173') # Server already running and ready
    page.wait_for_load_state('networkidle') # CRITICAL: Wait for JS to execute
    # ... your automation logic
    browser.close()
\\\`\\\`\\\`

## Reconnaissance-Then-Action Pattern

1. **Inspect rendered DOM**:
   \\\`\\\`\\\`python
   page.screenshot(path='/tmp/inspect.png', full_page=True)
   content = page.content()
   page.locator('button').all()
   \\\`\\\`\\\`

2. **Identify selectors** from inspection results

3. **Execute actions** using discovered selectors

## Common Pitfall

- **Don't** inspect the DOM before waiting for \\\`networkidle\\\` on dynamic apps
- **Do** wait for \\\`page.wait_for_load_state('networkidle')\\\` before inspection

## Best Practices

- **Use bundled scripts as black boxes** - To accomplish a task, consider whether one of the scripts available in \\\`scripts/\\\` can help. These scripts handle common, complex workflows reliably without cluttering the context window. Use \\\`--help\\\` to see usage, then invoke directly.
- Use \\\`sync_playwright()\\\` for synchronous scripts
- Always close the browser when done
- Use descriptive selectors: \\\`text=\\\`, \\\`role=\\\`, CSS selectors, or IDs
- Add appropriate waits: \\\`page.wait_for_selector()\\\` or \\\`page.wait_for_timeout()\\\`

## Reference Files

- **references/** - Examples showing common patterns:
  - \\\`\${CLAUDE_SKILL_DIR}[[/references/element_discovery.py]]\\\` - Discovering buttons, links, and inputs on a page
  - \\\`\${CLAUDE_SKILL_DIR}[[/references/static_html_automation.py]]\\\` - Using file:// URLs for local HTML
  - \\\`\${CLAUDE_SKILL_DIR}[[/references/console_logging.py]]\\\` - Capturing console logs during automation

## Available Agents

For test generation from webapp testing results, delegate to these agents (see \\\`agents/\\\` directory):
- **${PROJECT_NAME}-test-generator** — Generate automated tests from webapp testing findings
`;

import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Google NotebookLM research assistant with browser automation. Use when the user wants to query NotebookLM notebooks, manage a notebook library, authenticate with Google, generate Audio Overviews (podcasts), or get source-grounded answers from uploaded documents. Also activate when the user mentions NotebookLM, shares a NotebookLM URL, or uses phrases like "ask my docs", "check my notebook", "query my documentation".
category: ${SKILL_CATEGORY.PRODUCTIVITY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 9
---

# {{name}} — NotebookLM Research Assistant

Query Google NotebookLM notebooks for source-grounded, citation-backed answers. Each question opens a fresh browser session, retrieves the answer from uploaded documents only, and closes. Uses Patchright (Playwright fork with anti-detection) for reliable browser automation.

## When to Activate

- User mentions NotebookLM or shares a NotebookLM URL (\\\`https://notebooklm.google.com/notebook/...\\\`)
- User asks to query notebooks or documentation
- User wants to add documentation to the NotebookLM library
- User wants to generate Audio Overviews, study guides, FAQs, or other outputs
- User uses phrases like "ask my NotebookLM", "check my docs", "query my notebook"

## Critical: Always Use run.py Wrapper

**NEVER call scripts directly. ALWAYS use \\\`python \${CLAUDE_SKILL_DIR}[[/scripts/python/run.py]]\\\`:**

\\\`\\\`\\\`bash
# CORRECT — always use run.py:
python \${CLAUDE_SKILL_DIR}[[/scripts/python/run.py]] auth_manager.py status
python \${CLAUDE_SKILL_DIR}[[/scripts/python/run.py]] notebook_manager.py list
python \${CLAUDE_SKILL_DIR}[[/scripts/python/run.py]] ask_question.py --question "..."

# WRONG — never call directly:
python \${CLAUDE_SKILL_DIR}[[/scripts/python/auth_manager.py]] status  # Fails without venv!
\\\`\\\`\\\`

The \\\`run.py\\\` wrapper creates \\\`.venv\\\` if needed, installs dependencies, and runs scripts in the correct environment.

## Decision Flow

\\\`\\\`\\\`
User mentions NotebookLM
    |
    v
Check auth --> python run.py auth_manager.py status
    |
    v
If not authenticated --> python run.py auth_manager.py setup
    |
    v
Check/Add notebook --> python run.py notebook_manager.py list/add
    |
    v
Activate notebook --> python run.py notebook_manager.py activate --id ID
    |
    v
Ask question --> python run.py ask_question.py --question "..."
    |
    v
See follow-up reminder --> Ask follow-ups until information is complete
    |
    v
Synthesize all answers and respond to user
\\\`\\\`\\\`

## Core Workflow

### Step 1: Check Authentication Status

\\\`\\\`\\\`bash
python \${CLAUDE_SKILL_DIR}[[/scripts/python/run.py]] auth_manager.py status
\\\`\\\`\\\`

If not authenticated, proceed to setup.

### Step 2: Authenticate (One-Time Setup)

\\\`\\\`\\\`bash
# Browser opens VISIBLE for manual Google login
python \${CLAUDE_SKILL_DIR}[[/scripts/python/run.py]] auth_manager.py setup
\\\`\\\`\\\`

Tell the user: "A browser window will open for Google login. Sign in to your Google account."

- Browser is VISIBLE for authentication (not headless)
- User must manually log in to Google
- Auth state persists via browser profile + cookie injection (handles Playwright session cookie bug)
- Re-authenticate if needed: \\\`auth_manager.py reauth\\\`

### Step 3: Manage Notebook Library

\\\`\\\`\\\`bash
# List all notebooks
python \${CLAUDE_SKILL_DIR}[[/scripts/python/run.py]] notebook_manager.py list

# Add notebook — ALL parameters are REQUIRED
python \${CLAUDE_SKILL_DIR}[[/scripts/python/run.py]] notebook_manager.py add \\
  --url "https://notebooklm.google.com/notebook/..." \\
  --name "Descriptive Name" \\
  --description "What this notebook contains" \\
  --topics "topic1,topic2,topic3"

# Search notebooks by topic
python \${CLAUDE_SKILL_DIR}[[/scripts/python/run.py]] notebook_manager.py search --query "keyword"

# Set active notebook
python \${CLAUDE_SKILL_DIR}[[/scripts/python/run.py]] notebook_manager.py activate --id notebook-id

# Remove notebook
python \${CLAUDE_SKILL_DIR}[[/scripts/python/run.py]] notebook_manager.py remove --id notebook-id

# Library statistics
python \${CLAUDE_SKILL_DIR}[[/scripts/python/run.py]] notebook_manager.py stats
\\\`\\\`\\\`

### Smart Add (Recommended)

When the user wants to add a notebook without providing details, query it first to discover content:

\\\`\\\`\\\`bash
# Step 1: Query the notebook about its content
python \${CLAUDE_SKILL_DIR}[[/scripts/python/run.py]] ask_question.py \\
  --question "What is the content of this notebook? What topics are covered? Provide a brief overview." \\
  --notebook-url "[URL]"

# Step 2: Use the discovered information to add it
python \${CLAUDE_SKILL_DIR}[[/scripts/python/run.py]] notebook_manager.py add \\
  --url "[URL]" --name "[Based on content]" \\
  --description "[Based on content]" --topics "[Based on content]"
\\\`\\\`\\\`

NEVER guess or use generic descriptions. If details are missing, use Smart Add to discover them.

### Step 4: Ask Questions

\\\`\\\`\\\`bash
# Basic query (uses active notebook if set)
python \${CLAUDE_SKILL_DIR}[[/scripts/python/run.py]] ask_question.py --question "Your question here"

# Query specific notebook by ID
python \${CLAUDE_SKILL_DIR}[[/scripts/python/run.py]] ask_question.py --question "..." --notebook-id notebook-id

# Query with notebook URL directly
python \${CLAUDE_SKILL_DIR}[[/scripts/python/run.py]] ask_question.py --question "..." --notebook-url "https://..."

# Show browser for debugging
python \${CLAUDE_SKILL_DIR}[[/scripts/python/run.py]] ask_question.py --question "..." --show-browser
\\\`\\\`\\\`

## Follow-Up Mechanism (Critical)

Every NotebookLM answer ends with a follow-up reminder. When you receive it:

1. **STOP** — do not immediately respond to the user
2. **ANALYZE** — compare the answer to the user's original request
3. **IDENTIFY GAPS** — check if more information is needed
4. **ASK FOLLOW-UP** — if gaps exist, ask another question with full context (each question opens a new browser session, so include all necessary context)
5. **REPEAT** — continue until information is complete
6. **SYNTHESIZE** — combine all answers into a comprehensive response before presenting to the user

## Script Reference

### Authentication (\\\`auth_manager.py\\\`)
\\\`\\\`\\\`bash
python run.py auth_manager.py setup     # Initial setup (browser visible)
python run.py auth_manager.py status    # Check authentication
python run.py auth_manager.py reauth    # Re-authenticate (browser visible)
python run.py auth_manager.py validate  # Validate auth works
python run.py auth_manager.py clear     # Clear authentication
\\\`\\\`\\\`

### Notebook Library (\\\`notebook_manager.py\\\`)
\\\`\\\`\\\`bash
python run.py notebook_manager.py add --url URL --name NAME --description DESC --topics TOPICS
python run.py notebook_manager.py list
python run.py notebook_manager.py search --query QUERY
python run.py notebook_manager.py activate --id ID
python run.py notebook_manager.py remove --id ID
python run.py notebook_manager.py stats
\\\`\\\`\\\`

### Questions (\\\`ask_question.py\\\`)
\\\`\\\`\\\`bash
python run.py ask_question.py --question "..." [--notebook-id ID] [--notebook-url URL] [--show-browser]
\\\`\\\`\\\`

### Cleanup (\\\`cleanup_manager.py\\\`)
\\\`\\\`\\\`bash
python run.py cleanup_manager.py                     # Preview cleanup
python run.py cleanup_manager.py --confirm           # Execute cleanup
python run.py cleanup_manager.py --preserve-library  # Keep notebooks
\\\`\\\`\\\`

## Environment Management

The virtual environment is automatically managed by \\\`run.py\\\`:
- First run creates \\\`.venv\\\` in the skill directory
- Dependencies install automatically (patchright, python-dotenv)
- Chromium browser installs automatically via patchright
- Everything is isolated in the skill directory

## Data Storage

All data stored in \\\`\${CLAUDE_SKILL_DIR}/data/\\\`:
- \\\`library.json\\\` — notebook metadata and library
- \\\`auth_info.json\\\` — authentication status
- \\\`browser_state/\\\` — browser cookies, session, and profile

Protected by \\\`.gitignore\\\` — never commit to git.

## Configuration

Copy \\\`\${CLAUDE_SKILL_DIR}[[/scripts/.env.example]]\\\` to the skill root as \\\`.env\\\` and adjust:

\\\`\\\`\\\`bash
cp \${CLAUDE_SKILL_DIR}[[/scripts/.env.example]] \${CLAUDE_SKILL_DIR}/.env
\\\`\\\`\\\`

Available settings (all optional):

\\\`\\\`\\\`env
HEADLESS=true            # Run browser in headless mode
SHOW_BROWSER=false       # Always show browser window (overrides HEADLESS)
STEALTH_ENABLED=true     # Human-like typing behavior
TYPING_WPM_MIN=160       # Typing speed range (words per minute)
TYPING_WPM_MAX=240
DEFAULT_NOTEBOOK_ID=     # Default notebook when none is specified
\\\`\\\`\\\`

## Troubleshooting

| Problem | Solution |
|---------|----------|
| ModuleNotFoundError | Use \\\`run.py\\\` wrapper — never call scripts directly |
| Authentication fails | Browser must be visible for setup: \\\`auth_manager.py setup\\\` |
| Rate limit (50/day) | Wait or switch Google account |
| Browser crashes | \\\`cleanup_manager.py --preserve-library\\\` then retry |
| Notebook not found | Check with \\\`notebook_manager.py list\\\` |
| Timeout waiting for answer | Use \\\`--show-browser\\\` to debug, check notebook has sources |
| State expired (7+ days) | Run \\\`auth_manager.py reauth\\\` |

For detailed troubleshooting, read \\\`\${CLAUDE_SKILL_DIR}[[/references/troubleshooting.md]]\\\`.

## Limitations

- No session persistence (each question = new browser session)
- Rate limits on free Google accounts (~50 queries/day)
- User must add documents to NotebookLM manually (the skill queries, not uploads)
- Browser overhead (few seconds per question)
- Audio Overview generation requires browser-based interaction (not scriptable)

## Resources

- \\\`\${CLAUDE_SKILL_DIR}[[/references/api_reference.md]]\\\` — detailed API docs for all scripts
- \\\`\${CLAUDE_SKILL_DIR}[[/references/troubleshooting.md]]\\\` — common issues and solutions
- \\\`\${CLAUDE_SKILL_DIR}[[/references/usage_patterns.md]]\\\` — workflow examples and best practices
- \\\`\${CLAUDE_SKILL_DIR}[[/references/authentication.md]]\\\` — hybrid auth architecture explanation
`;

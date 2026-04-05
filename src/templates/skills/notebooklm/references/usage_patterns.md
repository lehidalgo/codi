# Usage Patterns

Common workflows and best practices for the NotebookLM skill.

## Initial Setup

First-time setup to connect the skill to your NotebookLM:

```bash
# 1. Check auth
python run.py auth_manager.py status

# 2. Authenticate if needed (browser will open)
python run.py auth_manager.py setup

# 3. Add your first notebook (Smart Add recommended)
python run.py ask_question.py \
  --question "What is the content of this notebook? What topics are covered?" \
  --notebook-url "https://notebooklm.google.com/notebook/YOUR-ID"

# 4. Use the discovered info to register the notebook
python run.py notebook_manager.py add \
  --url "https://notebooklm.google.com/notebook/YOUR-ID" \
  --name "API Documentation" \
  --description "REST API docs, endpoints, auth, error codes" \
  --topics "api,rest,authentication,errors"

# 5. Ask a question
python run.py ask_question.py --question "How do I authenticate with the API?"
```

---

## Smart Notebook Discovery

When adding a notebook without knowing its contents:

```bash
# Step 1: Query to discover content
python run.py ask_question.py \
  --question "What is the content of this notebook? What topics are covered? Provide a brief overview." \
  --notebook-url "https://notebooklm.google.com/notebook/..."

# Step 2: Use the response to fill metadata
python run.py notebook_manager.py add \
  --url "..." \
  --name "Discovered Name" \
  --description "Discovered description from answer" \
  --topics "discovered,topics,from,answer"
```

NEVER guess metadata. If you don't know what a notebook contains, use Smart Add first.

---

## Daily Research Workflow

```bash
# Morning: Check library and auth
python run.py auth_manager.py status
python run.py notebook_manager.py list

# Activate relevant notebook
python run.py notebook_manager.py activate --id my-notebook

# Ask questions throughout the day
python run.py ask_question.py --question "What does the spec say about error handling?"
python run.py ask_question.py --question "Are there any rate limit considerations I missed?"
```

---

## Multi-Notebook Research

Use the library to switch between notebooks for cross-document research:

```bash
# Query multiple notebooks on the same topic
python run.py ask_question.py \
  --question "What authentication methods are supported?" \
  --notebook-id api-docs

python run.py ask_question.py \
  --question "What authentication methods are mentioned?" \
  --notebook-id architecture-decisions

# Then synthesize both answers into a complete response
```

---

## Follow-Up Questions Pattern

Each question opens a fresh browser session with no memory of previous questions. Include full context in follow-ups:

```bash
# Initial question
python run.py ask_question.py \
  --question "How does the payment flow work?" \
  --notebook-id payments-spec

# Follow-up — include context from previous answer
python run.py ask_question.py \
  --question "The payment flow uses Stripe webhooks for confirmation. \
What are the retry policies and failure modes described in the spec?" \
  --notebook-id payments-spec
```

---

## Debugging with Visible Browser

Show the browser to diagnose issues:

```bash
python run.py ask_question.py \
  --question "Test question" \
  --notebook-id my-notebook \
  --show-browser
```

Useful when:
- Getting timeouts (check if NotebookLM shows an error)
- Query input not found (identify current selector)
- Auth appears to work but queries fail

---

## Library Organization

Keep notebooks organized with descriptive metadata:

```bash
# Good: descriptive name, specific topics
python run.py notebook_manager.py add \
  --url "..." \
  --name "Payment Service API v2" \
  --description "REST API docs for payment processing: webhooks, refunds, subscriptions" \
  --topics "payments,api,webhooks,refunds,subscriptions,stripe"

# Bad: generic name, vague topics
python run.py notebook_manager.py add \
  --url "..." \
  --name "Docs" \
  --description "Some docs" \
  --topics "stuff"
```

Search is based on name, description, topics, and tags — quality metadata improves discoverability.

---

## Error Recovery

When a query fails mid-session:

```bash
# 1. Check auth is still valid
python run.py auth_manager.py validate

# 2. If invalid, re-auth
python run.py auth_manager.py reauth

# 3. Retry the question
python run.py ask_question.py --question "..." --notebook-id ...

# 4. If browser is crashing, clean and restart
python run.py cleanup_manager.py --preserve-library --confirm
python run.py auth_manager.py setup
```

---

## Integration with Agent Workflows

When the agent needs grounded answers for a task:

1. Check if a relevant notebook exists: `notebook_manager.py search --query "topic"`
2. If not found, ask the user for a NotebookLM URL and use Smart Add
3. Query the notebook with a precise question covering all needed context
4. Evaluate the follow-up reminder and ask additional questions if gaps exist
5. Synthesize all answers before responding to the user

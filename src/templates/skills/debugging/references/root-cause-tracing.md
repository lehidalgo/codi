# Root Cause Tracing — Backward Through the Call Stack

## Overview

Bugs often appear deep in the call stack. Your instinct is to fix where the error appears, but that treats a symptom. The error location is where the problem became visible, not where it started.

**Core principle:** Trace backward through the call chain until you find the original trigger, then fix at the source.

## When to Use

Use when:
- The error happens deep in execution, not at the entry point
- The stack trace shows a long call chain
- It is unclear where invalid data originated
- You need to find which test or code path triggers the problem

## The Tracing Process

### Step 1: Observe the Symptom

Start at the error location. Read the error message and stack trace completely.

```
Error: git init failed in /Users/project/packages/core
```

### Step 2: Find the Immediate Cause

What code directly causes this?

```typescript
await execFileAsync('git', ['init'], { cwd: projectDir });
```

### Step 3: Ask "What Called This With the Wrong Value?"

Trace one level up the call chain.

```typescript
WorktreeManager.createSessionWorktree(projectDir, sessionId)
  → called by Session.initializeWorkspace()
  → called by Session.create()
  → called by test at Project.create()
```

### Step 4: Keep Tracing Up

What value was passed at each level?
- `projectDir = ''` (empty string)
- Empty string as `cwd` resolves to `process.cwd()`
- That resolves to the source code directory

### Step 5: Find the Original Trigger

Where did the empty string come from?

```typescript
const context = setupCoreTest(); // Returns { tempDir: '' }
Project.create('name', context.tempDir); // Accessed before beforeEach!
```

Root cause: top-level variable initialization accessing an empty value before `beforeEach` runs.

### Step 6: Fix at the Source

Fix where the bad value originates, not where the error appears. Then add defense-in-depth validation at each layer the data passes through (see `defense-in-depth.md`).

## Check: Was the Value Always Wrong or Corrupted in Transit?

Ask at each step:
- Was this value correct at the previous level?
- If yes: the corruption happened between those two levels
- If no: keep tracing up

This narrows the search to the exact location where the bug was introduced.

## Adding Instrumentation When You Cannot Trace Manually

When the call chain is too complex to trace by reading code, add instrumentation before the problematic operation:

```typescript
async function gitInit(directory: string) {
  const stack = new Error().stack;
  console.error('DEBUG git init:', {
    directory,
    cwd: process.cwd(),
    nodeEnv: process.env.NODE_ENV,
    stack,
  });
  await execFileAsync('git', ['init'], { cwd: directory });
}
```

Run the code and capture output:

```bash
npm test 2>&1 | grep 'DEBUG git init'
```

Analyze the stack traces to find which test file and which line number triggers the call.

## Finding Which Test Causes State Pollution

If something appears during tests but you do not know which test causes it:

1. Run tests one by one in isolation
2. Stop at the first test that causes the problem
3. That test is the polluter

```bash
# Run a single test file to isolate
npx vitest run src/path/to/specific.test.ts
```

## Using git blame

When you know WHAT is wrong but not WHEN it was introduced:

```bash
git blame src/path/to/file.ts
git log --oneline src/path/to/file.ts
git show <commit-hash>
```

This shows which commit introduced the problematic line.

## Key Principle

**NEVER fix just where the error appears.** Trace back to find the original trigger. Then fix at the source. Then add validation at each layer so the bug becomes structurally impossible.

## Tips

- Use `console.error()` in tests, not logger - logger may be suppressed
- Log before the dangerous operation, not after it fails
- Include context: directory, cwd, environment variables, timestamps
- Capture the call stack with `new Error().stack`

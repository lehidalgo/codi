# Defense in Depth — Validation at Multiple Layers

## Overview

After finding the root cause of a bug, fixing it at the source is necessary but not sufficient. That single fix can be bypassed by different code paths, future refactoring, or mocks in tests.

**Core principle:** After fixing the root cause, add validation at every layer the data passes through. Make the bug structurally impossible.

## Single Fix vs. Multiple Layers

Single fix: "We fixed the bug."
Multiple layers: "We made the bug impossible."

Different layers catch different cases:
- Entry validation catches most bugs at the boundary
- Business logic validation catches edge cases inside the module
- Environment guards prevent context-specific dangers (e.g., in tests)
- Debug instrumentation helps investigate when other layers fail

## The Four Layers

### Layer 1: Entry Point Validation

Reject obviously invalid input at the API boundary.

```typescript
function createProject(name: string, workingDirectory: string) {
  if (!workingDirectory || workingDirectory.trim() === '') {
    throw new Error('workingDirectory cannot be empty');
  }
  if (!existsSync(workingDirectory)) {
    throw new Error(`workingDirectory does not exist: ${workingDirectory}`);
  }
  if (!statSync(workingDirectory).isDirectory()) {
    throw new Error(`workingDirectory is not a directory: ${workingDirectory}`);
  }
  // proceed
}
```

### Layer 2: Business Logic Validation

Check that data makes sense for this specific operation.

```typescript
function initializeWorkspace(projectDir: string, sessionId: string) {
  if (!projectDir) {
    throw new Error('projectDir required for workspace initialization');
  }
  // proceed
}
```

### Layer 3: Environment Guards

Prevent dangerous operations in specific contexts, such as tests.

```typescript
async function gitInit(directory: string) {
  if (process.env.NODE_ENV === 'test') {
    const normalized = normalize(resolve(directory));
    const tmpDir = normalize(resolve(tmpdir()));
    if (!normalized.startsWith(tmpDir)) {
      throw new Error(
        `Refusing git init outside temp dir during tests: ${directory}`
      );
    }
  }
  // proceed
}
```

### Layer 4: Debug Instrumentation

Capture context for forensic analysis when the other layers fail.

```typescript
async function gitInit(directory: string) {
  logger.debug('About to git init', {
    directory,
    cwd: process.cwd(),
    stack: new Error().stack,
  });
  // proceed
}
```

## Applying the Pattern

After you find and fix a bug:

1. Map the data flow: where does the value originate and where is it used?
2. List every checkpoint the data passes through
3. Add validation at each layer: entry, business logic, environment, debug
4. Write tests that attempt to bypass each layer

## When to Add Each Layer

Add Layer 1 when: the bug can enter from external callers or other modules.
Add Layer 2 when: the data has specific requirements for the current operation.
Add Layer 3 when: certain operations are dangerous in specific environments (e.g., file system writes in tests).
Add Layer 4 when: the bug is hard to reproduce and you need forensic data.

## Never Trust Data From External Sources

- User input: always validate shape, type, and range
- API responses: validate against a schema before using
- Database results: validate before passing to business logic
- Environment variables: validate at startup, not at usage

## Key Insight

Do not stop at one validation point. During testing, each layer catches bugs that the others miss:
- Different code paths bypass entry validation
- Mocks bypass business logic checks
- Edge cases on different platforms need environment guards
- Debug logging identifies structural misuse that tests do not cover

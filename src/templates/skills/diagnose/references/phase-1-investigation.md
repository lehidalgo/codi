# Phase 1 — Root cause investigation

BEFORE attempting ANY fix.

## 1. Read error messages carefully

- Don't skip past errors or warnings.
- They often contain the exact solution.
- Read stack traces completely.
- Note line numbers, file paths, error codes.

## 2. Reproduce consistently

- Can you trigger it reliably?
- What are the exact steps?
- Does it happen every time?
- If not reproducible → gather more data, do NOT guess.

## 3. Check recent changes

- What changed that could cause this?
- `git diff`, recent commits.
- New dependencies, config changes.
- Environmental differences.

## 4. Gather evidence in multi-component systems

When the system has multiple components (CI → build → signing, API → service → database):

BEFORE proposing fixes, add diagnostic instrumentation at every component boundary:

```
For EACH component boundary:
  - Log what data enters component
  - Log what data exits component
  - Verify environment/config propagation
  - Check state at each layer

Run once to gather evidence showing WHERE it breaks
THEN analyze evidence to identify failing component
THEN investigate that specific component
```

### Example (multi-layer system)

```bash
# Layer 1: Workflow
echo "=== Secrets available in workflow: ==="
echo "IDENTITY: ${IDENTITY:+SET}${IDENTITY:-UNSET}"

# Layer 2: Build script
echo "=== Env vars in build script: ==="
env | grep IDENTITY || echo "IDENTITY not in environment"

# Layer 3: Signing script
echo "=== Keychain state: ==="
security list-keychains
security find-identity -v

# Layer 4: Actual signing
codesign --sign "$IDENTITY" --verbose=4 "$APP"
```

This reveals which layer fails (e.g., secrets → workflow ✓, workflow → build ✗).

## 5. Trace data flow

When the error is deep in the call stack:

- Where does the bad value originate?
- What called this with a bad value?
- Keep tracing UP until you find the source.
- Fix at the source, NOT at the symptom.

## Exit criterion

You may proceed to Phase 2 only when:

- [ ] You can describe the failure in plain language without using "probably" or "maybe".
- [ ] You have a deterministic repro (or high reproduction rate for non-deterministic).
- [ ] You have data showing WHERE it breaks (which component, which layer, which line).

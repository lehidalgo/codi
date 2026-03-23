# CI Integration

**Date**: 2026-03-23
**Document**: ci-integration.md

## GitHub Actions

Add codi health checks to your CI pipeline.

### Basic: Doctor Check

```yaml
- name: Codi health check
  run: npx codi doctor --ci
```

This checks:
- Config directory is valid
- Codi version matches `requiredVersion`
- Generated files are not stale (drift detection)
- Org/team configs are valid (if referenced)

Exit code 0 = all checks pass. Non-zero = at least one failure.

### Full: Compliance Report

```yaml
- name: Codi compliance
  run: npx codi compliance --ci --json
```

This combines doctor, status, and verification into a single structured report. Use `--json` for machine-readable output.

### Pre-commit Hook

If `requiredVersion` is set in `codi.yaml`, `codi init` auto-installs a pre-commit hook that runs `codi doctor --ci` before each commit.

### Recommended CI Workflow

```yaml
name: Codi Compliance
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx codi doctor --ci
      - run: npx codi status --json
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed |
| 1 | General error |
| 2 | Config invalid |
| 3 | Config not found |
| 7 | Drift detected |
| 9 | Doctor check failed |
| 12 | Verification mismatch |

## Using Compliance in CI

The `codi compliance` command produces a combined report with:

- Config validity
- Version match status
- Drift detection results
- Rule, skill, agent, and flag counts
- Verification token
- Generation age

In `--ci` mode, any failure causes a non-zero exit code. In `--json` mode, the full report is emitted as structured JSON for integration with other tools.

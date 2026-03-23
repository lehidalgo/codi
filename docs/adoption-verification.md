# Adoption Verification

**Date**: 2026-03-23
**Document**: adoption-verification.md

How to verify that codi configuration is actually being used by team members.

## What Codi Can Verify

| Signal | Mechanism | Reliability |
|--------|-----------|-------------|
| Config files exist and are current | `codi doctor` | High |
| Generated files have not drifted | `codi status` | High |
| Agent can report verification token | `codi verify` | Medium |
| Pre-commit hooks are installed | `codi doctor --ci` | High |

## What Codi Cannot Verify

- Whether the AI agent actually follows the rules
- Whether the agent uses configured skills
- Whether the agent delegates to configured agents

These are agent-side behaviors that codi cannot enforce -- only advise.

## Verification Workflow

### For individual developers

1. `codi doctor` -- check config health
2. `codi verify` -- get token and prompt
3. Ask your agent: "verify codi"
4. `codi verify --check "<response>"` -- validate

### For CI/CD

1. Add `npx codi doctor --ci` to your pipeline
2. Use `npx codi compliance --ci` for full report

### For team leads

1. Require `codi doctor --ci` in CI
2. Review `.codi/audit.jsonl` for generation/update history
3. Run `codi compliance` to get adoption summary

## Token System

The verification token is a SHA-256 hash of:

- Project name and configured agents
- Rule names AND content
- Skill and agent names
- Active flag instructions

Token format: `codi-{12 hex chars}`

The token changes whenever any rule content, flag, skill, or agent changes.

## Audit Log

Every `codi generate` and `codi update` writes an entry to `.codi/audit.jsonl`. Each line is a JSON object with:

- `type`: the operation performed (`generate`, `update`, `clean`, `init`)
- `timestamp`: ISO 8601 timestamp
- `details`: operation-specific data (files generated, flags updated, etc.)

This provides an append-only history of configuration changes for review.

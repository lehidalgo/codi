# Team Sync

Share rules and skills with your team through a shared config repository.

## Setup

Add sync configuration to your `codi.yaml`:

```yaml
# codi.yaml
sync:
  repo: "org/team-codi-config"   # GitHub repository
  branch: main                    # Target branch
  paths: [rules, skills]          # What to sync
```

## Usage

```bash
# Preview what would be synced
codi sync --dry-run

# Sync and create a pull request
codi sync

# With a custom PR message
codi sync -m "Add security rules from project-x"
```

## How It Works

1. Clones the team repository (shallow clone)
2. Creates a feature branch with timestamp
3. Copies specified paths from local `.codi/` to the repo
4. Detects changes via hash comparison — only modified files are synced
5. Commits and pushes the changes
6. Creates a pull request via `gh` CLI
7. Returns the PR URL

## Requirements

**Requires** the [GitHub CLI](https://cli.github.com/) (`gh`) to be installed and authenticated. Only `.md` files are synced. Currently GitHub-only.

## Limitations

- Only `.md` files are synced
- GitHub-only (requires `gh` CLI authenticated)
- No merge strategy — overwrites target files
- Shallow clone — no history preserved
- Non-idempotent: running twice creates duplicate PRs

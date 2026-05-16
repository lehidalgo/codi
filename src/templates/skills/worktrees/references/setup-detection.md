# Project setup auto-detection

Run the appropriate setup command after creating the worktree. Detect from lock files and manifests; do NOT hardcode.

## Detector table (priority order)

| Detector                      | Command                              | Rationale                                         |
| ----------------------------- | ------------------------------------ | ------------------------------------------------- |
| `pnpm-lock.yaml`              | `pnpm install`                       | Default JS manager per codi conventions           |
| `package-lock.json`           | `npm ci`                             | Reproducible install via lockfile                 |
| `yarn.lock`                   | `yarn install --frozen-lockfile`     | Reproducible install via lockfile                 |
| `pyproject.toml` + `uv.lock`  | `uv sync`                            | Lockfile-pinned environment                       |
| `pyproject.toml` (no uv.lock) | `uv sync`                            | Codi convention: never use `pip install` directly |
| `requirements.txt`            | `uv pip install -r requirements.txt` | Same convention; uv as pip wrapper                |
| `Cargo.toml`                  | `cargo build`                        | Triggers dependency download + compile            |
| `go.mod`                      | `go mod download`                    | Dependencies only; no build needed                |

## JS-package-manager rule

Never mix JS package managers within a single project. If multiple lock files coexist (`pnpm-lock.yaml` + `package-lock.json`):

1. Prefer `pnpm-lock.yaml` (codi convention).
2. Warn the user about the mixed state — it indicates a previous developer ran the wrong manager.
3. Do not delete the other lock file unilaterally; let the user decide whether to clean up.

## Sample worktree creation script

```bash
project=$(basename "$(git rev-parse --show-toplevel)")

# Detect GitHub user (priority: gh -> git config -> email -> ask)
gh_user=$(gh api user --jq .login 2>/dev/null \
  || git config --get codi.githubUser \
  || git config --get user.email | sed -n 's/@.*//p' \
  || true)
if [ -z "$gh_user" ]; then
  echo "Could not detect GitHub user. Run: git config codi.githubUser <username>" >&2
  exit 1
fi

# Branch follows <gh-user>/<workflow-type>/<workflow-id>-<slug>
BRANCH_NAME="$gh_user/$WORKFLOW_TYPE/$WORKFLOW_ID-$SLUG"

case $LOCATION in
  .worktrees|worktrees) path="$LOCATION/$BRANCH_NAME" ;;
  ~/.config/codi/worktrees/*) path="~/.config/codi/worktrees/$project/$BRANCH_NAME" ;;
esac
git worktree add "$path" -b "$BRANCH_NAME"
cd "$path"

# Detect and run the appropriate setup
if [ -f pnpm-lock.yaml ]; then pnpm install
elif [ -f package-lock.json ]; then npm ci
elif [ -f yarn.lock ]; then yarn install --frozen-lockfile
elif [ -f pyproject.toml ]; then uv sync
elif [ -f requirements.txt ]; then uv pip install -r requirements.txt
elif [ -f Cargo.toml ]; then cargo build
elif [ -f go.mod ]; then go mod download
else echo "No detector matched — skipping dependency install"
fi
```

## Baseline test commands by stack

After setup, run the project's test suite:

```bash
# JS/TS
pnpm test            # or pnpm run validate, pnpm run check
# Python
uv run pytest
# Rust
cargo test
# Go
go test ./...
```

If tests fail: stop and report. Never proceed silently — new bugs become indistinguishable from pre-existing failures.

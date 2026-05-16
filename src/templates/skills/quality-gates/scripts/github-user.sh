#!/usr/bin/env bash
# github-user.sh — detect the GitHub user once, save to git config codi.githubUser.
# Priority: gh CLI -> saved git config -> parsed email -> ask user.

set -eu

gh_user=""

# 1. gh CLI authenticated
if command -v gh > /dev/null 2>&1 && gh auth status > /dev/null 2>&1; then
  gh_user=$(gh api user --jq .login 2>/dev/null || true)
fi

# 2. previously saved
if [ -z "$gh_user" ]; then
  gh_user=$(git config --get codi.githubUser 2>/dev/null || true)
fi

# 3. parse from email (e.g. laht@github.com -> laht)
if [ -z "$gh_user" ]; then
  email=$(git config --get user.email 2>/dev/null || true)
  if echo "$email" | grep -qE '^[A-Za-z0-9._-]+@'; then
    derived=$(echo "$email" | sed 's/@.*//' | tr '[:upper:]' '[:lower:]')
    if [ -t 0 ] && [ -t 1 ]; then
      printf "Detected GitHub user from email: %s. Use this? [Y/n] " "$derived" >&2
      read -r answer
      case "$answer" in
        ""|[Yy]*) gh_user="$derived" ;;
      esac
    else
      # Non-interactive — accept the derived value but warn
      echo "[github-user] WARN: using email-derived username '$derived' (non-interactive)" >&2
      gh_user="$derived"
    fi
  fi
fi

# 4. ask once
if [ -z "$gh_user" ]; then
  if [ -t 0 ] && [ -t 1 ]; then
    printf "GitHub username (will be saved to git config codi.githubUser): " >&2
    read -r gh_user
  else
    echo "[github-user] ERROR: cannot detect GitHub user non-interactively" >&2
    echo "  Set manually: git config codi.githubUser <username>" >&2
    exit 1
  fi
fi

if [ -z "$gh_user" ]; then
  echo "[github-user] ERROR: no GitHub user provided" >&2
  exit 1
fi

git config codi.githubUser "$gh_user"
echo "$gh_user"

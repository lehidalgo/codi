#!/usr/bin/env bash
#
# Codi installer
#   curl -fsSL https://lehidalgo.github.io/codi/install.sh | bash
#
# Source: https://github.com/lehidalgo/codi/blob/main/site/install.sh
# Spec:   docs/20260424_1327_SPEC_curl-installer.md
#
# Environment overrides:
#   CODI_VERSION         Codi version to install (default: latest)
#   CODI_NODE_MIN_MAJOR  Lowest accepted Node major (default: 20)
#   CODI_NODE_VERSION    Node major to install via nvm if upgrade needed (default: 24, latest LTS)
#   CODI_INSTALL_NVM     Set 0 to refuse nvm install (default: 1)
#   CODI_DRY_RUN         Set 1 to print actions without executing (default: 0)
#   CODI_NO_COLOR        Set 1 to disable ANSI colors (default: auto-detect TTY)
#
# Exit codes:
#   0   ok            10  unsupported OS               13  npm install failed
#   1   generic       11  Node too old (below min)     14  verify failed
#                     12  npm prefix root-owned, user opted out

set -euo pipefail
IFS=$'\n\t'

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

readonly CODI_VERSION="${CODI_VERSION:-latest}"
readonly CODI_NODE_MIN_MAJOR="${CODI_NODE_MIN_MAJOR:-20}"
readonly CODI_NODE_VERSION="${CODI_NODE_VERSION:-24}"
readonly CODI_INSTALL_NVM="${CODI_INSTALL_NVM:-1}"
readonly CODI_DRY_RUN="${CODI_DRY_RUN:-0}"
readonly CODI_NO_COLOR="${CODI_NO_COLOR:-0}"

readonly CODI_NVM_VERSION="v0.40.4"
readonly NVM_INSTALL_URL="https://raw.githubusercontent.com/nvm-sh/nvm/${CODI_NVM_VERSION}/install.sh"
readonly INSTALLER_URL="https://lehidalgo.github.io/codi/install.sh"

readonly EXIT_OK=0
readonly EXIT_UNSUPPORTED_OS=10
readonly EXIT_NODE_REQUIRED=11
readonly EXIT_PREFIX_BLOCKED=12
readonly EXIT_NPM_FAILED=13
readonly EXIT_VERIFY_FAILED=14

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

if [ "${CODI_NO_COLOR}" = "0" ] && [ -t 1 ]; then
  C_RED=$'\033[31m'
  C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'
  C_BLUE=$'\033[34m'
  C_BOLD=$'\033[1m'
  C_RESET=$'\033[0m'
else
  C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_BOLD=""; C_RESET=""
fi

log_info()  { printf "%s==>%s %s\n" "$C_BLUE" "$C_RESET" "$*"; }
log_warn()  { printf "%s!  %s%s\n" "$C_YELLOW" "$*" "$C_RESET" >&2; }
log_error() { printf "%sX  %s%s\n" "$C_RED" "$*" "$C_RESET" >&2; }
log_ok()    { printf "%sOK%s %s\n" "$C_GREEN" "$C_RESET" "$*"; }
die()       { log_error "$2"; exit "$1"; }

# ---------------------------------------------------------------------------
# Detection
# ---------------------------------------------------------------------------

OS_KIND=""
NODE_PRESENT=0
NODE_MAJOR="0"
NPM_PREFIX=""
PREFIX_WRITABLE=0

detect_os() {
  case "$(uname -s)" in
    Darwin) OS_KIND="darwin" ;;
    Linux)  OS_KIND="linux"  ;;
    *) die "$EXIT_UNSUPPORTED_OS" "Unsupported OS: $(uname -s). Installer supports macOS and Linux only." ;;
  esac
}

detect_node() {
  if command -v node >/dev/null 2>&1; then
    NODE_PRESENT=1
    NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo "0")"
  fi
}

detect_npm_prefix() {
  if [ "$NODE_PRESENT" = "1" ] && command -v npm >/dev/null 2>&1; then
    NPM_PREFIX="$(npm config get prefix 2>/dev/null || echo "")"
    if [ -n "$NPM_PREFIX" ] && [ -w "$NPM_PREFIX" ]; then
      PREFIX_WRITABLE=1
    fi
  fi
}

# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------

install_nvm() {
  if command -v nvm >/dev/null 2>&1 || [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
    log_info "nvm already present, sourcing..."
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
    return
  fi
  log_info "Installing nvm ${CODI_NVM_VERSION}..."
  if [ "$CODI_DRY_RUN" = "1" ]; then
    log_info "[dry-run] curl -fsSL $NVM_INSTALL_URL | bash"
    return
  fi
  curl -fsSL "$NVM_INSTALL_URL" | bash
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
}

install_node() {
  log_info "Installing Node ${CODI_NODE_VERSION} via nvm..."
  if [ "$CODI_DRY_RUN" = "1" ]; then
    log_info "[dry-run] nvm install $CODI_NODE_VERSION && nvm alias default $CODI_NODE_VERSION"
    return
  fi
  nvm install "$CODI_NODE_VERSION"
  nvm use "$CODI_NODE_VERSION"
  nvm alias default "$CODI_NODE_VERSION"
}

install_codi() {
  log_info "Installing codi-cli@${CODI_VERSION}..."
  if [ "$CODI_DRY_RUN" = "1" ]; then
    log_info "[dry-run] npm install -g codi-cli@${CODI_VERSION}"
    return
  fi
  if ! npm install -g "codi-cli@${CODI_VERSION}"; then
    die "$EXIT_NPM_FAILED" "npm install failed. Check network access to the npm registry."
  fi
}

verify_install() {
  log_info "Verifying installation..."
  if [ "$CODI_DRY_RUN" = "1" ]; then
    log_info "[dry-run] codi --version"
    return
  fi
  local version_output
  if ! version_output="$(codi --version 2>&1)"; then
    die "$EXIT_VERIFY_FAILED" "codi command not found on PATH. Open a new shell or source your shell rc, then run: codi --version"
  fi
  log_ok "codi installed: ${version_output}"
}

# ---------------------------------------------------------------------------
# Banners
# ---------------------------------------------------------------------------

print_plan() {
  local node_display="(not installed)"
  if [ "$NODE_PRESENT" = "1" ]; then
    node_display="v$(node -v 2>/dev/null | sed 's/^v//')"
  fi
  printf "\n%sCodi installer%s\n\n" "$C_BOLD" "$C_RESET"
  printf "  OS:               %s\n" "$OS_KIND"
  printf "  Current Node:     %s\n" "$node_display"
  printf "  Required Node:    >=%s (will install Node %s if upgrade needed)\n" "$CODI_NODE_MIN_MAJOR" "$CODI_NODE_VERSION"
  printf "  npm prefix:       %s\n" "${NPM_PREFIX:-(none)}"
  printf "  Prefix writable:  %s\n" "$([ "$PREFIX_WRITABLE" = "1" ] && echo "yes" || echo "no")"
  printf "  Codi version:     %s\n" "$CODI_VERSION"
  printf "  Install nvm:      %s\n" "$([ "$CODI_INSTALL_NVM" = "1" ] && echo "if needed" || echo "no")"
  printf "  Dry run:          %s\n\n" "$([ "$CODI_DRY_RUN" = "1" ] && echo "yes" || echo "no")"
}

print_next_steps() {
  printf "\n%sCodi installed.%s Next steps:\n\n" "$C_BOLD" "$C_RESET"
  printf "  %scodi init%s          Set up Codi in the current project\n" "$C_BLUE" "$C_RESET"
  printf "  %scodi doctor%s        Check project health\n" "$C_BLUE" "$C_RESET"
  printf "  %scodi hub%s           Open the interactive hub\n\n" "$C_BLUE" "$C_RESET"
  printf "Docs: https://lehidalgo.github.io/codi/docs/\n\n"
}

print_prefix_blocked_help() {
  cat >&2 <<EOF

${C_RED}Aborting.${C_RESET}

Node is installed system-wide and 'npm install -g' would require sudo.
This installer will not modify your npm prefix or use sudo.

Recommended fix: switch to nvm-managed Node, then re-run.

  curl -fsSL ${NVM_INSTALL_URL} | bash
  exec \$SHELL -l
  nvm install ${CODI_NODE_VERSION}
  curl -fsSL ${INSTALLER_URL} | bash

Or re-run this installer with CODI_INSTALL_NVM=1 (default) to let it
install nvm + Node ${CODI_NODE_VERSION} (latest LTS) for you under \$HOME/.nvm.

EOF
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

main() {
  detect_os
  detect_node
  detect_npm_prefix
  print_plan

  if [ "$NODE_PRESENT" = "0" ]; then
    if [ "$CODI_INSTALL_NVM" = "0" ]; then
      die "$EXIT_NODE_REQUIRED" "Node not installed and CODI_INSTALL_NVM=0. Install Node ${CODI_NODE_MIN_MAJOR}+ manually, then re-run."
    fi
    install_nvm
    install_node
  elif [ "$NODE_MAJOR" -lt "$CODI_NODE_MIN_MAJOR" ]; then
    log_warn "Node ${NODE_MAJOR} found; Codi requires ${CODI_NODE_MIN_MAJOR}+."
    if [ "$CODI_INSTALL_NVM" = "0" ]; then
      die "$EXIT_NODE_REQUIRED" "CODI_INSTALL_NVM=0. Upgrade Node to ${CODI_NODE_MIN_MAJOR}+ manually, then re-run."
    fi
    install_nvm
    install_node
  elif [ "$PREFIX_WRITABLE" = "0" ]; then
    log_warn "npm prefix '${NPM_PREFIX}' is not writable by current user."
    if [ "$CODI_INSTALL_NVM" = "0" ]; then
      print_prefix_blocked_help
      exit "$EXIT_PREFIX_BLOCKED"
    fi
    log_info "Installing nvm-managed Node to bypass system prefix..."
    install_nvm
    install_node
  fi

  install_codi
  verify_install
  print_next_steps
  exit "$EXIT_OK"
}

main "$@"

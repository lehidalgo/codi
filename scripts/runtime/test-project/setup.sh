#!/usr/bin/env bash
# Generate a scratch project folder with stakeholder requirement markdown.
#
# Drops the agent into a folder containing ONLY the source material it needs
# to elicit Goals / Requirements / Stories. The agent (or you) handles
# everything else — git init, CONTEXT.md, project.json — from there.
#
# Idempotent: re-running wipes the target dir and starts fresh.
#
# Usage:
#   scripts/test-project/setup.sh [--dir PATH]
#
# Default --dir is /tmp/devloop-test-project. Refuses paths outside /tmp.

set -euo pipefail

DIR="/tmp/devloop-test-project"

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) DIR="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,15p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

case "$DIR" in
  /tmp/*|/private/tmp/*) ;;
  *) echo "✗ refusing $DIR — must be under /tmp" >&2; exit 1 ;;
esac

rm -rf "$DIR"
mkdir -p "$DIR/docs/sources"

cat > "$DIR/docs/sources/2026-04-12_acme-discovery-call.md" <<'EOF'
---
source_type: interview
stakeholder: jane@acme.com
recorded_at: 2026-04-12T10:00:00-07:00
---

# Acme discovery call — 2026-04-12

**Participants:** Jane (PM, Acme), Engineering team

## What Acme wants

Jane: "We're rewriting checkout. The current flow loses too many users at signup. We're seeing 32% drop-off at the email-password step. The board signed off on a 10% lift in completed signups by Q3 — that's the headline target."

## How they want to do it

Jane: "Two things. First, social sign-in: Google and GitHub. Most of our prosumer users live in those. SSO via the work email is a 'nice to have' but not blocking. Second, the page has to load fast on mobile — we're seeing p95 login times north of 600ms in some markets. Target is sub-200ms p95."

## Constraints

- Mobile-first design. Touch targets, no tiny links.
- Compliance: must work with the existing GDPR-compliant user store (Postgres).
- Existing email/password flow stays — social is additive, not a replacement.

## Open questions

- Apple Sign-In: we want it, but for v1 it can wait. Flag for v1.5.
- Session expiry: keep current 14-day rolling window.

## Decisions made on the call

1. Google OAuth ships first; GitHub follows in the same release if scope allows.
2. p95 login budget = 200ms (excludes the OAuth provider round-trip).
3. Mobile design comps from Figma file `acme-checkout-v2-2026-04` are the source of truth.
EOF

cat > "$DIR/docs/sources/2026-04-19_followup-email.md" <<'EOF'
---
source_type: email
stakeholder: jane@acme.com
recorded_at: 2026-04-19T15:30:00-07:00
---

# Re: Auth scope — 2026-04-19

> From: Jane <jane@acme.com>
> To: eng@acme.com
> Subject: Re: Auth scope — confirming after legal review

A few clarifications after legal review:

1. **Email matching on first social sign-in.** When a user signs in with Google for the first time and the email matches an existing email/password account, MERGE the accounts silently. Legal said this is fine because the email is the identity proof. Show a one-time toast informing the user but do not block.

2. **Failed sign-in.** Surface a friendly error ("We couldn't sign you in with Google. Try again or use email."). Do not log the OAuth provider's raw error message in the UI — log internally only.

3. **Apple Sign-In.** Confirmed: out of scope for v1. Track separately.

4. **Performance budget includes the OAuth round-trip.** Correction to my earlier statement — the 200ms p95 INCLUDES the round-trip to Google's token endpoint. Engineering can object if this is unrealistic; let's see what the spike says.

Thanks,
Jane
EOF

echo "✓ scratch project ready: $DIR"
echo "  docs/sources/2026-04-12_acme-discovery-call.md"
echo "  docs/sources/2026-04-19_followup-email.md"

# Marketplace publish guide

- Date: 2026-05-14 00:10 UTC
- Document: 20260514*001000*[GUIDE]\_marketplace-publish.md
- Category: GUIDE

## Purpose

ISSUE-091 — publish `codi-cli` as a GitHub Marketplace Action so
downstream projects can use it in their workflows with one line:

```yaml
- uses: lehidalgo/codi@v3
  with:
    command: "generate --check"
```

## One-time setup (already done)

1. `action.yml` at the repo root declares the action interface (inputs,
   composite steps).
2. The `branding` field uses `icon: cpu` + `color: blue` (Marketplace
   requires both before the listing publishes).

## Per-release procedure

1. Cut a release branch:

   ```bash
   git checkout -b release/v3.0.0 main
   ```

2. Bump the npm version (this also tags via `npm version`):

   ```bash
   npm version 3.0.0
   ```

   The pre-version hook runs lint, test, and build. The
   `prepublishOnly` hook re-runs lint and test before npm publishes.

3. Push the branch and the tag:

   ```bash
   git push origin release/v3.0.0
   git push origin --tags
   ```

4. Open a release on GitHub for tag `v3.0.0`. On the release form:
   - Check **Publish this Action to the GitHub Marketplace**
   - Pick the primary category (Utilities) and one secondary
   - Add release notes (auto-generated from conventional commits)

5. After the release publishes, GitHub creates a `v3` floating tag
   alongside `v3.0.0`. Update it on each minor/patch:

   ```bash
   git tag -fa v3 -m "v3 → v3.0.0"
   git push origin v3 --force-with-lease
   ```

   `--force-with-lease` is safe here because the `v3` tag is intentionally
   a moving label, not a release marker. The immutable release tag is
   `v3.0.0`.

## Verifying the listing

After publish, the Action shows at:

https://github.com/marketplace/actions/codi

A 24h delay is normal for the Marketplace index to pick up the listing.

## Rollback

If a release introduces a regression:

1. Move the `v3` floating tag back to the previous good release:

   ```bash
   git tag -fa v3 v3.0.0 -m "rollback to v3.0.0"
   git push origin v3 --force-with-lease
   ```

2. Open a new release with the fix (do NOT delete the broken release —
   GitHub keeps Marketplace history and consumers may pin to it).

## Related

- `action.yml` — action interface declaration
- `.github/workflows/release.yml` — npm publish workflow
- `package.json` — `prepublishOnly` guard (branch check + lint + test)

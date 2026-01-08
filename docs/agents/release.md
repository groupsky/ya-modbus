---
paths: /lerna.json, /.github/workflows/release.yml
---

# Release Process Guidelines

Publishing packages to npm using Lerna-Lite with conventional commits. Uses npm trusted publishers with OIDC for secure, tokenless publishing with provenance.

## Release Triggers

### Production Releases

Auto-triggered on push to main. Skipped when commit starts with `chore(release):` or no package changes.

### Pre-release (Feature Branch)

Manual workflow_dispatch trigger. Creates canary version with custom dist-tag and git SHA. NO git tags. Version changes NOT committed to branch.

Version format: `X.Y.Z-{preid}.0+{sha}` (e.g., `0.6.1-pr123.0+abc1234`)

### Pre-release Cleanup

Auto-removes dist-tag when PR closed/merged. Published versions remain available.

## Version Bumping

Uses independent versioning - each package maintains its own version.

Conventional commit types determine version bump:

- `feat:` → MINOR version bump (0.1.0 → 0.2.0)
- `fix:` → PATCH version bump (0.1.0 → 0.1.1)
- `perf:` → PATCH version bump (0.1.0 → 0.1.1)
- `BREAKING CHANGE:` → MAJOR version bump (0.1.0 → 1.0.0)
- `docs:`, `chore:`, `test:`, `ci:` → NO release

## Pre-release Versioning (Canary) with Independent Packages

Canary mode creates commit-specific pre-releases for testing. Works with independent versioning.

### Changed Packages Only

ONLY changed packages (and their dependents) are published. Unchanged packages remain at current version.

Example monorepo state:

- Package A: 0.5.0
- Package B: 0.6.0
- Package C: 1.2.0

Commit adds feature to Package A only. Pre-release triggered with preid=pr123, git SHA=abc1234.

Result:

- Package A: 0.5.1-pr123.0+abc1234 (bumped and published)
- Package B: 0.6.0 (unchanged, NOT published)
- Package C: 1.2.0 (unchanged, NOT published)

### Multiple Changed Packages

Each changed package gets independent version bump based on its current version.

Example: Same monorepo, commit changes Package A and Package C. Pre-release triggered with preid=feat-auth, git SHA=def5678.

Result:

- Package A: 0.5.1-feat-auth.0+def5678 (bumped from 0.5.0)
- Package B: 0.6.0 (unchanged, NOT published)
- Package C: 1.2.1-feat-auth.0+def5678 (bumped from 1.2.0)

### Version Bump Rules

Canary uses MINOR bump by default. For pre-releases:

- Takes current version (e.g., 0.5.0)
- Bumps to next MINOR (0.6.0)
- Appends preid + counter + git SHA (0.6.0-pr123.0+abc1234)

Subsequent publishes from same branch increment counter:

- First: 0.6.0-pr123.0+abc1234
- Second: 0.6.0-pr123.1+def5678
- Third: 0.6.0-pr123.2+ghi9012

### Dist-tag Behavior

Dist-tag applies to ALL published packages, regardless of different versions.

Example: Pre-release publishes Package A and Package C with dist-tag=pr123.

NPM state after publish:

```
@ya-modbus/package-a@0.5.1-pr123.0+abc1234 (dist-tag: pr123)
@ya-modbus/package-c@1.2.1-pr123.0+abc1234 (dist-tag: pr123)
```

Install any package with dist-tag:

```bash
npm install @ya-modbus/package-a@pr123
npm install @ya-modbus/package-c@pr123
```

Both resolve to their respective versions tagged with pr123.

### Git SHA Purpose

Git SHA ensures version uniqueness for multiple publishes from same commit or branch.

Without SHA: Multiple publishes would conflict (same version string).
With SHA: Each publish creates unique version even if base version unchanged.

Example: Two publishes from commits with same code but different SHAs:

- First: 0.6.0-pr123.0+abc1234
- Second: 0.6.0-pr123.0+def5678 (different SHA, distinct version)

SHA also enables tracing published version back to exact commit.

## Ignored Changes

Lerna NEVER triggers releases when ONLY these files change:

- `**/__tests__/**`, `**/*.{test,spec}.ts` - Test files
- `**/*.md`, `**/CLAUDE.md`, `**/AGENTS.md` - Documentation
- `**/jest.config.cjs`, `**/tsconfig*.json` - Config files
- `**/.{eslintrc,prettierrc}*` - Linting/formatting config
- `.github/**`, `docs/**` - CI/CD and documentation

Example: PR changing ONLY tests + docs → NO release triggered

See: `lerna.json` ignoreChanges configuration

## Triggering Releases

### Production Release

Automatic on push to main. No action needed.

### Pre-release (Feature Branch)

Manual workflow_dispatch. Requires maintain/admin access. Dist-tag auto-generated from branch or specified.

### Manual/Emergency Release

NEVER use npm scripts named `version` or `publish` - they conflict with npm lifecycle hooks.

Use npx lerna commands directly with `--yes` and `--no-private` flags.

See: `.github/workflows/release.yml` "Version packages" and "Publish to npm" steps
See: `docs/PUBLISHING-SETUP.md` for complete manual release procedure
See: `lerna.json` for Lerna configuration
See: `docs/agents/git.md` for commit message format

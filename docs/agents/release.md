---
paths: /lerna.json, /.github/workflows/release.yml
---

# Release Process Guidelines

Publishing packages to npm using Lerna-Lite with conventional commits.

## Release Triggers

### Production Releases

Auto-triggered on push to main. Skipped when commit starts with `chore(release):` or no package changes.

### Pre-release (Feature Branch)

Manual workflow_dispatch trigger. Creates pre-release version with custom dist-tag. NO git tags. Version changes NOT committed to branch.

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

## Triggering Releases

### Production Release

Automatic on push to main. No action needed.

### Pre-release (Feature Branch)

Manual workflow_dispatch. Requires maintain/admin access. Dist-tag auto-generated from branch or specified.

### Manual/Emergency Release

NEVER use npm scripts named `version` or `publish` - they conflict with npm lifecycle hooks.

Use npx lerna commands directly with `--yes` and `--no-private` flags.

See: `.github/workflows/release.yml` lines 172-173, 249 for production commands
See: `.github/workflows/release.yml` lines 192-197, 271-276 for pre-release commands
See: `docs/PUBLISHING-SETUP.md` for complete manual release procedure
See: `lerna.json` for Lerna configuration
See: `docs/agents/git.md` for commit message format

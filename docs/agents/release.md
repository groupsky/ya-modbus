---
paths: /lerna.json, /.github/workflows/release.yml
---

# Release Process Guidelines

Publishing packages to npm using Lerna-Lite with conventional commits.

## Release Triggers

### Production Releases

Automatically triggered on:

- Push to main branch (after PR merge)

Releases are SKIPPED when:

- Commit message starts with `chore(release):`
- No packages have changed since last release
- Only test/doc/config files changed (see lerna.json ignoreChanges)

### Feature Branch Releases (Pre-release)

Manually triggered via GitHub Actions workflow_dispatch.

Results:

- Pre-release version (e.g., `0.1.0-beta.0`)
- Custom dist-tag (auto-generated from branch name or specified)
- NO git tags or GitHub releases
- Does NOT affect `latest` npm dist-tag

### Pre-release Cleanup

When a PR is closed or merged, the cleanup workflow automatically:

- Removes the dist-tag from npm (e.g., `beta`, `feat-xyz`)
- Leaves published versions in npm (doesn't break existing users)
- Users can still install by exact version: `npm install @pkg@0.1.0-beta.0`

The dist-tag removal prevents new installations via `npm install @pkg@beta` while keeping the version available for existing users.

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

Automatic on push to main (after PR merge). No manual action needed.

### Pre-release (Feature Branch Testing)

Trigger manually via GitHub Actions:

1. Navigate to Actions → Release workflow
2. Click "Run workflow" button
3. Select your feature branch from dropdown
4. (Optional) Specify custom dist-tag or leave empty for auto-generation
5. Click "Run workflow"

Results in pre-release version with custom dist-tag (e.g., `0.1.0-feat-xyz.0`)

### Manual/Emergency Release

For local releases only when automation unavailable.

Order: build → test → version → publish

See: `package.json` for lerna scripts
See: `docs/PUBLISHING-SETUP.md` for environment setup

See: `docs/PUBLISHING-SETUP.md` for first-time configuration
See: `lerna.json` for Lerna configuration
See: `.github/workflows/release.yml` for workflow implementation
See: `docs/agents/git.md` for commit message format

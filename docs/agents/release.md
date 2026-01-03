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

For testing unreleased features, manually trigger from GitHub Actions:

1. Go to Actions → Release workflow
2. Click "Run workflow"
3. Select your feature branch
4. Optionally specify dist-tag (e.g., `beta`, `next`, `feat-xyz`)
5. Click "Run workflow"

The workflow will:

- Publish with pre-release version (e.g., `0.1.0-beta.0`)
- Use specified dist-tag (or auto-generate from branch name)
- NOT create git tags or GitHub releases
- NOT affect the `latest` npm dist-tag

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

## Automated Release Workflow

Production releases trigger automatically on push to main.

Workflow steps:

1. Install dependencies and build
2. Run tests to verify quality
3. `lerna version` - analyzes commits, bumps versions, creates tags
4. `lerna publish from-git` - publishes packages to npm

Pre-release workflow runs manually via workflow_dispatch.

## Manual Release

For emergency releases only. Requires environment configuration.

Order: build → test → version → publish

Scripts: See `package.json` for lerna commands
Configuration: See `docs/PUBLISHING-SETUP.md`

See: `docs/PUBLISHING-SETUP.md` for first-time configuration
See: `lerna.json` for Lerna configuration
See: `.github/workflows/release.yml` for workflow implementation
See: `docs/agents/git.md` for commit message format

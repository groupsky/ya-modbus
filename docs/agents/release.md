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

## Release Workflow

GitHub Actions workflow (`.github/workflows/release.yml`):

1. Checkout with full git history (fetch-depth: 0)
2. Install dependencies and build
3. Run tests to verify quality
4. `lerna version` - analyzes commits, bumps versions, creates tags
5. `lerna publish from-git` - publishes packages to npm

## Manual Release

To publish packages manually:

```bash
# Ensure clean state
npm run build
npm run test

# Bump versions and create tags
npm run version

# Publish to npm (requires NPM_TOKEN)
npm run publish
```

## NPM Token Setup

CRITICAL: Add NPM_TOKEN secret to GitHub repository:

1. Create npm access token at https://www.npmjs.com/settings/tokens
2. Token type: "Automation" (for CI/CD)
3. Add to GitHub: Settings → Secrets → Actions → New repository secret
4. Name: `NPM_TOKEN`
5. Value: Your npm token

## Package Privacy

Root package is private (version 0.0.0) and NEVER published.

All workspace packages use `--no-private` flag to skip private packages.

## Changelog Generation

Changelogs generated automatically using Angular preset.

Generated files: `CHANGELOG.md` in each package directory.

## GitHub Releases

Created automatically by lerna version using `GH_TOKEN`.

Release notes generated from conventional commits.

## Installing Pre-release Versions

To install packages from a feature branch release:

```bash
# Install specific dist-tag
npm install @ya-modbus/cli@beta

# Or install specific version
npm install @ya-modbus/cli@0.1.0-beta.0
```

To see available dist-tags:

```bash
npm dist-tag ls @ya-modbus/cli
```

## Verification

After production release:

- Check npm for published versions
- Check GitHub releases for tags
- Verify CHANGELOG.md updated in packages

After pre-release:

- Check npm for published versions: `npm view @ya-modbus/cli versions`
- Verify dist-tag: `npm dist-tag ls @ya-modbus/cli`
- Install and test: `npm install @ya-modbus/cli@<dist-tag>`

See: `lerna.json` for configuration
See: `.github/workflows/release.yml` for workflow
See: `docs/agents/git.md` for commit format

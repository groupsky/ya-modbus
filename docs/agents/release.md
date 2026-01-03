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

## First-Time Setup

Before publishing packages:

1. **NPM Organization**: Ensure `@ya-modbus` scope exists on npm
2. **Package Registration**: First publish creates packages (no pre-registration needed)
3. **User Permissions**: Publisher needs appropriate npm access to the scope
4. **Secrets Configuration**: Configure NPM_TOKEN and verify GH_TOKEN

## Token Configuration

### NPM_TOKEN (Required for Publishing)

Add NPM_TOKEN secret to GitHub repository:

1. Create npm access token at https://www.npmjs.com/settings/tokens
2. Token type: "Automation" (for CI/CD)
3. Add to GitHub: Settings → Secrets → Actions → New repository secret
4. Name: `NPM_TOKEN`
5. Value: Your npm token

### GH_TOKEN (Automatic for GitHub Releases)

For automated releases: `GITHUB_TOKEN` is automatically available in workflows

For manual releases: Set environment variable `GH_TOKEN` with Personal Access Token (scope: repo)

## Manual Release

IMPORTANT: Verify clean working tree and environment before manual release

See: `package.json` scripts section for available commands

- `npm run build` - Build all packages
- `npm run test` - Run test suite
- `npm run version` - Bump versions and create tags (requires GH_TOKEN)
- `npm run publish` - Publish to npm (requires NPM_TOKEN)

Manual release order: build → test → version → publish

For detailed workflow steps, see: `.github/workflows/release.yml`

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

Use dist-tag: `npm install @ya-modbus/cli@beta`
Use exact version: `npm install @ya-modbus/cli@0.1.0-beta.0`
List dist-tags: `npm dist-tag ls @ya-modbus/cli`

## Verification

After production release:

- Check npm for published versions
- Check GitHub releases for tags
- Verify CHANGELOG.md updated in packages

After pre-release:

- List versions: `npm view @ya-modbus/cli versions`
- Check dist-tag: `npm dist-tag ls @ya-modbus/cli`
- Install and test using dist-tag or exact version

See: `lerna.json` for configuration
See: `.github/workflows/release.yml` for workflow
See: `docs/agents/git.md` for commit format

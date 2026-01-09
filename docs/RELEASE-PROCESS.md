# Release Process

Comprehensive guide to releasing packages in the ya-modbus monorepo using Lerna-Lite with conventional commits and independent versioning.

## Table of Contents

- [Overview](#overview)
- [Release Types](#release-types)
- [Independent Package Versioning](#independent-package-versioning)
- [Version Bumping Rules](#version-bumping-rules)
- [Ignored Changes](#ignored-changes)
- [How to Trigger Releases](#how-to-trigger-releases)
- [What Happens During a Release](#what-happens-during-a-release)
- [Troubleshooting](#troubleshooting)

## Overview

This project uses [Lerna-Lite](https://github.com/lerna-lite/lerna-lite) to manage releases in a monorepo containing multiple npm packages. Releases are automated through GitHub Actions workflows and use npm trusted publishers with OIDC for secure, tokenless publishing with provenance attestations.

Key features:

- **Independent versioning**: Each package maintains its own semantic version
- **Conventional commits**: Commit messages determine version bumps automatically
- **Selective publishing**: Only changed packages (and their dependents) are published
- **Preview packages**: Test PR changes with temporary preview packages via pkg.pr.new
- **Ignored patterns**: Tests, docs, and config changes don't trigger releases

## Release Types

### Production Releases

Production releases are published to npm with the `latest` dist-tag and are automatically triggered when changes are pushed to the `main` branch.

**Characteristics:**

- Automatically triggered on push to `main`
- Creates git tags for each released package (e.g., `@ya-modbus/cli@1.2.3`)
- Creates GitHub releases with automatically generated changelogs
- Publishes to npm with `latest` dist-tag
- Version changes are committed back to `main`
- Includes cryptographic provenance attestations

**When it runs:**

- On every push to `main` that contains package changes
- Skipped when commit message starts with `chore(release):`
- Skipped when only ignored files changed (see [Ignored Changes](#ignored-changes))

### Preview Packages (Pull Requests)

Preview packages allow you to test changes from pull requests before merging to `main`. These are temporary preview versions published via [pkg.pr.new](https://github.com/stackblitz-labs/pkg.pr.new) for testing and validation.

**Characteristics:**

- Automatically triggered on PR events (open, sync, reopen)
- Can be manually triggered via PR approval or `/pkg-pr-new` comment
- Published to pkg.pr.new temporary registry (not npm)
- No git tags created
- No version changes committed
- Requires write access to the repository
- Installation URLs posted as PR comments

**When to use:**

- Testing changes before merging to main
- Getting early feedback on new features
- Validating bug fixes with specific versions
- CI/CD integration testing

**When it runs:**

- Automatically on pull request opened, synchronized, or reopened
- On pull request approval
- When a comment containing `/pkg-pr-new` is posted on a PR

## Independent Package Versioning

This monorepo uses **independent versioning**, meaning each package maintains its own version number independent of other packages. Packages can be at different versions simultaneously.

### Example Scenario

Current state of the monorepo:

```
@ya-modbus/cli: 1.5.0
@ya-modbus/core: 2.3.1
@ya-modbus/driver-abc: 0.4.0
```

If you make changes only to `@ya-modbus/driver-abc`:

```
@ya-modbus/cli: 1.5.0        (unchanged - NOT published)
@ya-modbus/core: 2.3.1       (unchanged - NOT published)
@ya-modbus/driver-abc: 0.5.0 (changed - published)
```

### Benefits

- Packages evolve at their own pace
- Consumers only see relevant version changes
- Reduces unnecessary version bumps
- Clearer semantic versioning per package
- Smaller changelogs per package

### Changed Packages Only

Lerna-Lite automatically detects which packages have changed since the last release by:

1. Comparing current commits to the last git tag for each package
2. Analyzing conventional commit messages
3. Checking if changes match ignored patterns
4. Including dependent packages if their dependencies changed

**Important:** If a package hasn't changed, it won't be published even if other packages in the monorepo are being released.

## Version Bumping Rules

Lerna-Lite uses [conventional commits](https://www.conventionalcommits.org/) to automatically determine the appropriate version bump for each changed package.

### Commit Type → Version Bump

| Commit Type        | Version Bump | Example       |
| ------------------ | ------------ | ------------- |
| `feat:`            | MINOR        | 0.1.0 → 0.2.0 |
| `fix:`             | PATCH        | 0.1.0 → 0.1.1 |
| `perf:`            | PATCH        | 0.1.0 → 0.1.1 |
| `BREAKING CHANGE:` | MAJOR        | 0.1.0 → 1.0.0 |
| `docs:`            | NO RELEASE   | -             |
| `chore:`           | NO RELEASE   | -             |
| `test:`            | NO RELEASE   | -             |
| `ci:`              | NO RELEASE   | -             |

### Examples

**Feature addition (MINOR bump):**

```bash
git commit -m "feat(cli): add discover command for device scanning"
# Result: @ya-modbus/cli 1.5.0 → 1.6.0
```

**Bug fix (PATCH bump):**

```bash
git commit -m "fix(driver-abc): correct CRC validation in frame parsing"
# Result: @ya-modbus/driver-abc 0.4.0 → 0.4.1
```

**Breaking change (MAJOR bump):**

```bash
git commit -m "feat(core)!: redesign connection manager API

BREAKING CHANGE: ConnectionManager.connect() now returns Promise<Connection>
instead of Connection. Update all usages to await the promise."
# Result: @ya-modbus/core 2.3.1 → 3.0.0
```

**Documentation only (NO RELEASE):**

```bash
git commit -m "docs(driver-abc): update README with installation instructions"
# Result: No version bump, no publish
```

### Multiple Commits

If multiple conventional commits affect a package between releases, Lerna-Lite uses the **highest** version bump:

```bash
git commit -m "fix(cli): correct error handling"
git commit -m "feat(cli): add new export command"
git commit -m "docs(cli): update examples"
# Result: MINOR bump (feat wins over fix and docs)
# @ya-modbus/cli 1.5.0 → 1.6.0
```

## Ignored Changes

Lerna-Lite will **NOT** trigger a release if changes only affect certain file patterns. This prevents unnecessary releases for documentation updates, test changes, or configuration adjustments.

### Ignored Patterns

The following patterns are configured in `/lerna.json` under `ignoreChanges`:

```json
[
  "**/__tests__/**", // Test directories
  "**/*.test.ts", // Test files
  "**/*.spec.ts", // Spec files
  "**/*.md", // Markdown documentation
  "**/CLAUDE.md", // Agent documentation
  "**/AGENTS.md", // Agent documentation
  "**/jest.config.cjs", // Jest configuration
  "**/tsconfig*.json", // TypeScript configuration
  "**/.eslintrc*", // ESLint configuration
  "**/.prettierrc*", // Prettier configuration
  ".github/**", // GitHub workflows and config
  "docs/**" // Documentation directory
]
```

### Examples

**Scenario 1: Only documentation changed**

```bash
git commit -m "docs(cli): update README with new examples"
git commit -m "docs(driver-abc): fix typo in API documentation"
```

**Result:** No packages published (all changes match ignored patterns)

**Scenario 2: Tests and documentation changed**

```bash
git commit -m "test(core): add unit tests for connection manager"
git commit -m "docs(core): document connection manager API"
```

**Result:** No packages published (all changes match ignored patterns)

**Scenario 3: Mixed changes (code + documentation)**

```bash
git commit -m "feat(cli): add discover command"
git commit -m "docs(cli): document discover command"
```

**Result:** `@ya-modbus/cli` published with MINOR bump (code change triggers release, documentation ignored)

**Scenario 4: Configuration changes only**

```bash
git commit -m "chore(driver-abc): update tsconfig.json for stricter checks"
git commit -m "chore(driver-abc): update jest config"
```

**Result:** No packages published (config files are ignored, and `chore:` doesn't trigger releases anyway)

### Why Ignore These Patterns?

- **Tests**: Test improvements don't change package functionality for consumers
- **Documentation**: README updates don't affect package code
- **Configuration**: TypeScript, Jest, ESLint configs are development tools
- **CI/CD**: Workflow changes don't affect published packages

### Checking If Changes Will Trigger a Release

Before committing, you can check if your changes will trigger a release:

```bash
# Show what Lerna would do without making changes
npx lerna changed
```

This command shows which packages have changes that would trigger a release.

## How to Trigger Releases

### Production Release

Production releases are **fully automated** and require no manual intervention.

**Prerequisites:**

- Changes merged to `main` branch
- Changes must include commits that warrant a release (see [Version Bumping Rules](#version-bumping-rules))
- Changes must not be only ignored files (see [Ignored Changes](#ignored-changes))

**Process:**

1. Open a pull request with your changes
2. Wait for CI checks to pass
3. Get PR approval and merge to `main`
4. GitHub Actions automatically triggers the release workflow
5. Packages are versioned, tagged, and published to npm

**Automatic skip conditions:**

- Commit message starts with `chore(release):`
- No package changes detected
- Only ignored files changed

### Preview Packages (Pull Requests)

Preview packages are **automatically published** when pull requests are opened, synchronized, or reopened. They can also be manually triggered.

**Prerequisites:**

- Open pull request with committed changes
- Changes pushed to GitHub
- Write access to the repository

**Automatic triggers:**

- Pull request opened
- Pull request synchronized (new commits pushed)
- Pull request reopened
- Pull request approved

**Manual trigger:**

- Comment `/pkg-pr-new` on the pull request

**Process:**

1. Open or update a pull request
2. Preview package workflow runs automatically
3. Workflow checks permissions, runs lint and tests
4. Packages are built and published to pkg.pr.new
5. Installation URLs are posted as a PR comment
6. Test the preview packages using the URLs provided

**What gets published:**

- Only packages with changes in the PR
- Uses pkg.pr.new temporary registry (not npm)
- Installation URLs are unique per commit
- No git tags or version commits created

**Testing new packages:**

Preview packages use the `--compact` flag which generates shorter URLs for packages already published to npm. For new packages not yet on npm:

1. The package will still be published to the preview registry
2. Install using the full URL format: `npm i https://pkg.pr.new/[org]/[repo]/[package-name]@[commit]`
3. Once the package is first published to npm (via production release), future previews will use shorter compact URLs

**Note:** Preview packages are temporary and intended for testing only. They are not published to the npm registry and do not affect production versions.

### Manual/Emergency Release

In rare cases, you may need to publish manually from your local machine.

**Prerequisites:**

- NPM authentication: `npm login`
- GitHub token: `export GH_TOKEN=your_token`
- Clean working tree (no uncommitted changes)
- Dependencies installed: `npm ci`
- Tests passing: `npm test`

**Commands:**

```bash
# Build all packages
npm run build

# Run tests
npm run test

# Version packages (creates git tags and GitHub releases)
npx lerna version --yes --no-private --sync-workspace-lock

# Publish to npm
npx lerna publish from-git --yes --no-private
```

**Important notes:**

- Manual releases do NOT include provenance attestations
- Use automated workflows whenever possible for security
- See `/docs/PUBLISHING-SETUP.md` for detailed manual release instructions

## What Happens During a Release

Understanding the release process helps troubleshoot issues and set expectations.

### Production Release Flow

1. **Trigger**: Push to `main` branch
2. **Skip check**: Workflow checks if release should be skipped (see [Automatic skip conditions](#production-release))
3. **Checkout**: Workflow checks out code with full git history
4. **Setup**: Node.js and npm dependencies installed
5. **Build**: All packages built (`npm run build`)
6. **Test**: Full test suite runs (`npm run test:ci`)
7. **Version**:
   - Lerna analyzes conventional commits since last release
   - Determines which packages changed
   - Calculates version bumps for each package
   - Updates package.json files
   - Creates git tags (e.g., `@ya-modbus/cli@1.6.0`)
   - Generates changelogs
   - Creates GitHub releases
   - Commits version changes to `main`
8. **Publish**:
   - Authenticates to npm using OIDC (trusted publishers)
   - Publishes changed packages with `latest` dist-tag
   - Includes provenance attestations
9. **Success**: Packages available on npm

### Preview Package Flow

1. **Trigger**: Pull request event (open, sync, reopen, approval, or `/pkg-pr-new` comment)
2. **Permission check**: Validates user has write access to the repository
3. **Checkout**: Workflow checks out PR head commit
4. **Setup**: Node.js and npm dependencies installed
5. **Lint**: Code linting runs (`npm run lint`)
6. **Test**: Full test suite runs (`npm run test:ci`)
7. **Build**: All packages built (`npm run build`)
8. **Publish**:
   - Publishes changed packages to pkg.pr.new
   - Uses `--compact` flag for shorter URLs (requires packages published to npm)
   - NO git tags created
   - NO version commits pushed
   - NO npm registry publishing
9. **PR comment**: Workflow posts installation URLs as a PR comment
10. **Success**: Preview packages available via pkg.pr.new URLs

**Key differences from production:**

- No git tags created
- No version commits
- Published to pkg.pr.new temporary registry (not npm)
- No GitHub releases created
- Installation via unique URLs instead of version numbers
- Requires write access instead of maintain/admin

## Troubleshooting

### No Packages Published

**Symptom:** Release workflow completes successfully but no packages published.

**Possible causes:**

1. **Only ignored files changed**
   - Solution: Check if changes match ignored patterns (see [Ignored Changes](#ignored-changes))
   - Run: `npx lerna changed` to see which packages would be published

2. **Commits don't match conventional format**
   - Solution: Ensure commits follow conventional commits format
   - Example: `feat(cli): add command` not `Added new command`
   - See: [Version Bumping Rules](#version-bumping-rules)

3. **Commit types don't trigger releases**
   - Solution: Check if commits are `docs:`, `test:`, or `chore:` which don't trigger releases
   - Use `feat:`, `fix:`, or `perf:` for package changes

4. **Changes already released**
   - Solution: Check if another workflow already published these changes
   - Review git tags: `git tag -l`

### Preview Package Permission Denied

**Symptom:** Preview package workflow fails permission check or does not run.

**Possible causes:**

1. **Insufficient permissions**
   - Solution: Request write access from repository owner
   - Preview packages require write access to post PR comments

2. **Pull request from forked repository**
   - **Problem:** Preview packages do not work for PRs from forks
   - **Reason:** The workflow explicitly checks `github.event.pull_request.head.repo.full_name == github.repository` to prevent unauthorized users from publishing packages that could be confused with official packages
   - **Solution:** For external contributors, maintainers with write access can:
     - Manually trigger preview publishing by approving the PR
     - Comment `/pkg-pr-new` on the PR
     - Or push the contributor's changes to a branch in the main repository

### Preview Package Build Failures

**Symptom:** Preview package workflow fails during lint, test, or build steps.

**Possible causes:**

1. **Linting errors**
   - Solution: Run `npm run lint` locally and fix issues
   - Workflow will not publish if linting fails

2. **Test failures**
   - Solution: Run `npm run test:ci` locally and fix failing tests
   - All tests must pass before publishing preview packages

3. **Build errors**
   - Solution: Run `npm run build` locally and fix build issues
   - Check for TypeScript errors or missing dependencies

### Preview Package Installation Issues

**Symptom:** Cannot install preview package using provided URL.

**Possible causes:**

1. **New package not yet on npm**
   - Solution: Use full URL format instead of compact URL
   - Format: `npm i https://pkg.pr.new/[org]/[repo]/[package-name]@[commit]`
   - See PR comment for specific instructions

2. **URL expired or incorrect**
   - Solution: Verify you're using the latest URL from the most recent PR comment
   - Each new commit generates new URLs

3. **Network or registry issues**
   - Solution: Check pkg.pr.new service status
   - Try again after a few minutes

### OIDC Authentication Failures

**Symptom:** Publish step fails with 401 authentication error.

**Possible causes:**

1. **Trusted publisher not configured**
   - Solution: Configure npm trusted publishers for each package
   - See: `/docs/PUBLISHING-SETUP.md` for setup instructions

2. **First-time package publish**
   - Solution: New packages must be published manually first
   - See: `/docs/PUBLISHING-SETUP.md` → "First-Time Package Publishing"

3. **Workflow environment not configured**
   - Solution: Ensure `npm` environment exists in repository settings
   - Go to: Settings → Environments → Create `npm` environment

4. **Wrong workflow file name**
   - Solution: Verify trusted publisher config uses `release.yml`
   - Trusted publisher config must match exact workflow filename

### Version Conflict on Publish

**Symptom:** Publish fails with "version already exists" error.

**Possible causes:**

1. **Version already published manually**
   - Solution: Check npm to see if version exists
   - If testing, wait for next commit to trigger new version

2. **Multiple workflows running simultaneously**
   - Solution: Workflows are protected by concurrency group
   - Wait for current workflow to finish before triggering another

3. **Git tags out of sync**
   - Solution: Fetch latest tags: `git fetch --tags`
   - Lerna uses git tags to determine last published version

### Getting Help

If you encounter issues not covered here:

1. Check workflow logs in GitHub Actions tab for detailed error messages
2. Review `/docs/PUBLISHING-SETUP.md` for setup requirements
3. Verify configuration in `/lerna.json`
4. Check workflow definitions in `/.github/workflows/release.yml` and `/.github/workflows/pkg-pr-new.yml`
5. Review [Lerna-Lite documentation](https://github.com/lerna-lite/lerna-lite)
6. Review [pkg.pr.new documentation](https://github.com/stackblitz-labs/pkg.pr.new)
7. Open an issue in the repository with workflow logs and error details

## Reference Documentation

- **Agent Documentation**: `/docs/agents/release.md` - Technical guidelines for AI agents
- **Publishing Setup**: `/docs/PUBLISHING-SETUP.md` - Initial configuration and manual publishing
- **Workflow Definitions**:
  - `/.github/workflows/release.yml` - Production release workflow
  - `/.github/workflows/pkg-pr-new.yml` - Preview packages workflow
- **Lerna Configuration**: `/lerna.json` - Lerna-Lite settings and ignored patterns
- **Git Guidelines**: `/docs/agents/git.md` - Commit message format and branching strategy
- **Lerna-Lite**: https://github.com/lerna-lite/lerna-lite - Official documentation
- **Conventional Commits**: https://www.conventionalcommits.org/ - Commit message specification
- **NPM Trusted Publishers**: https://docs.npmjs.com/trusted-publishers - OIDC setup guide
- **pkg.pr.new**: https://github.com/stackblitz-labs/pkg.pr.new - Preview packages service

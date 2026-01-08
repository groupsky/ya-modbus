# Release Process

Comprehensive guide to releasing packages in the ya-modbus monorepo using Lerna-Lite with conventional commits and independent versioning.

## Table of Contents

- [Overview](#overview)
- [Release Types](#release-types)
- [Independent Package Versioning](#independent-package-versioning)
- [Version Bumping Rules](#version-bumping-rules)
- [Pre-release Versioning (Canary)](#pre-release-versioning-canary)
- [Dist-tags](#dist-tags)
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
- **Pre-release support**: Create canary versions for testing before production release
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

### Pre-releases (Feature Branches)

Pre-releases allow you to publish test versions from feature branches before merging to `main`. These are canary versions intended for testing and validation.

**Characteristics:**

- Manually triggered via GitHub Actions workflow dispatch
- Creates canary versions with git SHA for uniqueness
- Uses custom dist-tag for easy installation
- No git tags created
- Version changes NOT committed back to the branch
- Requires maintain or admin repository access
- Includes cryptographic provenance attestations

**When to use:**

- Testing changes before merging to main
- Getting early feedback on new features
- Validating bug fixes with specific versions
- CI/CD integration testing

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

## Pre-release Versioning (Canary)

Canary mode creates commit-specific pre-releases for testing before production deployment. These versions are temporary and designed for validation.

### Canary Version Format

```
X.Y.Z-{preid}.{counter}+{sha}
```

**Components:**

- `X.Y.Z` - Next semantic version based on conventional commits
- `{preid}` - Pre-release identifier (derived from branch name or custom)
- `{counter}` - Incremental counter starting at 0
- `{sha}` - Short git SHA for traceability

**Example:**

```
0.6.1-pr123.0+abc1234
```

### How Canary Versioning Works

#### Single Changed Package

Starting state:

```
@ya-modbus/cli: 1.5.0
@ya-modbus/core: 2.3.1
@ya-modbus/driver-abc: 0.4.0
```

You create a feature branch and add a feature to `@ya-modbus/cli` only. Then trigger a pre-release with `preid=pr123` and current git SHA is `abc1234`.

**Result:**

```
@ya-modbus/cli: 1.6.0-pr123.0+abc1234  (published)
@ya-modbus/core: 2.3.1                 (unchanged - NOT published)
@ya-modbus/driver-abc: 0.4.0           (unchanged - NOT published)
```

**Explanation:**

1. `@ya-modbus/cli` changed, so it's versioned and published
2. Conventional commit was `feat:`, so MINOR bump: 1.5.0 → 1.6.0
3. Canary appends pre-release suffix: `-pr123.0+abc1234`
4. Other packages unchanged, so not published

#### Multiple Changed Packages

Same starting state, but you change both `@ya-modbus/cli` (feature) and `@ya-modbus/driver-abc` (bug fix):

```bash
git commit -m "feat(cli): add discover command"
git commit -m "fix(driver-abc): correct CRC validation"
```

Trigger pre-release with `preid=feat-discovery` and git SHA is `def5678`.

**Result:**

```
@ya-modbus/cli: 1.6.0-feat-discovery.0+def5678          (MINOR bump)
@ya-modbus/core: 2.3.1                                  (unchanged)
@ya-modbus/driver-abc: 0.4.1-feat-discovery.0+def5678  (PATCH bump)
```

**Explanation:**

1. Each changed package gets its own independent version bump
2. `@ya-modbus/cli` gets MINOR bump (feat)
3. `@ya-modbus/driver-abc` gets PATCH bump (fix)
4. Both get the same preid and SHA suffix
5. Unchanged packages are not published

#### Multiple Publishes from Same Branch

If you continue developing on the same feature branch and trigger additional pre-releases, the counter increments:

**First publish:**

```
@ya-modbus/cli: 1.6.0-pr123.0+abc1234
```

**Second publish (after more commits):**

```
@ya-modbus/cli: 1.6.0-pr123.1+def5678
```

**Third publish:**

```
@ya-modbus/cli: 1.6.0-pr123.2+ghi9012
```

**Note:** The base version (1.6.0) stays the same, but the counter increments and the SHA changes.

### Default Version Bump for Canaries

By default, canary mode uses a **MINOR** version bump regardless of the conventional commit type. This is because canary versions are for testing and the actual production bump will be determined when merging to `main`.

**Exception:** If your commits include `BREAKING CHANGE:`, the MAJOR version will be used.

### Git SHA Purpose

The git SHA in canary versions serves two purposes:

1. **Uniqueness**: Ensures each publish creates a distinct version even if published from the same commit or if the counter somehow resets
2. **Traceability**: Allows you to trace the published version back to the exact commit in your repository

**Example of SHA preventing conflicts:**

Without SHA, if you delete and recreate a branch, versions could conflict:

```
Branch attempt 1: 1.6.0-pr123.0  (published)
Branch attempt 2: 1.6.0-pr123.0  (conflict!)
```

With SHA, each is unique:

```
Branch attempt 1: 1.6.0-pr123.0+abc1234  (published)
Branch attempt 2: 1.6.0-pr123.0+def5678  (distinct!)
```

## Dist-tags

Dist-tags in npm allow you to provide aliases to specific package versions, making it easy to install pre-release or experimental versions without using exact version strings.

### What Are Dist-tags?

Think of dist-tags as named pointers to specific package versions. Every package has a `latest` dist-tag by default, which points to the most recent production release.

**Example npm state:**

```
@ya-modbus/cli@1.5.0 (dist-tag: latest)
@ya-modbus/cli@1.6.0-pr123.0+abc1234 (dist-tag: pr123)
```

### Installing with Dist-tags

Instead of specifying exact versions, you can use dist-tags:

```bash
# Install latest production version
npm install @ya-modbus/cli@latest
# or simply
npm install @ya-modbus/cli

# Install pre-release version
npm install @ya-modbus/cli@pr123
```

### Dist-tag Behavior with Multiple Packages

The same dist-tag can point to different versions of different packages. This is normal and expected with independent versioning.

**Example:** Pre-release publishes `@ya-modbus/cli` and `@ya-modbus/driver-abc` with dist-tag `pr123`:

**NPM state after publish:**

```
@ya-modbus/cli@1.6.0-pr123.0+abc1234 (dist-tag: pr123)
@ya-modbus/driver-abc@0.4.1-pr123.0+abc1234 (dist-tag: pr123)
```

**Installing:**

```bash
# Each package resolves to its respective version with pr123 tag
npm install @ya-modbus/cli@pr123
# Installs: @ya-modbus/cli@1.6.0-pr123.0+abc1234

npm install @ya-modbus/driver-abc@pr123
# Installs: @ya-modbus/driver-abc@0.4.1-pr123.0+abc1234
```

### Automatic Dist-tag Generation

For pre-releases, the dist-tag is automatically generated from the branch name if not specified:

```
Branch: feat/add-discovery  → Dist-tag: feat-add-discovery
Branch: bugfix/crc-error   → Dist-tag: bugfix-crc-error
Branch: pr-123             → Dist-tag: pr-123
```

**Sanitization rules:**

- Non-alphanumeric characters replaced with hyphens
- Leading/trailing hyphens removed
- Must start with alphanumeric character

### Custom Dist-tags

You can specify a custom dist-tag when triggering a pre-release:

```
dist-tag: beta    → All packages published with @beta
dist-tag: alpha   → All packages published with @alpha
dist-tag: rc      → All packages published with @rc
```

**Reserved tags:**

- `latest` - Reserved for production releases, cannot be used for pre-releases
- `next` - Reserved (should not be used for feature branches)

### Dist-tag Cleanup

When a pull request is closed or merged, the GitHub Actions workflow automatically removes the dist-tag:

```bash
npm dist-tag rm @ya-modbus/cli pr123
npm dist-tag rm @ya-modbus/driver-abc pr123
```

**Important:** The published versions remain available on npm even after the dist-tag is removed. You can still install them using exact version strings:

```bash
npm install @ya-modbus/cli@1.6.0-pr123.0+abc1234
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

### Pre-release (Feature Branch)

Pre-releases are **manually triggered** and require maintain or admin repository access.

**Prerequisites:**

- Feature branch with committed changes
- Changes pushed to GitHub
- Maintain or admin access to the repository

**Process:**

1. Navigate to **Actions** tab in GitHub
2. Select **Release** workflow
3. Click **Run workflow** dropdown
4. Configure the workflow:
   - **Use workflow from**: Select your feature branch
   - **NPM dist-tag**: Leave empty for auto-generated tag, or specify custom (e.g., `beta`, `alpha`)
   - **Dry run**: Check to validate without publishing
5. Click **Run workflow**
6. Monitor workflow progress in Actions tab
7. If workflow succeeds, packages are published to npm with the specified dist-tag

**After pre-release:**

- If you opened a PR, the workflow will comment with installation instructions
- Dist-tag is automatically removed when PR is closed or merged
- Published versions remain available via exact version strings

**Dist-tag generation:**

If you leave the dist-tag field empty, it's auto-generated from the branch name:

```
Branch: feat/add-discovery  → Dist-tag: feat-add-discovery
Branch: fix/crc-error      → Dist-tag: fix-crc-error
```

**Custom dist-tag:**

Specify a custom dist-tag for semantic meaning:

```
Dist-tag: beta  → npm install @ya-modbus/cli@beta
Dist-tag: alpha → npm install @ya-modbus/cli@alpha
Dist-tag: rc    → npm install @ya-modbus/cli@rc
```

### Dry Run Mode

Both production and pre-release workflows support dry run mode for validation without publishing.

**When to use:**

- Testing workflow configuration changes
- Validating versioning behavior
- Checking which packages would be published
- Training or demonstration purposes

**How to use:**

1. Trigger pre-release workflow manually
2. Check **Dry run** checkbox
3. Run workflow
4. Review workflow output to see what would happen

**What happens:**

- All steps execute normally (install, build, test, version)
- Version numbers are calculated
- No packages are actually published to npm
- No git tags created
- No version commits pushed

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

**Timeline:** Typically 5-10 minutes depending on test suite duration.

### Pre-release Flow

1. **Trigger**: Manual workflow dispatch from GitHub Actions
2. **Permission check**: Validates user has maintain or admin access
3. **Checkout**: Workflow checks out feature branch
4. **Setup**: Node.js and npm dependencies installed
5. **Build**: All packages built
6. **Test**: Full test suite runs
7. **Publish**:
   - Lerna analyzes commits since last release
   - Determines which packages changed
   - Calculates canary versions with git SHA
   - Authenticates to npm using OIDC
   - Publishes packages with custom dist-tag
   - NO git tags created
   - NO version commits pushed
8. **PR comment**: If PR exists, workflow comments with installation instructions
9. **Success**: Pre-release versions available on npm

**Timeline:** Typically 5-10 minutes depending on test suite duration.

**Key differences from production:**

- No git tags created
- No version commits
- Uses custom dist-tag instead of `latest`
- No GitHub releases created
- Versions include pre-release suffix and git SHA

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

### Pre-release Permission Denied

**Symptom:** Workflow dispatch button not visible or workflow fails permission check.

**Possible causes:**

1. **Insufficient permissions**
   - Solution: Request maintain or admin access from repository owner
   - Pre-releases require elevated permissions to prevent accidental publishes

2. **Wrong branch selected**
   - Solution: Ensure you selected your feature branch in the workflow dispatch dropdown
   - Pre-releases must run from feature branches, not `main`

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
   - If testing, use a different preid for pre-releases

2. **Multiple workflows running simultaneously**
   - Solution: Workflows are protected by concurrency group
   - Wait for current workflow to finish before triggering another

3. **Git tags out of sync**
   - Solution: Fetch latest tags: `git fetch --tags`
   - Lerna uses git tags to determine last published version

### Dist-tag Not Removed After PR Merge

**Symptom:** Dist-tag still exists on npm after PR closed.

**Possible causes:**

1. **Cleanup workflow failed**
   - Solution: Manually remove dist-tag: `npm dist-tag rm @ya-modbus/package-name tag-name`
   - Requires npm authentication

2. **PR closed before pre-release published**
   - Solution: No dist-tag was created, nothing to clean up
   - Check PR comments to verify pre-release was published

### Getting Help

If you encounter issues not covered here:

1. Check workflow logs in GitHub Actions tab for detailed error messages
2. Review `/docs/PUBLISHING-SETUP.md` for setup requirements
3. Verify configuration in `/lerna.json`
4. Check workflow definition in `/.github/workflows/release.yml`
5. Review [Lerna-Lite documentation](https://github.com/lerna-lite/lerna-lite)
6. Open an issue in the repository with workflow logs and error details

## Reference Documentation

- **Agent Documentation**: `/docs/agents/release.md` - Technical guidelines for AI agents
- **Publishing Setup**: `/docs/PUBLISHING-SETUP.md` - Initial configuration and manual publishing
- **Workflow Definition**: `/.github/workflows/release.yml` - Complete workflow implementation
- **Lerna Configuration**: `/lerna.json` - Lerna-Lite settings and ignored patterns
- **Git Guidelines**: `/docs/agents/git.md` - Commit message format and branching strategy
- **Lerna-Lite**: https://github.com/lerna-lite/lerna-lite - Official documentation
- **Conventional Commits**: https://www.conventionalcommits.org/ - Commit message specification
- **NPM Trusted Publishers**: https://docs.npmjs.com/trusted-publishers - OIDC setup guide

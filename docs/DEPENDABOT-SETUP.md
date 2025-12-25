# Dependabot Setup Guide

## Overview

This repository is configured with GitHub Dependabot for automated dependency management, including grouped updates, verification workflows, and auto-merge capabilities for safe updates.

## Configuration Files

### `.github/dependabot.yml`

Main Dependabot configuration with:

- **Versioning strategy**: `widen` (library-friendly, broadens version ranges)
- **GitHub Actions updates**: Weekly grouped updates for all action versions
- **npm dependencies**: Organized into semantic groups:
  - `npm-production`: Production dependencies (grouped patch/minor updates)
  - `npm-dev-tooling`: ESLint, Prettier, Husky, lint-staged
  - `npm-typescript`: TypeScript and related tools
  - `npm-testing`: Jest and testing utilities
  - `npm-types`: All @types/\* packages
  - Security updates: Not grouped (immediate individual PRs)

All workspace packages (`driver-sdk`, `driver-types`, `ya-modbus-driver-xymd1`) are monitored separately.

**Schedule**: Weekly on Mondays at 03:00 UTC

**Why `widen` strategy?**

This repository contains library packages that will be published and consumed by other projects. The `widen` versioning strategy:

- Broadens version ranges when possible (e.g., `^1.0.0` → `^1.0.0 || ^2.0.0`)
- Gives consumers more flexibility in dependency resolution
- Reduces "dependency hell" for library users
- Follows npm best practices for libraries

For comparison, `increase-if-necessary` is better for applications, while `widen` is recommended for libraries.

### Workflows

#### `dependabot-verify.yml`

Validates Dependabot configuration coverage:

- ✅ Checks all package.json files are covered
- ✅ Validates YAML syntax
- ✅ Detects duplicate directory entries
- ✅ Verifies group configurations

**Triggers**: On push to main, PR changes to dependabot.yml or package.json files, weekly schedule, manual dispatch

#### `dependabot-claude-review.yml`

Intelligent automated review and merging using Claude AI:

**Patch updates** (`version-update:semver-patch`):

- ✅ Claude performs quick validation
- ✅ Auto-merged for dev and prod dependencies if approved
- ✅ Minimal risk, maximum automation

**Minor updates** (`version-update:semver-minor`):

- ✅ Claude reviews changes and inspects new features
- ✅ Creates GitHub issues for beneficial features
- ✅ Auto-merged for dev dependencies only
- ⚠️ Manual merge required for prod dependencies

**Major updates** (`version-update:semver-major`):

- ⚠️ Claude analyzes breaking changes AND inspects new features
- ✅ Implements fixes in PR if possible
- ⚠️ Creates migration issue and closes PR if too complex
- ✅ Approves for manual merge if no impact
- ✅ Creates separate enhancement issues for beneficial new features

**Features**:

- Fetches Dependabot metadata (dependency type, update type)
- Claude AI reviews based on semantic versioning severity
- Creates GitHub issues for new features and migration tasks
- Automatically approves and merges safe PRs after CI passes
- Adds labels: `dependabot-approved`, `dependabot-auto-merge`, `ready-to-merge`, `breaking-change`
- Implements breaking change fixes when possible
- Comprehensive documentation in `docs/PR-MERGE-RULES.md`

## Dependency Optimization

The repository uses npm workspaces with optimized dependency management:

### Changes Made

1. **Hoisted common devDependencies to root**:
   - @types/jest, @types/node, jest, ts-jest
   - These are now available to all workspace packages

2. **Standardized TypeScript version**:
   - All packages now use TypeScript ^5.7.2

3. **Removed duplicates**:
   - Removed devDependencies from workspace packages that are in root
   - Removed redundant peerDependencies

### Benefits

- **Reduced package count**: From ~26 to ~16 unique packages
- **Single source of truth**: Manage versions in one place
- **Faster installs**: Less duplication in node_modules
- **Smaller lockfile**: Fewer duplicate entries
- **Consistent versions**: All packages use same tooling

### Package Structure

```
Root (15 devDependencies):
  - Testing: @types/jest, jest, ts-jest
  - TypeScript: typescript, @typescript-eslint/*, ts-node
  - Linting: eslint, eslint-*, prettier
  - Tooling: husky, lint-staged, semantic-release

Workspaces (dependencies only):
  - driver-sdk: @ya-modbus/driver-types
  - driver-types: (no dependencies)
  - ya-modbus-driver-xymd1: @ya-modbus/driver-types
```

## Usage

### Testing Dependabot Configuration

```bash
# Verify all packages are covered
npm run test

# Check workflow runs
gh run list --workflow=dependabot-verify.yml
```

### Managing Dependabot PRs

Dependabot PRs are automatically handled by Claude AI based on semantic versioning:

**Patch Updates** (bug fixes):

- Claude performs quick validation
- Automatically approved and merged after CI passes
- No action needed

**Minor Updates** (new features):

- Claude reviews and inspects new features
- Creates GitHub issues for beneficial features
- Dev deps: Auto-merged after CI
- Prod deps: Manual merge required after Claude approval

**Major Updates** (breaking changes):

- Claude analyzes breaking changes AND inspects new features
- If fixable: Claude implements fixes in the PR
- If complex: Claude creates migration issue and closes PR
- Creates enhancement issues for beneficial new features
- Manual review and merge required

### Manual Dependabot Triggers

```bash
# Trigger Dependabot manually (requires GitHub CLI with Dependabot API access)
gh api -X POST /repos/{owner}/{repo}/dependabot/updates

# View Dependabot alerts
gh api /repos/{owner}/{repo}/dependabot/alerts
```

### Customizing Auto-Merge Behavior

Edit `.github/workflows/dependabot-claude-review.yml` to adjust:

- Update types that auto-merge (patch/minor/major)
- Dependency types that auto-merge (dev/prod)
- Package ecosystems that auto-merge
- Claude prompts and review criteria
- Labels applied to PRs
- Auto-merge conditions

See `docs/PR-MERGE-RULES.md` for complete merge rules and behavior.

## Best Practices

1. **Review major updates carefully**: Check changelogs for breaking changes
2. **Monitor CI**: Ensure all checks pass before auto-merge occurs
3. **Check grouped PRs**: Grouped updates may include multiple dependency changes
4. **Security updates**: These are not grouped and should be reviewed promptly
5. **Keep branch protection**: Ensure required status checks prevent broken merges

## Troubleshooting

### Dependabot not creating PRs

1. Check `.github/dependabot.yml` syntax
2. Verify schedule configuration
3. Check if updates are already at latest version
4. Review Dependabot logs in Security > Dependabot

### Auto-merge not working

1. Ensure branch protection allows auto-merge
2. Check required status checks are passing
3. Verify GitHub token permissions (read/write for PRs and contents)
4. Review workflow run logs

### Too many PRs

1. Adjust grouping in `.github/dependabot.yml`
2. Reduce `open-pull-requests-limit`
3. Change schedule to less frequent (e.g., monthly)
4. Use multi-ecosystem groups (future feature)

## References

- [Dependabot configuration options](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference)
- [Grouped version updates](https://github.blog/changelog/2023-06-29-grouped-version-updates-for-dependabot-public-beta/)
- [Automating Dependabot with GitHub Actions](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/automating-dependabot-with-github-actions)
- [Multi-ecosystem updates](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/configuring-multi-ecosystem-updates)

## Future Enhancements

- [ ] Multi-ecosystem groups (when stable)
- [ ] Custom merge strategies per dependency
- [ ] Slack/email notifications for manual review PRs
- [ ] Automated changelog generation from Dependabot PRs
- [ ] Performance metrics tracking for dependency updates

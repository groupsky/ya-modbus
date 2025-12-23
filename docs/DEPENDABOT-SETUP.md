# Dependabot Setup Guide

## Overview

This repository is configured with GitHub Dependabot for automated dependency management, including grouped updates, verification workflows, and auto-merge capabilities for safe updates.

## Configuration Files

### `.github/dependabot.yml`

Main Dependabot configuration with:

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

### Workflows

#### `dependabot-verify.yml`

Validates Dependabot configuration coverage:

- ✅ Checks all package.json files are covered
- ✅ Validates YAML syntax
- ✅ Detects duplicate directory entries
- ✅ Verifies group configurations

**Triggers**: On push to main, PR changes to dependabot.yml or package.json files, weekly schedule, manual dispatch

#### `dependabot-auto-merge.yml`

Automated approval and merging for safe updates:

**Auto-approved and auto-merged**:

- ✅ Patch updates to development dependencies
- ✅ Minor updates to development dependencies
- ✅ Patch and minor updates to GitHub Actions

**Manual review required**:

- ⚠️ Major version updates (any dependency)
- ⚠️ Production dependency updates (any version)

**Features**:

- Fetches Dependabot metadata (dependency type, update type)
- Automatically approves safe PRs
- Enables auto-merge after CI passes
- Adds labels: `dependabot-approved`, `dependabot-auto-merge`, `dependabot-manual-review`
- Comments on PRs requiring manual review with checklist
- Requests code owner review for production changes

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

Dependabot PRs are automatically handled based on update type:

**Patch/Minor Dev Deps & GitHub Actions**:

- Automatically approved
- Automatically merged after CI passes
- No action needed

**Major Updates & Production Deps**:

- Comment added with review checklist
- Code owner review requested
- Manual approval and merge required

### Manual Dependabot Triggers

```bash
# Trigger Dependabot manually (requires GitHub CLI with Dependabot API access)
gh api -X POST /repos/{owner}/{repo}/dependabot/updates

# View Dependabot alerts
gh api /repos/{owner}/{repo}/dependabot/alerts
```

### Customizing Auto-Merge Behavior

Edit `.github/workflows/dependabot-auto-merge.yml` to adjust:

- Update types that auto-merge
- Dependency types that auto-merge
- Package ecosystems that auto-merge
- Labels applied to PRs

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

# Pull Request Merge Rules

This document defines the rules and procedures for merging pull requests in this repository.

## Table of Contents

- [General Merge Requirements](#general-merge-requirements)
- [Merge Strategies](#merge-strategies)
- [Dependabot PRs](#dependabot-prs)
- [Human-Created PRs](#human-created-prs)
- [Commit Message Formatting](#commit-message-formatting)
- [Automated Workflows](#automated-workflows)

## General Merge Requirements

**ALL pull requests must meet these requirements before merging:**

1. ✅ **All CI checks must pass**
   - Tests must pass on all supported Node.js versions (20.x, 22.x, 24.x)
   - Build must complete successfully
   - Linting must pass with no errors

2. ✅ **Code review approval**
   - For Dependabot PRs: Claude must approve (see [Dependabot PRs](#dependabot-prs))
   - For human PRs: At least one human reviewer approval required

3. ✅ **No merge conflicts** with the base branch

4. ✅ **Branch protection rules satisfied**
   - Required status checks passed
   - Approved reviews from code owners (if applicable)

## Merge Strategies

### Default Strategy: Squash and Merge

**Always use squash commits** for merging PRs. This keeps the main branch history clean and linear.

```bash
gh pr merge --squash <pr-number>
```

**Benefits:**

- Clean, linear history on main branch
- Each PR becomes a single commit
- Easy to revert if needed
- Easier to understand project history

### When NOT to Squash

Never use squash for:

- Merge commits from other branches with important history
- PRs that need to preserve individual commits for attribution

## Dependabot PRs

Dependabot PRs are handled by specialized Claude workflows depending on whether they update a single dependency or multiple dependencies (grouped).

### Single vs Grouped PRs

**Single-Dependency PRs**:

- Update one package at a time
- Handled by `dependabot-claude-review.yml`
- Strategy based on semantic version type (patch/minor/major)

**Grouped PRs**:

- Update multiple packages together (e.g., "npm-typescript" group)
- Handled by `dependabot-claude-review-grouped.yml`
- Claude analyzes EACH dependency individually
- Provides comprehensive review covering all update types

### Single-Dependency PR Strategies

### Patch Updates (`version-update:semver-patch`)

**Strategy: Auto-merge after Claude approval**

1. Claude performs quick review of changes
2. If approved: Auto-merge enabled after CI passes
3. If issues found: Manual review required

**Auto-merge conditions:**

- Update type is patch
- All CI checks pass
- Claude approves with: `✅ **APPROVED**`
- Dependency type is either:
  - Development dependency (any ecosystem)
  - Production dependency (npm only, with caution)

### Minor Updates (`version-update:semver-minor`)

**Strategy: Claude review + feature inspection**

1. Claude reviews changes and looks for new features
2. If beneficial features found: Claude creates GitHub issue for future exploration
3. Auto-merge for development dependencies after Claude approval
4. Manual merge for production dependencies after Claude approval

**Auto-merge conditions:**

- Update type is minor
- Dependency type is `direct:development`
- All CI checks pass
- Claude approves with: `✅ **APPROVED**`

**Manual merge conditions:**

- Update type is minor
- Dependency type is `direct:production`
- Claude approves but flags for manual merge
- Labeled: `dependabot-approved`, `ready-to-merge`

### Major Updates (`version-update:semver-major`)

**Strategy: Claude analysis + breaking change handling + feature inspection**

Claude analyzes breaking changes AND inspects new features, then takes appropriate actions:

#### Breaking Change Actions

##### 1. Simple Breaking Changes (Fixable)

**If changes are simple (< 10 lines of code):**

- Claude analyzes exactly what needs to change
- Provides complete code snippets in PR comment
- Creates GitHub issue with full code changes
- Issue labeled: `breaking-change`, `dependencies`, `easy-fix`
- Comments: `🔧 **FIXABLE**` with issue link
- PR stays open for manual application of fixes
- Manual review and merge required after fixes applied

##### 2. Complex Breaking Changes

**If changes require significant work:**

- Claude creates detailed migration issue:
  - Title: `Migration required: [package] vX → vY`
  - Description: Breaking changes, affected areas, migration steps
  - Labels: `breaking-change`, `dependencies`, `help wanted`
- Claude comments on PR: `⚠️ **MIGRATION REQUIRED**`
- Claude closes PR with explanation
- Migration tracked in issue

##### 3. No Impact Breaking Changes

**If breaking changes don't affect our code:**

- Claude verifies by analyzing codebase
- Comments: `✅ **APPROVED**`
- Labeled: `dependabot-approved`, `ready-to-merge`
- Manual merge required after CI passes

#### New Feature Opportunities

**In addition to handling breaking changes:**

- Claude reviews changelog for beneficial new features
- Creates separate GitHub issues for significant opportunities:
  - Title: `Explore new features from [package] vX.Y.Z`
  - Description: New features, potential use cases, benefits
  - Labels: `enhancement`, `dependencies`
- Mentions feature issues in PR comment

### Grouped PR Strategy

**When Dependabot creates a PR with MULTIPLE dependencies:**

#### Claude's Workflow

1. **Parse PR changes** - Extract each dependency and its version change
2. **Categorize updates** - Group by patch/minor/major for each package
3. **Analyze each category**:
   - **Patch updates**: Quick validation
   - **Minor updates**: Feature inspection + create enhancement issues
   - **Major updates**: Breaking change analysis + migration or fixes
4. **Provide comprehensive summary**:

   ```
   ## Grouped Dependency Review

   ### Summary
   - X patch updates (low risk)
   - Y minor updates (new features available)
   - Z major updates (breaking changes)

   ### Patch Updates ✅
   - package-a: v1.0.0 → v1.0.1

   ### Minor Updates ⬆️
   - package-b: v2.0.0 → v2.1.0 (issue #123 created)

   ### Major Updates ⚠️
   - package-c: v3.0.0 → v4.0.0
     - Breaking changes analyzed
     - Action taken: [fix/migration/approved]

   ### Overall Recommendation
   [APPROVED / NEEDS FIXES / MIGRATION REQUIRED]
   ```

#### Auto-Merge Criteria for Grouped PRs

**Auto-merge enabled when:**

- All individual dependencies analyzed
- Claude approves with `✅ **APPROVED**`
- All CI checks pass
- Dependency type is `direct:development`

**Note**: `🔧 **FIXABLE**`, `⚠️ **MIGRATION REQUIRED**`, and `⚠️ **REVIEW NEEDED**` require manual intervention and will NOT auto-merge.

**Manual merge required when:**

- Any dependency is `direct:production`
- Any major update detected
- Claude flags for manual review

## Human-Created PRs

### Review Process

1. Create PR with descriptive title and description
2. Request review from appropriate code owners
3. Address review comments
4. Ensure CI passes
5. Get approval from at least one reviewer

### Merge Process

**When all requirements met:**

```bash
# Merge with squash
gh pr merge --squash <pr-number>

# Or use GitHub UI "Squash and merge" button
```

### Self-Merge Policy

Contributors may self-merge when:

- PR is trivial (docs, typos, formatting)
- Emergency hotfix (with post-merge review)
- All CI checks pass
- No pending review requests

## Commit Message Formatting

### Format Requirements

All merge commits must follow this format:

```
<type>(<scope>): <subject> (#<pr-number>)

<body>
```

**Requirements:**

- Always include PR number: `(#123)`
- Use plain text (no HTML tags)
- Format for terminal display
- Max 72 characters for subject line
- Wrap body at 72 characters

### Commit Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `ci`: CI/CD changes
- `build`: Build system changes
- `revert`: Revert previous commit

### Scope

Use one of:

- `core`: Core bridge functionality
- `devices`: Device drivers
- `cli`: CLI tools
- `converters`: Data converters
- `deps`: Dependency updates
- Package name (e.g., `mqtt-config`)

### Examples

**Good commit messages:**

```
feat(devices): add support for SDM630 energy meter (#42)

Implements SDM630Modbus driver for reading energy consumption data.
Includes full test coverage and emulator support.
```

```
chore(deps): bump actions/checkout from 4 to 6 (#35)

Updates GitHub Actions checkout action to latest version.
No breaking changes affecting our workflows.
```

```
fix(core): resolve mutex deadlock in RTU transport (#38)

Fixes issue where concurrent reads could cause deadlock.
Improves error handling and adds timeout protection.
```

**Bad commit messages:**

```
Update README.md  ❌ (no type, no PR number)
```

```
<b>feat(core)</b>: add feature  ❌ (HTML tags not allowed)
```

```
feat: add new feature  ❌ (missing scope and PR number)
```

### Dependabot Commit Messages

Dependabot PRs use a specific format:

```
chore(deps)(<ecosystem>): <dependency-action> <package> from <old> to <new> (#<pr>)
```

Example:

```
chore(deps)(npm): bump typescript from 5.7.0 to 5.8.0 (#45)
```

## Automated Workflows

### Workflow Files

- `dependabot-claude-review.yml`: Claude review for **single-dependency** Dependabot PRs
- `dependabot-claude-review-grouped.yml`: Claude review for **grouped** Dependabot PRs (multiple dependencies)
- `claude-code-review.yml`: Claude review for human PRs
- `ci.yml`: Continuous integration tests

**Note**: Dependabot can create two types of PRs:

1. **Single-dependency PRs**: One package update (handled by `dependabot-claude-review.yml`)
2. **Grouped PRs**: Multiple packages updated together (handled by `dependabot-claude-review-grouped.yml`)

### Workflow Behavior

**On PR open/update:**

1. CI runs tests and build
2. Dependabot PRs → `dependabot-claude-review.yml`
3. Human PRs → `claude-code-review.yml` (if @claude mentioned)

**Auto-merge enabled when:**

1. All CI checks pass
2. Claude approves
3. Meets auto-merge criteria (see [Dependabot PRs](#dependabot-prs))
4. PR is not in draft mode

**Merge execution:**

- GitHub auto-merge waits for all required checks
- Uses squash strategy automatically
- Preserves PR number in commit message
- Formats commit for terminal (no HTML)

### Labels

The workflows use these labels:

- `dependabot-approved`: Claude approved Dependabot PR
- `dependabot-auto-merge`: Enabled for auto-merge
- `dependabot-manual-review`: Requires human review
- `ready-to-merge`: Approved but needs manual merge
- `breaking-change`: Contains breaking changes
- `dependencies`: Dependency update
- `github-actions`: GitHub Actions workflow update
- `npm`: npm package update

## Troubleshooting

### PR Not Auto-Merging

**Check:**

1. Are all CI checks passing?
2. Did Claude approve with `✅ **APPROVED**`?
   - Note: `🔧 **FIXABLE**` requires manual fixes before merge
   - Note: `⚠️ **MIGRATION REQUIRED**` or `⚠️ **REVIEW NEEDED**` will NOT auto-merge
3. Is auto-merge enabled? (check PR page)
4. Does the PR meet auto-merge criteria?

**Manual intervention:**

```bash
# Check PR status
gh pr view <pr-number>

# Enable auto-merge manually
gh pr merge --auto --squash <pr-number>
```

### Claude Didn't Review

**Possible reasons:**

1. Workflow not triggered (check Actions tab)
2. Secrets not configured (`CLAUDE_CODE_OAUTH_TOKEN`)
3. PR is in draft mode
4. Workflow file syntax error

**Resolution:**

- Check GitHub Actions logs
- Verify secrets are set
- Re-run failed workflow
- Request manual review

### Merge Conflicts

**Resolution:**

1. Update PR branch with latest main:
   ```bash
   git checkout <branch>
   git merge main
   git push
   ```
2. Or use GitHub UI "Update branch" button
3. Wait for CI to re-run
4. Claude will re-review if needed

## References

- See `.github/workflows/dependabot-claude-review.yml` for workflow details
- See `docs/ARCHITECTURE.md` for system design
- See `CONTRIBUTING.md` for contribution guidelines

## Updating These Rules

When updating PR merge rules:

1. Update this document
2. Update relevant workflow files
3. Update `docs/AGENTS.md` if agent behavior changes
4. Announce changes in PR description
5. Get team approval for significant changes

# Dependabot + Claude Integration

Automated dependency management with Claude AI review and intelligent auto-merge decisions.

## Overview

This project uses Dependabot for dependency updates with Claude AI providing intelligent review, security analysis, and auto-merge decisions. The system distinguishes between single-dependency and grouped PRs, with different strategies for patch/minor/major updates.

## Workflow Files

- **`dependabot-claude-review.yml`**: Handles single-dependency Dependabot PRs
- **`dependabot-claude-review-grouped.yml`**: Handles grouped PRs (multiple dependencies)
- **`auto-merge-on-approval.yml`**: Auto-enables merge when trusted contributor approves `ready-to-merge` PRs
- **`dependabot-verify.yml`**: Validates Dependabot configuration coverage

## Single-Dependency PR Workflow

### Trigger

Dependabot opens/updates a PR with a single dependency change.

### Process

1. **Metadata Extraction**: Get semver update type (patch/minor/major)
2. **Claude Review**: Based on update type
3. **Auto-merge Decision**: Enable auto-merge if Claude approves and criteria met

### Update Type Strategies

#### Patch Updates (`version-update:semver-patch`)

- Claude performs quick validation
- Auto-merge for dev dependencies if approved
- Auto-merge for prod dependencies with caution

**Auto-merge criteria:**

- ✅ Dev dependencies: Auto-merge after CI passes
- ✅ Prod dependencies: Auto-merge after CI passes
- ❌ If Claude finds issues: Manual merge required

#### Minor Updates (`version-update:semver-minor`)

- Claude reviews and inspects new features
- Creates GitHub issues for beneficial features
- Auto-merge for dev dependencies only

**Auto-merge criteria:**

- ✅ Dev dependencies: Auto-merge after CI passes
- ⚠️ Prod dependencies: Manual merge required (labeled `ready-to-merge`)

#### Major Updates (`version-update:semver-major`)

- Claude analyzes breaking changes AND inspects new features
- **If fixable**: Claude suggests fixes via reviewdog
- **If complex**: Claude creates migration issue
- **If no impact**: Claude approves for manual merge
- **New features**: Claude creates separate enhancement issues

**Auto-merge criteria:**

- ❌ Never auto-merge major updates
- ⚠️ Labeled `ready-to-merge` for manual review
- 🔧 If fixable: Claude posts inline suggestions

## Grouped Dependabot PRs

### Workflow

`dependabot-claude-review-grouped.yml`

### Process

1. **Detect if grouped**: Check if PR has multiple dependencies
2. **Claude review**: Analyzes each dependency individually
   - Categorizes by update type (patch/minor/major)
   - For major updates with breaking changes, can suggest fixes via reviewdog
3. **Approval markers**:
   - ✅ **APPROVED** - Auto-merge enabled for dev deps
   - 🔧 **FIXABLE** - Manual fixes required (Claude posts suggestions)
   - ⚠️ **MIGRATION REQUIRED** - Complex migration needed
   - ⚠️ **REVIEW NEEDED** - Human review required
4. **Final verification** (if fixes applied):
   - Detects fix commits
   - Verifies contributor trust
   - Claude reviews fixes (with 30-second timeout)
   - Crafts updated commit message including fixes
5. **Auto-merge or label**: Based on dependency type and update type

### Timeout Behavior

**Final verification timeout**: 60 seconds

When fixes are applied to a grouped PR, the workflow polls for Claude's final verification comment:

- Checks every 2 seconds for up to 60 seconds (30 attempts)
- Looks for verification markers: `✅ **VERIFIED**` or `⚠️ **ISSUES FOUND**`
- Logs actual response time for monitoring
- If timeout occurs: Blocks auto-merge with warning comment

**Why 60 seconds?**

- Claude typically responds within 10-20 seconds for grouped PRs
- Large grouped PRs with many dependencies may need more time
- Allows generous buffer for GitHub API delays and PR comment posting
- Prevents indefinite waiting if Claude agent fails or errors

## Workflow Trigger Behavior

### Race Condition Handling

**Trigger**: `pull_request_target` (both single and grouped workflows)

The workflows use `pull_request_target` which automatically re-runs on PR updates, including:

- **`opened`**: Initial Dependabot PR creation
- **`synchronize`**: New commits pushed to the PR (including applied fixes)
- **`reopened`**: PR reopened after being closed

**How fix commits are handled:**

1. **Initial run**: Claude reviews Dependabot's changes, may post suggestions via reviewdog
2. **User applies fixes**: Either manually or via "Apply suggestion" button
3. **Automatic re-run**: `synchronize` event triggers workflow again
4. **Fix detection**: Workflow detects non-Dependabot commits
5. **Verification**: Contributor trust check + final Claude verification
6. **Auto-merge decision**: Based on verification results

**Important notes:**

- Fixes applied **during** workflow execution won't be detected in that run
- A new workflow run will trigger automatically when fixes are pushed
- Users should wait for Claude's initial review before applying fixes
- Multiple fix commits trigger multiple workflow runs (last one prevails)

**Best practice**: Apply fixes after Claude's initial review completes to avoid race conditions.

## Security Safeguards

All Dependabot PRs go through three layers of security verification:

### 1. First Commit Verification

- Verifies first commit in PR is from `dependabot[bot]`
- Prevents non-Dependabot PRs from triggering automated workflows
- Blocks malicious PRs masquerading as Dependabot

### 2. Contributor Trust Verification

When fix commits are applied after Claude's initial review:

- Uses reusable action: `.github/actions/verify-trusted-contributor`
- Verifies author has previous commits in repository
- Supports allowlist/denylist for explicit trust decisions
- Can check GitHub team membership
- Configurable commit history requirements

**Trust decision priority:**

1. Denylist (highest - blocks even allowlisted users)
2. Allowlist (always trusted)
3. Team membership (org team verification)
4. Commit history (fallback - default: ≥2 commits)

**Untrusted contributors:**

- PR blocked with security warning
- Manual review required from repository maintainer

### 3. Final Claude Verification

Before auto-merge of fix commits:

- Claude reviews all applied fixes
- Verifies fixes correctly address breaking changes
- Checks for bugs, security issues, unintended changes
- Crafts updated commit message including both:
  - Dependency update information
  - Summary of fixes applied
- Markers: `✅ **VERIFIED**` (approved) or `⚠️ **ISSUES FOUND**` (blocked)

## Commit Messages

Claude crafts descriptive commit messages based on changelog analysis:

### Single-Dependency PRs

**Format:**

```
chore(deps)(npm): bump package-name from 1.0.0 to 1.1.0

[2-5 line summary of key changes from changelog]

Applied fixes:
- [Summary of fixes if any were applied]
```

**Process:**

1. Claude analyzes changelog/release notes
2. Claude crafts message with key changes
3. Claude posts suggestion with hidden HTML marker
4. If fixes applied: Final verification crafts updated message
5. Auto-merge extracts latest message when merging

### Grouped PRs

**Format (≤3 dependencies):**

```
chore(deps)(npm): bump package-a, package-b, package-c

[3-6 line summary grouping similar changes]
```

**Format (>3 dependencies):**

```
chore(deps)(npm): bump 5 dependencies

[3-6 line summary grouping similar changes]
```

**Fallback** (if Claude doesn't provide message):

- Single: `chore(deps)(npm): bump <package> from <old> to <new> (#<pr>)`
- Grouped: `chore(deps)(npm): bump <count> dependencies (#<pr>)`

## Manual Approval Auto-Merge

### Workflow

`auto-merge-on-approval.yml`

### Purpose

Automatically enables auto-merge when a trusted contributor approves a PR labeled `ready-to-merge`.

### Trigger

`pull_request_review` event (when review submitted)

### Process

1. Checks review state is `approved`
2. Verifies PR has `ready-to-merge` + `dependabot-approved` labels
3. Verifies reviewer is trusted contributor (has previous commits)
4. Checks CI status (no failures)
5. If all pass: Enables auto-merge with squash strategy

### Security

- Only trusted contributors can trigger auto-merge
- Untrusted reviewers get warning comment
- Requires both Claude approval labels
- Won't enable if CI is failing

### Use Cases

- Production dependency minor/major updates
- Major GitHub Actions updates
- Any PR requiring manual review but suitable for auto-merge after approval

## Creating GitHub Suggestions

### Tool

[reviewdog](https://github.com/reviewdog/reviewdog) - Automated code review tool

### Purpose

Convert local code fixes into GitHub inline suggestions that users can apply with one click.

### Usage in Workflows

Reviewdog is installed in both Dependabot workflows:

```yaml
- name: Install reviewdog
  uses: reviewdog/action-setup@v1
  with:
    reviewdog_version: latest
```

Claude uses reviewdog to post local fixes as suggestions:

```bash
# 1. Claude makes local changes
# 2. Run tests to verify
npm test

# 3. Run linter and formatter
npm run lint
npm run format

# 4. Create diff and convert to suggestions
export REVIEWDOG_GITHUB_API_TOKEN="$GITHUB_TOKEN"
TMPFILE=$(mktemp)
git diff > "${TMPFILE}"

# 5. Post as GitHub suggestions
reviewdog -f=diff -f.diff.strip=1 -reporter=github-pr-review < "${TMPFILE}"

# 6. Clean up
git stash -u && git stash drop
rm -f "${TMPFILE}"
```

### Benefits

- Users can apply fixes with "Apply suggestion" button
- Supports multi-line changes, insertions, deletions
- Works with any linter/formatter outputting diffs
- Maintains user authorship when applied
- Claude can test changes locally before suggesting

### Configuration

**No repository configuration needed!**

The `GITHUB_TOKEN` is automatically available in GitHub Actions:

```yaml
env:
  REVIEWDOG_GITHUB_API_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Workflow Permissions

```yaml
permissions:
  contents: write # For auto-merge
  pull-requests: write # For comments and reviews
  issues: write # For creating issues
  actions: read # For checking CI status
```

## Security Considerations

### Use `pull_request_target` for Dependabot PRs

- Required for write permissions
- Checkout with `ref: ${{ github.event.pull_request.head.sha }}` for security
- Never run untrusted code from PR

### Token Usage

- Use `github_token: ${{ secrets.GITHUB_TOKEN }}` to avoid OIDC validation issues
- OIDC fails when workflow files are modified in PR (chicken-and-egg problem)

### Sparse Checkout

Workflows use sparse checkout to minimize exposure:

```yaml
- name: Checkout repository
  uses: actions/checkout@v6
  with:
    sparse-checkout: |
      .github/actions
    sparse-checkout-cone-mode: false
```

Only checks out what's needed for the workflow.

## References

- **Complete merge rules**: `docs/PR-MERGE-RULES.md`
- **Dependabot config**: `.github/dependabot.yml`
- **Workflow guide**: `.github/workflows/AGENTS.md`
- **Trusted contributor action**: `.github/actions/verify-trusted-contributor/README.md`

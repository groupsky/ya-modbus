# GitHub Actions Workflows - Agent Guide

## Node.js Version Management

**Default rule**: Always use `.nvmrc` for Node.js version in workflows.

```yaml
- name: Setup Node.js from .nvmrc
  uses: actions/setup-node@v6
  with:
    node-version-file: '.nvmrc'
    cache: 'npm'
```

**Exception**: When verifying runtime compatibility across multiple Node.js versions, generate matrix from `package.json` engines field.

See: `ci.yml` setup job for matrix generation implementation

## Rationale

- **`.nvmrc`**: Single source of truth for development and standard builds
- **`package.engines` matrix**: Tests all supported runtime versions
- **Verification step**: Ensures `.nvmrc` matches latest `package.engines` version

## When to Use Matrix

Use matrix testing when:

- Testing package compatibility across Node.js versions
- Verifying runtime behavior on supported engines
- Running integration tests on multiple platforms

Use `.nvmrc` when:

- Building artifacts for deployment
- Running linting, formatting, type checking
- Publishing packages
- Standard CI tasks that don't require multi-version testing

## Dependabot and Claude Integration

### Workflow Files

- **`dependabot-claude-review.yml`**: Primary workflow for Dependabot PR handling with Claude AI
- **`dependabot-claude-review-grouped.yml`**: Handles grouped Dependabot PRs (multiple dependencies)
- **`auto-merge-on-approval.yml`**: Auto-enables merge when trusted contributor approves `ready-to-merge` PRs
- **`claude-code-review.yml`**: Claude review for human-created PRs (on @claude mention)
- **`dependabot-verify.yml`**: Validates Dependabot configuration coverage

### Dependabot PR Workflow

**Trigger**: Dependabot opens/updates a PR

**Process**:

1. **Metadata Extraction**: Get semver update type (patch/minor/major)
2. **Claude Review** (based on update type):
   - **Patch**: Quick validation, auto-merge if approved
   - **Minor**: Review + feature inspection, create issues for beneficial features
   - **Major**: Breaking change analysis, fix or create migration issue
3. **Auto-merge Decision**: Enable auto-merge if Claude approves and meets criteria

### Update Type Strategies

**Patch Updates** (`version-update:semver-patch`):

- Claude performs quick review
- Auto-merge for dev dependencies if approved
- Auto-merge for prod dependencies with caution

**Minor Updates** (`version-update:semver-minor`):

- Claude reviews and inspects new features
- Creates GitHub issues for beneficial features
- Auto-merge for dev dependencies only
- Manual merge required for prod dependencies

**Major Updates** (`version-update:semver-major`):

- Claude analyzes breaking changes AND inspects new features
- **If fixable**: Claude implements fixes in PR
- **If complex**: Claude creates migration issue and closes PR
- **If no impact**: Claude approves for manual merge
- **New features**: Claude creates separate enhancement issues for beneficial features

### Security Considerations

**Use `pull_request_target` for Dependabot PRs**:

- Required for write permissions
- Checkout with `ref: ${{ github.event.pull_request.head.sha }}` for security
- Never run untrusted code from PR

**Token Usage**:

- Use `github_token: ${{ secrets.GITHUB_TOKEN }}` to avoid OIDC validation issues
- OIDC fails when workflow files are modified in PR (chicken-and-egg problem)

**Security Safeguards** (implemented in `dependabot-claude-review.yml`):

1. **First Commit Verification**:
   - Verifies first commit in PR is from `dependabot[bot]`
   - Prevents non-Dependabot PRs from triggering automated workflows
   - Blocks malicious PRs masquerading as Dependabot

2. **Contributor Trust Verification**:
   - For fix commits, verifies author has previous commits in repo
   - Uses GitHub API to check commit history
   - Untrusted contributors trigger manual review
   - Prevents unknown actors from injecting code

3. **Final Claude Verification**:
   - Before auto-merge of fix commits, Claude performs final review
   - Verifies fixes correctly address breaking changes
   - Checks for bugs, security issues, unintended changes
   - Markers: `✅ **VERIFIED**` (approved) or `⚠️ **ISSUES FOUND**` (blocked)

### Workflow Permissions

```yaml
permissions:
  contents: write # For auto-merge
  pull-requests: write # For comments and reviews
  issues: write # For creating issues
  actions: read # For checking CI status
```

### Manual Approval Auto-Merge

**Workflow**: `auto-merge-on-approval.yml`

**Purpose**: Automatically enables auto-merge when a trusted contributor approves a PR labeled `ready-to-merge`

**Trigger**: `pull_request_review` event (when review submitted)

**Process**:

1. Checks review state is `approved`
2. Verifies PR has `ready-to-merge` + `dependabot-approved` labels
3. Verifies reviewer is trusted contributor (has previous commits)
4. Checks CI status (no failures)
5. If all pass: Enables auto-merge with squash strategy

**Security**:

- Only trusted contributors can trigger auto-merge
- Untrusted reviewers get warning comment
- Requires both Claude approval labels
- Won't enable if CI is failing

**Use case**: Production dependency minor/major updates, major GitHub Actions updates

### Creating GitHub Suggestions from Local Changes

**Tool**: [reviewdog](https://github.com/reviewdog/reviewdog) + [action-suggester](https://github.com/reviewdog/action-suggester)

**Purpose**: Convert local code fixes into GitHub inline suggestions that users can apply with one click

**Installation**:

```bash
# Via curl
curl -sfL https://raw.githubusercontent.com/reviewdog/reviewdog/master/install.sh | sh -s

# Via Homebrew
brew install reviewdog/tap/reviewdog

# Via Go
go install github.com/reviewdog/reviewdog/cmd/reviewdog@latest
```

**Usage for Claude to create suggestions**:

```bash
# 1. Claude makes local changes (fixes breaking changes, applies linter, etc.)
# Example: Fix code to work with new dependency version
# ... Claude uses Edit/Write tools to make changes ...

# 2. Run tests to verify changes work
npm test

# 3. Run linter and formatter
npm run lint
npm run format

# 4. Create diff and convert to GitHub suggestions
export REVIEWDOG_GITHUB_API_TOKEN="$GITHUB_TOKEN"
TMPFILE=$(mktemp)
git diff > "${TMPFILE}"

# 5. Post as GitHub suggestions (multi-line, inline, deletions, etc.)
reviewdog -f=diff -f.diff.strip=1 -reporter=github-pr-review < "${TMPFILE}"

# 6. Optionally clean up
git stash -u && git stash drop
```

**Workflow integration** (for GitHub Actions):

```yaml
- name: Apply fixes and create suggestions
  run: |
    # Apply formatter/linter fixes
    npm run lint --fix
    npm run format

- name: Suggest changes
  uses: reviewdog/action-suggester@v1.21.0
  with:
    tool_name: eslint-fix
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

**Benefits**:

- Users can apply fixes with "Apply suggestion" button
- Supports multi-line changes, insertions, deletions
- Works with any linter/formatter outputting diffs
- Maintains user authorship when applied
- Claude can test changes locally before suggesting

**Limitations**:

- Requires `REVIEWDOG_GITHUB_API_TOKEN` environment variable
- Token needs `repo` scope (private) or `public_repo` (public)
- GitHub Actions: use `github_token: ${{ secrets.GITHUB_TOKEN }}`

### References

- **Complete merge rules**: `docs/PR-MERGE-RULES.md`
- **Dependabot config**: `.github/dependabot.yml`
- **Claude Code docs**: https://code.claude.com/docs

# Extract Claude Approval Status Action

Extracts Claude's approval status and decision markers from Dependabot PR comments.

## Purpose

Eliminates duplicate Claude approval checking logic across workflows by providing a reusable action that:

- Retrieves the latest Claude comment from a PR
- Detects approval/decision markers
- Handles fix commit special cases with contributor trust verification
- Outputs structured decision information

## Usage

### Basic approval check

```yaml
- name: Check Claude approval
  id: approval
  uses: ./.github/actions/extract-claude-approval
  with:
    pr-url: ${{ github.event.pull_request.html_url }}
    github-token: ${{ secrets.GITHUB_TOKEN }}

- name: Act on approval
  if: steps.approval.outputs.approved == 'true'
  run: echo "Claude approved!"
```

### With fix commit handling

```yaml
- name: Check if fix commit
  id: check-fix
  run: |
    # ... detect fix commit logic ...
    echo "is_fix=true" >> $GITHUB_OUTPUT
    echo "author=someuser" >> $GITHUB_OUTPUT

- name: Verify contributor trust
  id: verify-contributor
  uses: ./.github/actions/verify-trusted-contributor
  with:
    username: ${{ steps.check-fix-commit.outputs.fix_author }}
    github-token: ${{ secrets.GITHUB_TOKEN }}

- name: Check Claude approval
  id: check-approval
  uses: ./.github/actions/extract-claude-approval
  with:
    pr-url: ${{ github.event.pull_request.html_url }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    is-fix-commit: ${{ steps.check-fix-commit.outputs.is_fix_commit }}
    is-trusted-contributor: ${{ steps.verify-contributor.outputs.is_trusted }}
    fix-author: ${{ steps.check-fix-commit.outputs.fix_author }}
    trust-reason: ${{ steps.verify-contributor.outputs.reason }}
```

## Inputs

| Input                    | Required | Default   | Description                   |
| ------------------------ | -------- | --------- | ----------------------------- |
| `pr-url`                 | Yes      | -         | Pull request URL              |
| `github-token`           | Yes      | -         | GitHub token for API access   |
| `is-fix-commit`          | No       | `'false'` | Whether this is a fix commit  |
| `is-trusted-contributor` | No       | `'false'` | Whether fix author is trusted |
| `fix-author`             | No       | `''`      | Username of fix commit author |
| `trust-reason`           | No       | `''`      | Reason for trust decision     |

## Outputs

| Output               | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `approved`           | `'true'` if approved for auto-merge, `'false'` otherwise |
| `decision`           | Claude decision marker (see Decision Markers below)      |
| `needs-verification` | `'true'` if fix commit needs final verification          |
| `latest-comment`     | Full text of latest Claude comment                       |

## Decision Markers

The action detects the following markers in Claude's comments:

| Marker                      | Decision Value       | Meaning                  | Auto-merge Eligible             |
| --------------------------- | -------------------- | ------------------------ | ------------------------------- |
| `✅ **VERIFIED**`           | `VERIFIED`           | Fix commit verified safe | ✅ Yes                          |
| `✅ **APPROVED**`           | `APPROVED`           | Direct approval          | ✅ Yes                          |
| `🔧 **FIXABLE**`            | `FIXABLE`            | Fixable breaking changes | ⚠️ Only with trusted fix commit |
| `⚠️ **MIGRATION REQUIRED**` | `MIGRATION_REQUIRED` | Complex migration needed | ❌ No                           |
| `⚠️ **REVIEW NEEDED**`      | `REVIEW_NEEDED`      | Human review required    | ❌ No                           |
| `⚠️ **ISSUES FOUND**`       | `ISSUES_FOUND`       | Fix verification failed  | ❌ No                           |
| _(none found)_              | `NONE`               | No recognized marker     | ❌ No                           |

## Fix Commit Handling

When `is-fix-commit='true'`:

### Trusted Contributor

- **Decision**: `FIXABLE`
- **Approved**: `true`
- **Needs Verification**: `true`
- **Behavior**: Allows auto-merge after final Claude verification

### Untrusted Contributor

- **Decision**: `FIXABLE`
- **Approved**: `false`
- **Needs Verification**: `false`
- **Behavior**: Posts security warning, blocks auto-merge

## Security

- Posts security warning when untrusted contributor applies fixes
- Requires explicit trust verification for fix commits
- Prevents auto-merge until proper verification completes

## Examples

### Single-dependency workflow

```yaml
- name: Check Claude approval
  id: check-approval
  uses: ./.github/actions/extract-claude-approval
  with:
    pr-url: ${{ github.event.pull_request.html_url }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    is-fix-commit: ${{ steps.check-fix-commit.outputs.is_fix_commit }}
    is-trusted-contributor: ${{ steps.verify-contributor.outputs.is_trusted }}
    fix-author: ${{ steps.check-fix-commit.outputs.fix_author }}
    trust-reason: ${{ steps.verify-contributor.outputs.reason }}

- name: Final verification if needed
  if: steps.check-approval.outputs.needs-verification == 'true'
  uses: anthropics/claude-code-action@v1
  # ... verification logic ...
```

### Grouped workflow

```yaml
- name: Check Claude approval
  id: check-approval
  uses: ./.github/actions/extract-claude-approval
  with:
    pr-url: ${{ github.event.pull_request.html_url }}
    github-token: ${{ secrets.GITHUB_TOKEN }}

- name: Auto-approve if Claude approved
  if: steps.check-approval.outputs.approved == 'true'
  run: gh pr review --approve "$PR_URL"
```

### Check specific decision

```yaml
- name: Create migration issue if needed
  if: steps.approval.outputs.decision == 'MIGRATION_REQUIRED'
  run: |
    gh issue create --title "Migration needed" \
      --body "See PR #${{ github.event.pull_request.number }}"
```

## Related Actions

- `.github/actions/verify-dependabot-pr` - Verifies PR is genuine Dependabot PR
- `.github/actions/verify-trusted-contributor` - Verifies contributor trustworthiness
- `.github/actions/extract-claude-commit-message` - Extracts commit message from Claude's comments

## Implementation Notes

- Searches for markers in Claude's **latest comment only**
- Uses `grep -q` for efficient marker detection
- Supports all Claude decision markers from both single and grouped workflows
- Standardized messaging using emojis (✅, ❌, ⚠️, ℹ️, 📊)

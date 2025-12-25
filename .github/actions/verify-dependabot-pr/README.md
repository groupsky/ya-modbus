# Verify Dependabot PR Action

Verifies that a pull request is a genuine Dependabot PR by checking the first commit author.

## Purpose

Provides security validation to ensure that automated Dependabot workflows only trigger for genuine Dependabot PRs. Prevents malicious PRs masquerading as Dependabot PRs from triggering automated review and merge workflows.

## How It Works

1. Fetches all commits from the PR using GitHub CLI
2. Validates the PR has at least one commit
3. Extracts the author of the first commit
4. Checks if the author is `dependabot[bot]` or `app/dependabot`
5. Outputs verification result and metadata

## Usage

### Basic Verification

```yaml
- name: Verify Dependabot PR
  id: verify
  uses: ./.github/actions/verify-dependabot-pr
  with:
    pr-url: ${{ github.event.pull_request.html_url }}
    github-token: ${{ secrets.GITHUB_TOKEN }}

- name: Exit if not Dependabot
  if: steps.verify.outputs.is-dependabot-pr != 'true'
  run: |
    echo "⚠️  Not a Dependabot PR - skipping"
    exit 0
```

### With Metadata

```yaml
- name: Verify Dependabot PR
  id: verify
  uses: ./.github/actions/verify-dependabot-pr
  with:
    pr-url: ${{ github.event.pull_request.html_url }}
    github-token: ${{ secrets.GITHUB_TOKEN }}

- name: Show PR info
  if: steps.verify.outputs.is-dependabot-pr == 'true'
  run: |
    echo "First commit author: ${{ steps.verify.outputs.first-commit-author }}"
    echo "Total commits: ${{ steps.verify.outputs.commit-count }}"
```

## Inputs

| Input          | Required | Description                 |
| -------------- | -------- | --------------------------- |
| `pr-url`       | Yes      | Pull request URL            |
| `github-token` | Yes      | GitHub token for API access |

## Outputs

| Output                | Description                                                      |
| --------------------- | ---------------------------------------------------------------- |
| `is-dependabot-pr`    | `'true'` if first commit is from Dependabot, `'false'` otherwise |
| `first-commit-author` | Login of the first commit author                                 |
| `commit-count`        | Total number of commits in the PR                                |

## Security Considerations

### Why Check First Commit?

- Dependabot always creates the initial PR commit
- Subsequent commits may be from users applying fixes
- First commit verification prevents PR hijacking

### Recognized Dependabot Identities

- `dependabot[bot]` - Standard GitHub bot identity
- `app/dependabot` - Alternative bot identity format

### What This Prevents

- Non-Dependabot PRs triggering automated workflows
- Malicious PRs masquerading as Dependabot PRs
- Unauthorized auto-merge of user-created PRs

## Debug Mode

Supports GitHub Actions debug logging via `ACTIONS_STEP_DEBUG`:

```bash
# Enable debug mode
gh secret set ACTIONS_STEP_DEBUG --body "true"

# Or as repository variable
gh variable set ACTIONS_STEP_DEBUG --body "true"
```

When enabled:

- Bash verbose mode (`set -x`) activates
- All command executions are logged
- Visual indicator "🐛 Debug mode enabled" appears

## Used By

- `.github/workflows/dependabot-claude-review.yml` - Single-dependency PRs
- `.github/workflows/dependabot-claude-review-grouped.yml` - Grouped PRs

## Related Actions

- `.github/actions/verify-trusted-contributor` - Verifies contributor trustworthiness for fix commits
- `.github/actions/extract-claude-approval` - Extracts Claude's approval status

## Implementation Notes

- Requires `gh` CLI and `jq` (available in GitHub Actions runners)
- Exits gracefully if PR has no commits
- Uses standardized emoji messaging (✅, ❌, ℹ️, 🐛)
- Outputs all metadata regardless of verification result

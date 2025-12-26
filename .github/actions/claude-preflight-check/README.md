# Claude Pre-flight Check Action

Validates prerequisites before Claude API invocation to fail fast on authentication and rate limit issues.

## Purpose

This action implements the first layer of the circuit breaker pattern by checking:

1. Claude OAuth token validity (presence and format)
2. GitHub API rate limit status

By detecting issues before invoking Claude, workflows can:

- Fail fast with clear error messages
- Avoid wasting Claude API quota on invalid requests
- Post informative comments when prerequisites aren't met

## Usage

```yaml
- name: Pre-flight check
  id: preflight
  uses: ./.github/actions/claude-preflight-check
  with:
    claude-oauth-token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    min-github-rate-limit: '200'

- name: Run Claude only if ready
  if: steps.preflight.outputs.ready == 'true'
  uses: anthropics/claude-code-action@v1
  with:
    claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
    github_token: ${{ secrets.GITHUB_TOKEN }}
    prompt: |
      Your prompt here
```

## Inputs

| Input                   | Description                            | Required | Default |
| ----------------------- | -------------------------------------- | -------- | ------- |
| `claude-oauth-token`    | Claude Code OAuth token to validate    | Yes      | -       |
| `github-token`          | GitHub token for rate limit checks     | Yes      | -       |
| `min-github-rate-limit` | Minimum GitHub API rate limit required | No       | `'200'` |

## Outputs

| Output                 | Description                                                                   |
| ---------------------- | ----------------------------------------------------------------------------- |
| `ready`                | `'true'` if all checks passed, `'false'` otherwise                            |
| `failure-reason`       | Reason for failure: `token-missing`, `token-invalid`, `rate-limit`, or `none` |
| `rate-limit-remaining` | Current GitHub API rate limit remaining                                       |

## Validation Checks

### 1. Claude OAuth Token

**Token Missing**:

- Output: `ready='false'`, `failure-reason='token-missing'`
- Indicates: `CLAUDE_CODE_OAUTH_TOKEN` secret not configured
- Action: Configure secret in repository settings

**Token Invalid**:

- Output: `ready='false'`, `failure-reason='token-invalid'`
- Indicates: Token is too short (< 20 characters)
- Action: Regenerate token

**Token Valid**:

- Output: `ready='true'`
- Checks: Non-empty and >= 20 characters

### 2. GitHub API Rate Limit

**Rate Limit Check**:

- Uses `bash-utilities` action's `check_rate_limit` function
- Default threshold: 200 requests remaining
- Low rate limit is a **warning** (doesn't block Claude invocation)
- Claude uses its own API quota, separate from GitHub

**Note**: GitHub rate limit affects workflow's ability to:

- Post comments
- Add labels
- Approve PRs
- Create issues

## Error Handling

**Action fails with exit code 1 when**:

- Claude token is missing
- Claude token appears invalid

**Action succeeds with warning when**:

- GitHub rate limit is low but above minimum

**Graceful degradation**:

- If rate limit check fails, assumes unlimited and continues
- Logs all checks for debugging

## Examples

### Basic Usage

```yaml
- name: Validate Claude prerequisites
  id: check
  uses: ./.github/actions/claude-preflight-check
  with:
    claude-oauth-token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
    github-token: ${{ secrets.GITHUB_TOKEN }}

- name: Invoke Claude if ready
  if: steps.check.outputs.ready == 'true'
  uses: anthropics/claude-code-action@v1
  # ... Claude configuration ...
```

### With Custom Rate Limit Threshold

```yaml
- name: Pre-flight check with high threshold
  id: preflight
  uses: ./.github/actions/claude-preflight-check
  with:
    claude-oauth-token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    min-github-rate-limit: '500' # Require 500 API calls remaining
```

### With Failure Handling

```yaml
- name: Pre-flight check
  id: preflight
  uses: ./.github/actions/claude-preflight-check
  with:
    claude-oauth-token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
  continue-on-error: true # Don't fail workflow

- name: Handle pre-flight failure
  if: steps.preflight.outputs.ready != 'true'
  run: |
    echo "Pre-flight failed: ${{ steps.preflight.outputs.failure-reason }}"
    gh pr comment "$PR_URL" --body "⚠️ Claude pre-flight check failed: ${{ steps.preflight.outputs.failure-reason }}"
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    PR_URL: ${{ github.event.pull_request.html_url }}
```

## Dependencies

- `.github/actions/bash-utilities` - For rate limit checking functions
- `gh` CLI - For GitHub API rate limit queries

## Design Philosophy

**Fail Fast**:

- Detect issues before expensive Claude invocation
- Provide clear failure reasons for quick debugging

**Non-Blocking Where Appropriate**:

- GitHub rate limit is a warning, not a blocker
- Claude has separate API quota

**Observable**:

- Outputs structured data for decision-making
- Logs all checks with clear status messages

## Related Actions

- `.github/actions/claude-failure-handler` - Handles Claude invocation failures
- `.github/actions/bash-utilities` - Provides rate limiting utilities

## Troubleshooting

### "Claude OAuth token is missing"

**Cause**: `CLAUDE_CODE_OAUTH_TOKEN` secret not configured

**Solution**:

1. Go to repository Settings → Secrets and variables → Actions
2. Add secret named `CLAUDE_CODE_OAUTH_TOKEN`
3. Obtain token from Claude Code authentication flow
4. Re-run workflow

### "Claude OAuth token appears invalid"

**Cause**: Token is too short (corrupt or incomplete)

**Solution**:

1. Regenerate Claude Code OAuth token
2. Update `CLAUDE_CODE_OAUTH_TOKEN` secret
3. Re-run workflow

### "GitHub API rate limit low"

**Cause**: Many API calls consumed (not Claude's fault)

**Solution**:

- This is a warning, workflow continues
- Rate limit resets hourly
- Consider reducing GitHub API calls in workflows
- Check for rate limit in other concurrent workflows

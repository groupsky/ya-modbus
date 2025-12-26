# Claude Failure Handler Action

Handles Claude API failures gracefully with informative PR comments and appropriate labels.

## Purpose

This action implements the second layer of the circuit breaker pattern by:

1. Detecting Claude invocation failures
2. Categorizing failure types (auth, rate-limit, timeout, unknown)
3. Posting informative comments to PRs
4. Adding appropriate labels for tracking
5. Determining if failure is retryable or requires manual intervention

## Usage

```yaml
- name: Run Claude Review
  id: claude-review
  uses: anthropics/claude-code-action@v1
  with:
    claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
    github_token: ${{ secrets.GITHUB_TOKEN }}
    prompt: |
      Your prompt here
  continue-on-error: true # Allow workflow to handle failure

- name: Handle Claude failure
  if: always()
  uses: ./.github/actions/claude-failure-handler
  with:
    pr-url: ${{ github.event.pull_request.html_url }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    claude-step-outcome: ${{ steps.claude-review.outcome }}
    context-description: 'patch update review'
    failure-type: 'unknown' # or 'auth', 'rate-limit', 'timeout'
```

## Inputs

| Input                 | Description                                                                 | Required | Default     |
| --------------------- | --------------------------------------------------------------------------- | -------- | ----------- |
| `pr-url`              | Pull request URL for posting failure comments                               | Yes      | -           |
| `github-token`        | GitHub token for API access                                                 | Yes      | -           |
| `claude-step-outcome` | Outcome of the Claude step: `success`, `failure`, `cancelled`, or `skipped` | Yes      | -           |
| `context-description` | Description of what Claude was doing (e.g., "patch update review")          | Yes      | -           |
| `failure-type`        | Optional failure type hint: `timeout`, `auth`, `rate-limit`, or `unknown`   | No       | `'unknown'` |

## Outputs

| Output               | Description                                                       |
| -------------------- | ----------------------------------------------------------------- |
| `handled`            | `'true'` if failure was handled, `'false'` if no failure occurred |
| `fallback-to-manual` | `'true'` if manual review is required as fallback                 |
| `should-retry`       | `'true'` if this was a transient failure that could be retried    |

## Failure Types

### Authentication Error (`auth`, `token-missing`, `token-invalid`)

**Indicators**:

- Missing or invalid Claude OAuth token
- HTTP 401 Unauthorized errors

**Posted Comment**:

- Title: 🔐 Authentication Error
- Labels: `claude-failed`, `manual-review-required`, `security`
- Retryable: No
- Fallback: Manual review required

**Action Items**:

1. Verify `CLAUDE_CODE_OAUTH_TOKEN` secret is configured
2. Check if token has expired
3. Regenerate token if needed
4. Re-run workflow

### Rate Limit (`rate-limit`)

**Indicators**:

- HTTP 429 Too Many Requests
- Rate limit exceeded errors

**Posted Comment**:

- Title: ⏱️ Rate Limit Reached
- Labels: `claude-failed`, `rate-limit`
- Retryable: Yes (usually temporary)
- Fallback: Manual review if persistent

**Action Items**:

1. Wait for rate limit to reset (typically 1 hour)
2. Re-run workflow
3. Contact maintainer if persistent

### Timeout (`timeout`)

**Indicators**:

- Step timeout exceeded
- No response within expected timeframe

**Posted Comment**:

- Title: ⏰ Timeout
- Labels: `claude-failed`, `timeout`
- Retryable: Yes
- Fallback: Manual review if timeout persists

**Action Items**:

1. Re-run workflow to retry
2. Consider manual review if persistent
3. May indicate complex dependency analysis

### Cancelled (`cancelled`)

**Indicators**:

- Workflow manually cancelled
- Step cancelled by user or system

**Posted Comment**:

- Title: 🚫 Cancelled
- Labels: `claude-cancelled`
- Retryable: Yes
- Fallback: No (not a failure)

**Action Items**:

1. Re-run workflow if cancellation was accidental
2. Review logs for cancellation reason

### Unknown Error (`unknown`)

**Indicators**:

- Unexpected errors
- Unclassified failures

**Posted Comment**:

- Title: ❌ Unknown Error
- Labels: `claude-failed`, `manual-review-required`
- Retryable: Yes (attempt once)
- Fallback: Manual review if retry fails

**Action Items**:

1. Check workflow logs for details
2. Re-run workflow to retry
3. Manual review if error persists
4. Report bug if reproducible

## Posted Comment Format

```markdown
## [Title] - Claude Review Failed

**Context**: [what Claude was doing]
**Status**: [outcome]
**Failure Type**: [type]

[Failure message]

[Action items specific to failure type]

---

**Circuit Breaker Status**: 🔴 Open (blocking auto-merge)
**Manual Review Required**: [Yes/No]
**Can Retry**: [Yes/No]

For more details, check the [workflow run logs](link).
```

## Labels Added

| Label                    | When Added                       | Purpose                     |
| ------------------------ | -------------------------------- | --------------------------- |
| `claude-failed`          | All failures                     | Track Claude API failures   |
| `manual-review-required` | Auth errors, persistent failures | Requires human intervention |
| `security`               | Auth errors                      | Security-related issues     |
| `rate-limit`             | Rate limit errors                | Track rate limiting issues  |
| `timeout`                | Timeout errors                   | Track timeout patterns      |
| `claude-cancelled`       | Cancelled workflows              | Track cancellations         |

## Examples

### Basic Usage

```yaml
- name: Claude Review
  id: review
  uses: anthropics/claude-code-action@v1
  with:
    claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
    github_token: ${{ secrets.GITHUB_TOKEN }}
    prompt: 'Review this PR'
  continue-on-error: true

- name: Handle failure
  if: always()
  uses: ./.github/actions/claude-failure-handler
  with:
    pr-url: ${{ github.event.pull_request.html_url }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    claude-step-outcome: ${{ steps.review.outcome }}
    context-description: 'PR code review'
```

### With Pre-flight Check

```yaml
- name: Pre-flight check
  id: preflight
  uses: ./.github/actions/claude-preflight-check
  with:
    claude-oauth-token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
    github-token: ${{ secrets.GITHUB_TOKEN }}

- name: Claude Review
  id: review
  if: steps.preflight.outputs.ready == 'true'
  uses: anthropics/claude-code-action@v1
  # ... config ...
  continue-on-error: true

- name: Handle pre-flight failure
  if: steps.preflight.outputs.ready != 'true'
  uses: ./.github/actions/claude-failure-handler
  with:
    pr-url: ${{ github.event.pull_request.html_url }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    claude-step-outcome: 'failure'
    context-description: 'dependency update review'
    failure-type: ${{ steps.preflight.outputs.failure-reason }}

- name: Handle Claude failure
  if: always() && steps.review.outcome != 'success'
  uses: ./.github/actions/claude-failure-handler
  with:
    pr-url: ${{ github.event.pull_request.html_url }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    claude-step-outcome: ${{ steps.review.outcome }}
    context-description: 'dependency update review'
```

### Conditional Workflow Continuation

```yaml
- name: Handle failure
  if: always()
  id: handler
  uses: ./.github/actions/claude-failure-handler
  with:
    pr-url: ${{ github.event.pull_request.html_url }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    claude-step-outcome: ${{ steps.claude-review.outcome }}
    context-description: 'major update breaking change analysis'

- name: Fallback to manual review
  if: steps.handler.outputs.fallback-to-manual == 'true'
  run: |
    echo "⚠️  Claude failed - enabling manual review path"
    gh pr edit "$PR_URL" --add-label "ready-for-manual-review"
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    PR_URL: ${{ github.event.pull_request.html_url }}

- name: Continue auto-merge if retryable
  if: steps.handler.outputs.should-retry == 'true'
  run: |
    echo "ℹ️  Transient failure - workflow can be retried"
```

## Circuit Breaker States

This action manages circuit breaker state through labels:

| State        | Labels                   | Meaning                               |
| ------------ | ------------------------ | ------------------------------------- |
| 🟢 Closed    | None                     | No failures, normal operation         |
| 🔴 Open      | `claude-failed`          | Failure detected, blocking auto-merge |
| ⚠️ Half-Open | `claude-failed` + retry  | Allow retry attempt                   |
| 🔒 Locked    | `manual-review-required` | Requires human intervention           |

## Dependencies

- `.github/actions/bash-utilities` - For standardized messaging
- `gh` CLI - For posting comments and managing labels

## Design Philosophy

**Informative**:

- Clear, actionable error messages
- Links to workflow logs
- Specific action items for each failure type

**User-Friendly**:

- Posted comments visible in PR
- Labels for filtering and tracking
- Circuit breaker status clearly indicated

**Intelligent Retry Logic**:

- Distinguishes transient vs permanent failures
- Suggests retry for transient issues
- Blocks auto-merge on persistent failures

## Related Actions

- `.github/actions/claude-preflight-check` - Pre-flight validation
- `.github/actions/bash-utilities` - Messaging utilities

## Troubleshooting

### "Failure handler didn't post comment"

**Possible causes**:

- GitHub token doesn't have `pull-requests: write` permission
- PR URL is incorrect
- Rate limit on GitHub API

**Solution**:

- Check workflow permissions
- Verify PR URL format
- Check GitHub API rate limit

### "Labels not added"

**Possible causes**:

- Labels don't exist in repository
- Token lacks permissions

**Solution**:

- Create labels (see `.github/labels.yml` or create manually)
- Verify token has `pull-requests: write` permission
- Check workflow logs for specific errors

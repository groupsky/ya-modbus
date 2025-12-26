# Circuit Breaker Pattern for Claude API

This document describes the circuit breaker pattern implemented for Claude API invocations to handle failures gracefully.

## Overview

The circuit breaker pattern wraps all Claude API invocations with:

1. **Pre-flight checks** - Validate prerequisites before calling Claude
2. **Failure handling** - Detect and handle Claude API failures gracefully
3. **Informative feedback** - Post clear error messages to PRs when failures occur

## Architecture

### Components

#### 1. Pre-flight Check Action (`.github/actions/claude-preflight-check`)

**Purpose**: Validates prerequisites before invoking Claude API

**Checks**:

- Claude OAuth token presence and format validation
- GitHub API rate limit status

**Outputs**:

- `ready` - Boolean indicating if all checks passed
- `failure-reason` - Type of failure (`token-missing`, `token-invalid`, `rate-limit`, `none`)
- `rate-limit-remaining` - Current GitHub API rate limit

**Failure Modes**:

- `token-missing` - `CLAUDE_CODE_OAUTH_TOKEN` secret not configured
- `token-invalid` - Token appears corrupt (< 20 characters)
- Rate limit warning - Low GitHub API rate limit (not blocking)

#### 2. Failure Handler Action (`.github/actions/claude-failure-handler`)

**Purpose**: Handles Claude API failures with informative comments and labels

**Detects**:

- Pre-flight failures (auth, token issues)
- Claude invocation failures (timeout, error, cancelled)
- Post-execution failures

**Outputs**:

- `handled` - Boolean indicating if failure was handled
- `fallback-to-manual` - Boolean indicating manual review required
- `should-retry` - Boolean indicating if failure is transient

**Failure Types**:

| Type                                       | Description                   | Retryable | Auto-Merge Impact |
| ------------------------------------------ | ----------------------------- | --------- | ----------------- |
| `auth` / `token-missing` / `token-invalid` | Authentication failure        | No        | Blocked           |
| `rate-limit`                               | Claude API rate limit reached | Yes       | Blocked           |
| `timeout`                                  | Claude didn't respond in time | Yes       | Blocked           |
| `cancelled`                                | Workflow cancelled by user    | Yes       | Not blocked       |
| `unknown`                                  | Unexpected error              | Yes       | Blocked           |

**Actions Taken**:

- Posts informative comment to PR with context and resolution steps
- Adds labels: `claude-failed`, `manual-review-required`, `rate-limit`, `timeout`, etc.
- Provides clear "Can Retry" and "Manual Review Required" indicators

## Integration Pattern

All workflows invoking Claude use this pattern:

```yaml
# 1. Checkout for reusable actions
- name: Checkout repository
  uses: actions/checkout@v6
  with:
    sparse-checkout: |
      .github/actions
    sparse-checkout-cone-mode: false

# 2. Pre-flight check
- name: Claude pre-flight check
  id: preflight
  uses: ./.github/actions/claude-preflight-check
  with:
    claude-oauth-token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
  continue-on-error: true

# 3. Handle pre-flight failure
- name: Handle pre-flight failure
  if: steps.preflight.outputs.ready != 'true'
  uses: ./.github/actions/claude-failure-handler
  with:
    pr-url: ${{ github.event.pull_request.html_url }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    claude-step-outcome: 'failure'
    context-description: 'patch update review'
    failure-type: ${{ steps.preflight.outputs.failure-reason }}

# 4. Invoke Claude (only if pre-flight passed)
- name: Run Claude Review
  id: claude-review
  if: steps.preflight.outputs.ready == 'true'
  uses: anthropics/claude-code-action@v1
  with:
    claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
    github_token: ${{ secrets.GITHUB_TOKEN }}
    prompt: |
      [Your prompt here]
  continue-on-error: true

# 5. Handle Claude execution failure
- name: Handle Claude review failure
  if: always()
  uses: ./.github/actions/claude-failure-handler
  with:
    pr-url: ${{ github.event.pull_request.html_url }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    claude-step-outcome: ${{ steps.claude-review.outcome }}
    context-description: 'patch update review'
```

## Workflows Using Circuit Breaker

All Claude-invoking workflows use the circuit breaker:

1. **`dependabot-claude-review.yml`** - Single dependency PRs
   - Patch review job
   - Minor review job
   - Major review job
   - Final verification (fix commit review)

2. **`dependabot-claude-review-grouped.yml`** - Grouped dependency PRs
   - Grouped review job
   - Final verification (fix commit review)

3. **`claude-code-review.yml`** - Manual PR reviews
   - Main review job

4. **`claude.yml`** - Interactive comment-triggered requests
   - Comment-triggered job

## Circuit Breaker States

The circuit breaker uses labels to track state:

| State        | Labels                             | Meaning           | Action                      |
| ------------ | ---------------------------------- | ----------------- | --------------------------- |
| 🟢 Closed    | None                               | Normal operation  | Auto-merge allowed          |
| 🔴 Open      | `claude-failed`                    | Failure detected  | Auto-merge blocked          |
| ⚠️ Half-Open | `claude-failed` + retry indication | Retryable failure | Can retry workflow          |
| 🔒 Locked    | `manual-review-required`           | Permanent failure | Requires human intervention |

## Error Messages

### Authentication Error

```markdown
## 🔐 Authentication Error - Claude Review Failed

**Context**: patch update review
**Status**: failure
**Failure Type**: token-missing

The Claude Code OAuth token is missing. This PR requires manual review.

**Action required** - Repository maintainer should:

1. Verify `CLAUDE_CODE_OAUTH_TOKEN` secret is configured in repository settings
2. Check if the token has expired and regenerate if needed
3. Ensure the token has appropriate scopes
4. Re-run this workflow after fixing authentication

---

**Circuit Breaker Status**: 🔴 Open (blocking auto-merge)
**Manual Review Required**: Yes
**Can Retry**: No
```

### Rate Limit Error

```markdown
## ⏱️ Rate Limit Reached - Claude Review Failed

**Context**: grouped dependency review
**Status**: failure
**Failure Type**: rate-limit

Claude API rate limit has been reached.

**This is usually temporary**:

1. Wait for rate limit to reset (typically 1 hour)
2. Re-run this workflow
3. If persistent, contact repository maintainer to review API usage

---

**Circuit Breaker Status**: 🔴 Open (blocking auto-merge)
**Manual Review Required**: Yes
**Can Retry**: Yes
```

### Timeout Error

```markdown
## ⏰ Timeout - Claude Review Failed

**Context**: major update breaking change analysis
**Status**: failure
**Failure Type**: timeout

Claude did not respond within the expected timeframe.

**This may be transient**:

1. Re-run this workflow to retry
2. If persistent, this may indicate a complex dependency requiring more analysis time
3. Consider manual review if timeout persists

---

**Circuit Breaker Status**: 🔴 Open (blocking auto-merge)
**Manual Review Required**: Yes
**Can Retry**: Yes
```

## Benefits

1. **Fail Fast**: Detect authentication/configuration issues before consuming Claude API quota
2. **Clear Feedback**: Users see exactly what went wrong and how to fix it
3. **Graceful Degradation**: Transient failures don't block manual review path
4. **Observable**: Labels and comments provide visibility into circuit state
5. **Retry Logic**: Distinguishes transient (retryable) from permanent (manual) failures

## Monitoring

### Key Metrics to Monitor

1. **Circuit breaker trigger rate**: PRs with `claude-failed` label
2. **Failure types**: Distribution of auth vs timeout vs rate-limit vs unknown
3. **Retry success rate**: Re-running failed workflows after transient failures
4. **Manual review conversion**: PRs requiring manual review after Claude failure

### Alerts

Consider setting up alerts for:

- High authentication failure rate (indicates token expiration)
- Sustained rate limiting (indicates quota exhaustion)
- High unknown error rate (indicates potential bugs)

## Troubleshooting

### "Claude OAuth token is missing"

**Cause**: `CLAUDE_CODE_OAUTH_TOKEN` secret not configured

**Resolution**:

1. Go to repository Settings → Secrets and variables → Actions
2. Add secret named `CLAUDE_CODE_OAUTH_TOKEN`
3. Obtain token from Claude Code authentication flow
4. Re-run workflow

### "Claude OAuth token appears invalid"

**Cause**: Token is corrupt or incomplete

**Resolution**:

1. Regenerate Claude Code OAuth token
2. Update `CLAUDE_CODE_OAUTH_TOKEN` secret
3. Re-run workflow

### "Rate limit reached"

**Cause**: Too many Claude API calls

**Resolution**:

1. Wait for rate limit to reset (typically 1 hour)
2. Check for concurrent workflow runs consuming quota
3. Review Claude API usage patterns

### "Timeout"

**Cause**: Claude didn't respond within expected time

**Resolution**:

1. Re-run workflow (may be transient)
2. Check Claude service status
3. Consider if dependency analysis is unusually complex
4. Manual review if timeout persists

## Design Philosophy

The circuit breaker follows these principles:

1. **Explicit over Implicit**: Clear error messages over silent failures
2. **Fail Fast**: Detect issues early to save resources
3. **Non-Blocking Where Appropriate**: Low GitHub rate limit warns but doesn't block
4. **Observable**: All state changes visible through labels and comments
5. **Retry-Friendly**: Distinguishes transient from permanent failures

## Future Enhancements

Potential improvements:

1. **Exponential Backoff**: Automatic retry with backoff for transient failures
2. **Health Dashboard**: Centralized view of circuit breaker state across PRs
3. **Metrics Collection**: Automated tracking of failure rates and patterns
4. **Custom Timeouts**: Configurable timeout thresholds per workflow
5. **Circuit State Persistence**: Track open/closed state across workflow runs

## References

- Pre-flight Check Action: `.github/actions/claude-preflight-check/README.md`
- Failure Handler Action: `.github/actions/claude-failure-handler/README.md`
- Bash Utilities: `.github/actions/bash-utilities/README.md`
- Dependabot Workflows: `docs/DEPENDABOT.md`

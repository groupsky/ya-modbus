# Bash Utilities Action

Provides reusable bash functions for GitHub Actions workflows, including rate limiting, retries, and standardized messaging.

## Usage

```yaml
- name: Load bash utilities
  uses: ./.github/actions/bash-utilities
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}

- name: Use utilities
  run: |
    # Source utilities if needed
    source /tmp/gh-utilities.sh

    # Check rate limit before expensive operation
    if check_rate_limit 200; then
      success_msg "Rate limit OK"
    else
      warn_msg "Rate limit low, waiting..."
      wait_for_rate_limit 200
    fi

    # Retry with exponential backoff
    ATTEMPTS=3 TIMEOUT=1 retry_backoff gh pr list --limit 100

    # Standardized messages
    info_msg "Processing pull request"
    success_msg "Operation completed"
    error_msg "Operation failed"
    warn_msg "Potential issue detected"
    security_msg "Verification required"
```

## Available Functions

### Rate Limiting

#### `check_rate_limit <threshold>`

Checks if GitHub API rate limit is above threshold.

- **Parameters**: `threshold` (default: 100) - Minimum acceptable remaining requests
- **Returns**: 0 if remaining > threshold, 1 otherwise
- **Example**: `check_rate_limit 200`

#### `wait_for_rate_limit [threshold]`

Waits for rate limit to reset if below threshold.

- **Parameters**: `threshold` (default: 100) - Minimum acceptable remaining requests
- **Returns**: 0 (always succeeds after waiting)
- **Example**: `wait_for_rate_limit 150`

### Retry Logic

#### `retry_backoff <command> [args...]`

Executes command with exponential backoff retry strategy.

- **Environment Variables**:
  - `ATTEMPTS` (default: 5) - Maximum retry attempts
  - `TIMEOUT` (default: 2) - Initial timeout in seconds (doubles each retry)
- **Returns**: Exit code of final command execution
- **Example**: `ATTEMPTS=3 TIMEOUT=1 retry_backoff gh api /repos/owner/repo`

### Standardized Messaging

All messaging functions output to stdout (except `error_msg`, `warn_msg`, and `security_msg` which output to stderr).

#### `success_msg <message>`

Outputs success message with ✅ emoji.

#### `error_msg <message>`

Outputs error message with ❌ emoji (stderr).

#### `warn_msg <message>`

Outputs warning message with ⚠️ emoji (stderr).

#### `info_msg <message>`

Outputs informational message with ℹ️ emoji.

#### `security_msg <message>`

Outputs security-related message with 🔒 emoji (stderr).

## Implementation Details

- Functions are exported to `/tmp/gh-utilities.sh`
- Functions are automatically exported to subshells via `export -f`
- Rate limit checks use `gh api rate_limit` endpoint (doesn't count against limit)
- Exponential backoff doubles timeout after each failure
- Based on best practices from:
  - [Bash retry with exponential backoff](https://gist.github.com/rainabba/9b6bbcac087d46d1a1314825aee8b322)
  - [GitHub API rate limits documentation](https://docs.github.com/en/rest/rate-limit/rate-limit)

## Error Handling

- Rate limit checks return success if unable to query (fail-open)
- Retry function returns the exit code of the final attempt
- All error messages go to stderr for proper logging

## Best Practices

1. **Check rate limits before bulk operations**: Use `check_rate_limit` before expensive API calls
2. **Use retry for transient failures**: Apply `retry_backoff` to network operations
3. **Standardize all messages**: Use messaging functions for consistent workflow output
4. **Set appropriate thresholds**: Default 100 requests is safe for most workflows
5. **Monitor logs**: Check rate limit messages to optimize API usage

## Examples

### Safe bulk API operation

```bash
source /tmp/gh-utilities.sh

# Check we have enough API calls
if ! check_rate_limit 500; then
  warn_msg "Low rate limit, waiting for reset"
  wait_for_rate_limit 500
fi

# Retry on transient failures
if ATTEMPTS=3 retry_backoff gh pr list --limit 100; then
  success_msg "Retrieved pull requests"
else
  error_msg "Failed to retrieve pull requests after retries"
  exit 1
fi
```

### Graceful degradation

```bash
source /tmp/gh-utilities.sh

if check_rate_limit 100; then
  # Perform full check
  info_msg "Performing comprehensive validation"
  gh api "/repos/$REPO/commits?per_page=100"
else
  # Fallback to basic check
  warn_msg "Rate limit low, using basic validation"
  gh api "/repos/$REPO/commits?per_page=10"
fi
```

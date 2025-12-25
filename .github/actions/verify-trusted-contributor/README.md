# Verify Trusted Contributor Action

A reusable composite action for verifying if a GitHub contributor is trusted based on commit history, allowlist/denylist, and team membership.

## Features

- ✅ **Allowlist**: Always trust specific users
- ❌ **Denylist**: Never trust specific users
- 👥 **Team membership**: Trust members of specific GitHub teams
- 📊 **Commit history**: Verify minimum number of commits
- ⏰ **Time-based lookback**: Check commits within a specific timeframe
- 🔍 **Detailed outputs**: Get trust decision, reason, commit count, and dates

## Usage

### Basic Example

```yaml
- name: Verify contributor
  id: verify
  uses: ./.github/actions/verify-trusted-contributor
  with:
    username: ${{ github.actor }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### With Minimum Commits

```yaml
- name: Verify contributor
  id: verify
  uses: ./.github/actions/verify-trusted-contributor
  with:
    username: ${{ github.actor }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    min-commits: 5
```

### With Allowlist

```yaml
- name: Verify contributor
  id: verify
  uses: ./.github/actions/verify-trusted-contributor
  with:
    username: ${{ github.actor }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    allowlist: 'maintainer1,maintainer2,dependabot[bot]'
```

### With Denylist

```yaml
- name: Verify contributor
  id: verify
  uses: ./.github/actions/verify-trusted-contributor
  with:
    username: ${{ github.actor }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    denylist: 'spammer1,bot-account'
```

### With Team Membership

```yaml
- name: Verify contributor
  id: verify
  uses: ./.github/actions/verify-trusted-contributor
  with:
    username: ${{ github.actor }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    check-teams: 'myorg/core-team,myorg/maintainers'
```

### With Time-based Lookback

```yaml
- name: Verify contributor (90 days)
  id: verify
  uses: ./.github/actions/verify-trusted-contributor
  with:
    username: ${{ github.actor }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    min-commits: 3
    lookback-days: 90
```

### Complete Example

```yaml
- name: Verify contributor
  id: verify
  uses: ./.github/actions/verify-trusted-contributor
  with:
    username: ${{ github.actor }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    min-commits: 3
    lookback-days: 180
    allowlist: 'maintainer1,maintainer2'
    denylist: 'spammer1,spammer2'
    check-teams: 'myorg/core-team'

- name: Block if not trusted
  if: steps.verify.outputs.is-trusted != 'true'
  run: |
    echo "❌ Contributor not trusted: ${{ steps.verify.outputs.reason }}"
    exit 1

- name: Continue if trusted
  if: steps.verify.outputs.is-trusted == 'true'
  run: |
    echo "✅ Contributor is trusted: ${{ steps.verify.outputs.reason }}"
    echo "Commit count: ${{ steps.verify.outputs.commit-count }}"
```

## Inputs

| Input           | Description                                        | Required | Default                    |
| --------------- | -------------------------------------------------- | -------- | -------------------------- |
| `username`      | GitHub username to verify                          | Yes      | -                          |
| `repository`    | Repository in format owner/repo                    | No       | `${{ github.repository }}` |
| `github-token`  | GitHub token for API access                        | Yes      | -                          |
| `min-commits`   | Minimum number of commits required                 | No       | `2`                        |
| `lookback-days` | Number of days to look back (0 = all time)         | No       | `0`                        |
| `allowlist`     | Comma-separated list of trusted usernames          | No       | `''`                       |
| `denylist`      | Comma-separated list of blocked usernames          | No       | `''`                       |
| `check-teams`   | Comma-separated list of team slugs (org/team-slug) | No       | `''`                       |

## Outputs

| Output               | Description                                             |
| -------------------- | ------------------------------------------------------- |
| `is-trusted`         | `'true'` if contributor is trusted, `'false'` otherwise |
| `reason`             | Reason for the trust decision                           |
| `commit-count`       | Number of commits found for this contributor            |
| `first-commit-date`  | Date of first commit (ISO 8601 format)                  |
| `latest-commit-date` | Date of latest commit (ISO 8601 format)                 |

## Decision Priority

The action evaluates trust in the following order (first match wins):

1. **Denylist** (highest priority) - If user is in denylist → ❌ Not trusted
2. **Allowlist** - If user is in allowlist → ✅ Trusted
3. **Team membership** - If user is a member of specified teams → ✅ Trusted
4. **Commit history** (fallback) - If user has minimum required commits → ✅ Trusted / ❌ Not trusted

## Security Considerations

### Token Permissions

The action requires a GitHub token with the following permissions:

- `contents: read` - To read commit history
- `members: read` - To check team membership (if using `check-teams`)

For public repositories, commit history can be accessed without authentication. For private repositories or team membership checks, ensure the token has appropriate permissions.

### Denylist Takes Precedence

The denylist is checked first to ensure that blocked users cannot bypass security through allowlist or team membership. This is a defense-in-depth measure.

### Team Membership

Team membership checking requires organization-level API access. Ensure:

- The token has `members: read` permission
- The team slug format is correct: `org/team-slug`
- The user running the workflow has permission to view team membership

## Examples for Common Scenarios

### Dependabot PR Verification

```yaml
- name: Verify fix commit author
  if: steps.detect-fix.outputs.has_fix == 'true'
  id: verify-author
  uses: ./.github/actions/verify-trusted-contributor
  with:
    username: ${{ steps.detect-fix.outputs.author }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    min-commits: 2

- name: Block untrusted contributor
  if: steps.verify-author.outputs.is-trusted != 'true'
  run: |
    gh pr comment "${{ github.event.pull_request.html_url }}" --body "⚠️ **SECURITY BLOCK** - Fix commit from @${{ steps.detect-fix.outputs.author }} who is not a trusted contributor. Reason: ${{ steps.verify-author.outputs.reason }}"
    exit 1
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Auto-approve for Core Team

```yaml
- name: Verify if core team member
  id: verify
  uses: ./.github/actions/verify-trusted-contributor
  with:
    username: ${{ github.actor }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    check-teams: 'myorg/core-team'
    min-commits: 10

- name: Auto-approve if core team
  if: steps.verify.outputs.is-trusted == 'true'
  run: gh pr review --approve "${{ github.event.pull_request.html_url }}"
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Require Recent Activity

```yaml
- name: Verify recent contributor
  id: verify
  uses: ./.github/actions/verify-trusted-contributor
  with:
    username: ${{ github.actor }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    min-commits: 3
    lookback-days: 90
```

This ensures the contributor has made at least 3 commits in the last 90 days, verifying they are actively contributing.

## Troubleshooting

### "No commits found in repository"

This can happen if:

- The username is incorrect
- The user has never committed to this repository
- The lookback window is too short and doesn't include their commits

**Solution:** Check the username spelling and adjust `lookback-days` if needed.

### "Invalid team slug format"

Team slugs must be in format `org/team-slug`.

**Examples:**

- ✅ `myorg/core-team`
- ✅ `company/engineering-team`
- ❌ `core-team` (missing org)
- ❌ `myorg-core-team` (should be `/` not `-`)

### "Only X commit(s), minimum Y required"

The user doesn't have enough commits.

**Solutions:**

- Lower `min-commits` value
- Increase `lookback-days` to include older commits
- Add user to `allowlist` if they should be trusted anyway

## Best Practices

1. **Use allowlist for bots**: Add `'dependabot[bot]'` to allowlist for Dependabot workflows
2. **Use denylist sparingly**: Prefer blocking at the GitHub organization level
3. **Combine methods**: Use teams for maintainers and commit count for general contributors
4. **Set reasonable minimums**: 2-5 commits is usually sufficient for basic trust
5. **Document decisions**: Log the trust reason in workflow output for audit trails

---
paths: /.github/workflows/*.yml
---

# GitHub Actions Workflows

## Node.js Version Management

**Default rule**: Always use `.nvmrc` for Node.js version in workflows.

**Exception**: When verifying runtime compatibility across multiple Node.js versions, generate matrix from `package.json` engines field.

See: `.github/workflows/ci.yml` for matrix generation implementation

## Release Workflows

Uses npm trusted publishers with OIDC for secure publishing. Requires `id-token: write` permission and `npm` environment.

See: `docs/agents/release.md` for release process
See: `.github/workflows/release.yml` for production release workflow

## Preview Package Workflows

Uses `pull_request` trigger (non-privileged) to avoid CodeQL security warnings. Only runs for same-repo PRs, not forks.

See: `.github/workflows/pkg-pr-new.yml` for preview packages on pull requests

## Claude Workflows

Two workflows for Claude Code integration with security hardening.

### Security Measures

- **Fork PR skip**: `claude-code-review.yml` skips fork PRs to prevent prompt injection
- **Tool restrictions**: Both workflows use `--allowed-tools` to limit Claude to safe operations

See: `.github/workflows/claude.yml` for issue/comment responses
See: `.github/workflows/claude-code-review.yml` for automated PR reviews

## GitHub Actions Security

### Action Pinning

**Rule**: Pin all non-immutable actions to full 40-character commit SHAs with version comments.

**Format**:

```yaml
uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6
```

**Pin these** (non-immutable third-party actions):

- `actions/*` - Actions from actions organization
- `anthropics/*` - Third-party actions
- `codecov/*`, `dependabot/*`, etc. - All other third-party actions

**DO NOT pin** (immutable GitHub-managed actions):

- `github/codeql-action/*` - Managed by GitHub, immutable

**Why**: Commit SHAs are immutable and prevent supply chain attacks via tag manipulation. Version comments enable Dependabot to auto-update pinned SHAs.

**Maintenance**: Dependabot automatically creates PRs to update pinned SHAs when new versions are released.

### Permissions

**Rule**: Explicitly declare minimal required permissions at workflow or job level.

**Default**: `permissions: contents: read` for read-only workflows.

**Common patterns**:

- Read-only workflows: `contents: read`
- Release workflows: `contents: write`, `id-token: write`
- PR automation: `pull-requests: write`, `contents: write`

See: All workflows in `.github/workflows/` for implementation examples

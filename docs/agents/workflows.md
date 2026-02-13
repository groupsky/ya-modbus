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

- Pin ALL actions to full 40-character commit SHAs with version comments
- Explicitly declare minimal required permissions at workflow or job level

See: All workflows in `.github/workflows/` for implementation examples

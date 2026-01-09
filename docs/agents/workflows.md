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
See: `.github/workflows/pkg-pr-new.yml` for preview packages on pull requests

## Claude Workflows

Two workflows for Claude Code integration with security hardening.

### Security Measures

- **Fork PR skip**: `claude-code-review.yml` skips fork PRs to prevent prompt injection
- **Tool restrictions**: Both workflows use `--allowed-tools` to limit Claude to safe operations

See: `.github/workflows/claude.yml` for issue/comment responses
See: `.github/workflows/claude-code-review.yml` for automated PR reviews

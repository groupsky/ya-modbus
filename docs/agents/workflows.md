---
paths: /.github/workflows/*.yml
---

# GitHub Actions Workflows

## Node.js Version Management

**Default rule**: Always use `.nvmrc` for Node.js version in workflows.

**Exception**: When verifying runtime compatibility across multiple Node.js versions, generate matrix from `package.json` engines field.

See: `.github/workflows/ci.yml` for matrix generation implementation

## Release Workflows

For release and publishing workflows, see dedicated documentation.

See: `docs/agents/release.md` for release process
See: `.github/workflows/release.yml` for production/pre-release workflow
See: `.github/workflows/cleanup-prerelease.yml` for dist-tag cleanup

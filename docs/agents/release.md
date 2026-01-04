---
paths: /lerna.json, /.github/workflows/release.yml
---

# Release Process Guidelines

Publishing packages to npm using Lerna-Lite with conventional commits.

## Release Triggers

### Production Releases

Auto-triggered on push to main. Skipped when commit starts with `chore(release):` or no package changes.

### Pre-release (Feature Branch)

Manual workflow_dispatch trigger. Creates pre-release version with custom dist-tag. NO git tags. Version changes NOT committed to branch.

### Pre-release Cleanup

Auto-removes dist-tag when PR closed/merged. Published versions remain available.

## Version Bumping

Uses independent versioning - each package maintains its own version.

Conventional commit types determine version bump:

- `feat:` → MINOR version bump (0.1.0 → 0.2.0)
- `fix:` → PATCH version bump (0.1.0 → 0.1.1)
- `perf:` → PATCH version bump (0.1.0 → 0.1.1)
- `BREAKING CHANGE:` → MAJOR version bump (0.1.0 → 1.0.0)
- `docs:`, `chore:`, `test:`, `ci:` → NO release

## Triggering Releases

### Production Release

Automatic on push to main (after PR merge). No manual action needed.

**Publishes:**

- npm packages to npmjs.org
- Docker images to Docker Hub and GHCR
  - Base variant: `groupsky/ya-modbus:<version>`
  - Complete variant: `groupsky/ya-modbus:latest` (and `<version>-complete`)

### Pre-release (Feature Branch)

Manual workflow_dispatch. Requires maintain/admin access. Dist-tag auto-generated from branch or specified.

**Publishes:**

- npm packages with dist-tag (e.g., `@pkg@beta`)
- Docker images with version and dist-tag
  - Base: `groupsky/ya-modbus:<version>`, `groupsky/ya-modbus:<dist-tag>`
  - Complete: `groupsky/ya-modbus:<version>-complete`, `groupsky/ya-modbus:<dist-tag>-complete`

### Manual/Emergency Release

NEVER use npm scripts named `version` or `publish` - they conflict with npm lifecycle hooks.

Use npx lerna commands directly with `--yes` and `--no-private` flags.

**Docker publishing** requires Docker Hub credentials and GitHub token:

- `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets for Docker Hub
- `GITHUB_TOKEN` automatic for GHCR

## Docker Publishing

Docker images are automatically built and published when packages are released.

**Platforms:** linux/amd64, linux/arm64

**Registries:**

- Docker Hub: `groupsky/ya-modbus`
- GHCR: `ghcr.io/groupsky/ya-modbus`

**Variants:**

- Base: Core bridge only (users install drivers separately)
- Complete: Includes all built-in drivers (recommended)

**Tags:**

- Production: `<version>`, `<version>-complete`, `latest` (complete only)
- Pre-release: `<version>`, `<version>-complete`, `<dist-tag>`, `<dist-tag>-complete`

See: `.github/workflows/release.yml` for workflow implementation
See: `docs/PUBLISHING-SETUP.md` for first-time configuration and manual release setup
See: `lerna.json` for Lerna configuration
See: `docs/agents/git.md` for commit message format

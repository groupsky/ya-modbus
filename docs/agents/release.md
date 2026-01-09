---
paths: /lerna.json, /.github/workflows/release.yml, /.github/workflows/pkg-pr-new.yml
---

# Release Process Guidelines

Publishing packages to npm using Lerna-Lite with conventional commits. Uses npm trusted publishers with OIDC for secure, tokenless publishing with provenance.

## Release Triggers

**Production Releases**: Auto-triggered on push to main. Skipped when commit starts with `chore(release):` or no package changes.

**Preview Packages (Pull Requests)**: Automatic via pkg.pr.new on pull requests. Creates temporary preview packages for testing without publishing to npm registry.

## Version Bumping

Uses independent versioning - each package maintains its own version.

Conventional commit types determine version bump. SEE docs/agents/git.md for commit message format.

ONLY changed packages (and their dependents) are published. Unchanged packages remain at current version.

## Ignored Changes

Lerna NEVER triggers releases when ONLY these files change:

- Test files, documentation, config files
- `.github/**`, `docs/**`

SEE `lerna.json` ignoreChanges configuration for complete list.

## Triggering Releases

**Production Release**: Automatic on push to main. No action needed.

**Preview Packages**: Automatic on pull requests via pkg.pr.new. Preview URLs posted as PR comments.

**Manual/Emergency Release**: NEVER use npm scripts named `version` or `publish` - they conflict with npm lifecycle hooks. Use npx lerna commands directly with `--yes` and `--no-private` flags.

## References

- `.github/workflows/release.yml` - Production release workflow
- `.github/workflows/pkg-pr-new.yml` - Preview packages workflow
- `docs/PUBLISHING-SETUP.md` - First-time setup and manual release procedure
- `lerna.json` - Lerna configuration and ignoreChanges
- `docs/agents/git.md` - Commit message format and conventional commits
- https://github.com/lerna-lite/lerna-lite - Official Lerna-Lite documentation
- https://github.com/stackblitz-labs/pkg.pr.new - Preview packages service

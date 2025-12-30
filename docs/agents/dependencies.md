---
paths: package.json
---

# Dependency Management Guidelines

## Semantic Versioning

- Understand MAJOR.MINOR.PATCH convention
- MAJOR: breaking changes (incompatible API)
- MINOR: backward-compatible new features
- PATCH: backward-compatible bug fixes
- Always specify range carefully: `^1.2.3` allows 1.x.x, `~1.2.3` allows 1.2.x

## Breaking Changes

- Read CHANGELOG before updating MAJOR versions
- TEST extensively after breaking changes
- Update code to use new API before merging
- Commit format: `chore(deps): update <package> to v<MAJOR> (breaking change)`
- NEVER merge without testing breaking changes

## Security Updates

- PRIORITIZE security fixes for known vulnerabilities
- PATCH updates are safe, test before deploying
- Review CVE details if unfamiliar with vulnerability
- `npm audit` shows current vulnerabilities
- Use `npm update` for safe updates, `npm install <pkg@latest>` for major versions

## Dependency Review

- Check package maintenance status before adopting
- Verify no unused dependencies (`npm ls`, review package.json)
- Keep dev dependencies separate from production
- Avoid unnecessary transitive dependencies
- Document critical dependencies that are non-obvious

## Update Workflow

1. Run `npm audit` to identify issues
2. Test all affected functionality locally
3. For breaking changes: read CHANGELOG, update code first
4. Commit with clear message referencing CVE or issue
5. Run full test suite before creating PR

See: `docs/agents/git.md` for commit guidelines
See: `docs/DEPENDABOT-SETUP.md` for automated updates

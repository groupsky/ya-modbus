# GitHub Actions Workflows - Agent Guide

## Node.js Version Management

**Default rule**: Always use `.nvmrc` for Node.js version in workflows.

```yaml
- name: Setup Node.js from .nvmrc
  uses: actions/setup-node@v6
  with:
    node-version-file: '.nvmrc'
    cache: 'npm'
```

**Exception**: When verifying runtime compatibility across multiple Node.js versions, generate matrix from `package.json` engines field.

See: `ci.yml` setup job for matrix generation implementation

## Rationale

- **`.nvmrc`**: Single source of truth for development and standard builds
- **`package.engines` matrix**: Tests all supported runtime versions
- **Verification step**: Ensures `.nvmrc` matches latest `package.engines` version

## When to Use Matrix

Use matrix testing when:

- Testing package compatibility across Node.js versions
- Verifying runtime behavior on supported engines
- Running integration tests on multiple platforms

Use `.nvmrc` when:

- Building artifacts for deployment
- Running linting, formatting, type checking
- Publishing packages
- Standard CI tasks that don't require multi-version testing

## Dependabot and Claude Integration

### Workflow Files

- **`dependabot-claude-review.yml`**: Primary workflow for Dependabot PR handling with Claude AI
- **`claude-code-review.yml`**: Claude review for human-created PRs (on @claude mention)
- **`dependabot-verify.yml`**: Validates Dependabot configuration coverage

### Dependabot PR Workflow

**Trigger**: Dependabot opens/updates a PR

**Process**:

1. **Metadata Extraction**: Get semver update type (patch/minor/major)
2. **Claude Review** (based on update type):
   - **Patch**: Quick validation, auto-merge if approved
   - **Minor**: Review + feature inspection, create issues for beneficial features
   - **Major**: Breaking change analysis, fix or create migration issue
3. **Auto-merge Decision**: Enable auto-merge if Claude approves and meets criteria

### Update Type Strategies

**Patch Updates** (`version-update:semver-patch`):

- Claude performs quick review
- Auto-merge for dev dependencies if approved
- Auto-merge for prod dependencies with caution

**Minor Updates** (`version-update:semver-minor`):

- Claude reviews and inspects new features
- Creates GitHub issues for beneficial features
- Auto-merge for dev dependencies only
- Manual merge required for prod dependencies

**Major Updates** (`version-update:semver-major`):

- Claude analyzes breaking changes AND inspects new features
- **If fixable**: Claude implements fixes in PR
- **If complex**: Claude creates migration issue and closes PR
- **If no impact**: Claude approves for manual merge
- **New features**: Claude creates separate enhancement issues for beneficial features

### Security Considerations

**Use `pull_request_target` for Dependabot PRs**:

- Required for write permissions
- Checkout with `ref: ${{ github.event.pull_request.head.sha }}` for security
- Never run untrusted code from PR

**Token Usage**:

- Use `github_token: ${{ secrets.GITHUB_TOKEN }}` to avoid OIDC validation issues
- OIDC fails when workflow files are modified in PR (chicken-and-egg problem)

### Workflow Permissions

```yaml
permissions:
  contents: write # For auto-merge
  pull-requests: write # For comments and reviews
  issues: write # For creating issues
  actions: read # For checking CI status
```

### References

- **Complete merge rules**: `docs/PR-MERGE-RULES.md`
- **Dependabot config**: `.github/dependabot.yml`
- **Claude Code docs**: https://code.claude.com/docs

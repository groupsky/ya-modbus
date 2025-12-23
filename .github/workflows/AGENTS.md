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

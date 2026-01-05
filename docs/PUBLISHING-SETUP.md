# Publishing Setup Guide

First-time configuration for publishing packages to npm using Lerna-Lite.

## Prerequisites

Before publishing packages to npm:

1. **NPM Organization**: Ensure `@ya-modbus` scope exists on npm
2. **Package Registration**: First publish creates packages (no pre-registration needed)
3. **User Permissions**: Publisher needs appropriate npm access to the scope
4. **Trusted Publishers**: Configure npm trusted publishers with GitHub OIDC

## NPM Trusted Publishers (OIDC)

This project uses npm Trusted Publishers for secure, tokenless publishing via GitHub OIDC.

### How It Works

- GitHub Actions authenticates to npm using OpenID Connect (OIDC)
- No long-lived npm tokens are stored in repository secrets
- Published packages include provenance attestations (via `--provenance` flag)
- Authentication is scoped to specific repository and workflow

### Configuration

Trusted Publishers are configured per-package on npm:

1. Go to your package on npm (e.g., https://www.npmjs.com/package/@ya-modbus/cli)
2. Navigate to Settings → Trusted Publishers
3. Add a new publisher with:
   - **Repository owner**: The GitHub organization/user
   - **Repository name**: The repository name
   - **Workflow file**: `release.yml`
   - **Environment**: `npm`

### GitHub Environment

The release workflow uses a GitHub environment named `npm`:

1. Go to repository Settings → Environments
2. Create environment named `npm`
3. Configure deployment protection rules as needed (optional)

See: https://docs.npmjs.com/trusted-publishers for detailed setup

## GitHub Token (Automatic)

For automated releases:

- `GITHUB_TOKEN` is automatically available in GitHub Actions workflows
- No configuration needed

For manual releases from local machine:

- Set environment variable: `export GH_TOKEN=your_personal_access_token`
- Token needs `repo` scope for creating releases

## Verifying Setup

Check that workflow can authenticate:

1. Trigger a manual pre-release workflow on a feature branch
2. Verify workflow can authenticate to npm
3. Check that packages are published with correct dist-tag

## Manual Release Requirements

To publish packages manually from local machine:

1. **NPM Authentication**: Log in to npm with `npm login`
2. **Environment Variables**:
   - `GH_TOKEN` - For creating GitHub releases
3. **Clean Working Tree**: No uncommitted changes
4. **Dependencies Installed**: Run `npm ci`
5. **Tests Passing**: Run `npm test`

### Manual Release Commands

Execute these commands in order:

```bash
# Log in to npm (if not already authenticated)
npm login

# Build packages
npm run build

# Run tests
npm run test

# Version packages (creates git tags and GitHub releases)
npx lerna version --yes --no-private --sync-workspace-lock

# Publish to npm
npx lerna publish from-git --yes --no-private
```

**Note**: Manual releases do not include provenance attestations. Provenance is only available through the GitHub Actions workflow with OIDC authentication.

**Important**: Do NOT create npm scripts named `version` or `publish` - these names conflict with npm lifecycle hooks and cause recursive execution issues.

See: docs/agents/release.md for more details on the release workflow

## Troubleshooting

### OIDC Authentication Failures

If npm publish fails with 401 in GitHub Actions:

- Verify trusted publisher is configured for the package on npm
- Check `id-token: write` permission is set in workflow
- Verify `environment: npm` is configured in the job
- Ensure workflow file name matches the trusted publisher config

### GitHub Release Creation Failures

If lerna version fails to create GitHub releases:

- For workflows: Check `GITHUB_TOKEN` has write permissions
- For local: Verify `GH_TOKEN` environment variable is set
- Verify token has `repo` scope

### Permission Denied

If publish fails with 403:

- Verify user has publish access to `@ya-modbus` scope
- Check npm organization membership
- Verify package isn't already published by another user
- For OIDC: Check trusted publisher configuration matches exactly

## Security Notes

- **OIDC is preferred**: No long-lived tokens to manage or rotate
- **Provenance**: Packages published via workflow include cryptographic provenance
- **Environment protection**: Use GitHub environment rules to control who can trigger releases
- GitHub automatically masks token values in workflow logs

See: .github/workflows/release.yml for workflow implementation
See: lerna.json for Lerna-Lite configuration

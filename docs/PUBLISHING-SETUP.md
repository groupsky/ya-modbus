# Publishing Setup Guide

First-time configuration for publishing packages to npm using Lerna-Lite.

## Prerequisites

Before publishing packages to npm:

1. **NPM Organization**: Ensure `@ya-modbus` scope exists on npm
2. **Package Registration**: First publish creates packages (no pre-registration needed)
3. **User Permissions**: Publisher needs appropriate npm access to the scope
4. **Repository Secrets**: Configure NPM_TOKEN in GitHub

## NPM Token Configuration

### Creating an NPM Token

1. Go to https://www.npmjs.com/settings/tokens
2. Click "Generate New Token"
3. Select token type: **Automation** (for CI/CD)
4. Generate and copy the token

### Adding Token to GitHub

1. Go to repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `NPM_TOKEN`
4. Value: Paste your npm token
5. Click "Add secret"

**Note**: After first publish, migrate to npm Trusted Publishers for enhanced security. Trusted Publishers eliminate the need for long-lived tokens by using OIDC. See: https://docs.npmjs.com/trusted-publishers

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

1. **Environment Variables**:
   - `NPM_TOKEN` - For npm authentication (or `NODE_AUTH_TOKEN`)
   - `GH_TOKEN` - For creating GitHub releases

2. **Clean Working Tree**: No uncommitted changes

3. **Dependencies Installed**: Run `npm ci`

4. **Tests Passing**: Run `npm test`

### Manual Release Commands

Execute these commands in order:

```bash
# Set npm authentication (use NPM_TOKEN from environment)
npm config set //registry.npmjs.org/:_authToken $NPM_TOKEN

# Build packages
npm run build

# Run tests
npm run test

# Version packages (creates git tags and GitHub releases)
npx lerna version --yes --no-private

# Publish to npm
npx lerna publish from-git --yes --no-private
```

**Important**: Do NOT create npm scripts named `version` or `publish` - these names conflict with npm lifecycle hooks and cause recursive execution issues.

See: docs/agents/release.md for more details on the release workflow

## Troubleshooting

### Authentication Failures

If npm publish fails with 401:

- Verify NPM_TOKEN secret is configured in GitHub
- Check token hasn't expired
- Verify token type is "Automation" (not "Publish")

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

## Security Notes

- **Never commit tokens** to the repository
- Use "Automation" tokens for CI/CD (not personal tokens)
- Tokens can be rotated in npm settings
- GitHub automatically masks token values in workflow logs

See: .github/workflows/release.yml for workflow implementation
See: lerna.json for Lerna-Lite configuration

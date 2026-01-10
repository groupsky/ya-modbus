# Publishing Setup Guide

First-time configuration for publishing packages to npm using Lerna-Lite.

## Prerequisites

Before publishing packages to npm:

1. **NPM Organization**: Ensure `@ya-modbus` scope exists on npm
2. **First Publish is Manual**: New packages MUST be published manually first (trusted publishers only work for existing packages)
3. **User Permissions**: Publisher needs appropriate npm access to the scope
4. **Trusted Publishers**: Configure npm trusted publishers with GitHub OIDC (after first publish)

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

## First-Time Package Publishing

When creating a new package, you MUST publish it manually before the trusted publisher workflow can work. This is because npm trusted publishers can only be configured for packages that already exist on the registry.

### The Chicken-and-Egg Problem

1. Automated release workflow uses trusted publishers → requires package to exist on npm
2. Package doesn't exist on npm → can't configure trusted publisher
3. **Solution**: Manual first publish → configure trusted publisher → automation works

### Step 1: Manual First Publish

From the package directory:

```bash
# Log in to npm (if not already authenticated)
npm login

# Build the package
npm run build

# Publish with public access (required for scoped packages)
npm publish --access public
```

**Note**: Manual publishes do NOT include provenance attestations. Provenance is only available through the GitHub Actions workflow with OIDC authentication.

### Step 2: Configure Trusted Publisher

After the package exists on npm:

1. Go to your package on npm (e.g., https://www.npmjs.com/package/@ya-modbus/your-package)
2. Navigate to **Settings** → **Trusted Publishers**
3. Click **Add trusted publisher** and fill in:
   - **Repository owner**: Your GitHub organization or username
   - **Repository name**: Your repository name
   - **Workflow file**: `release.yml`
   - **Environment**: `npm`

### Step 3: Verify Automated Publishing

Trigger a test release to confirm the trusted publisher is working:

1. Create a feature branch with a minor change
2. Open a PR to trigger automatic preview packages via pkg.pr.new (see `docs/agents/release.md` for details)
3. Verify the preview package workflow runs successfully
4. Merge the PR to main to trigger production release
5. Verify the release workflow publishes successfully with provenance

## GitHub Token (Automatic)

For automated releases:

- `GITHUB_TOKEN` is automatically available in GitHub Actions workflows
- No configuration needed

For manual releases from local machine:

- Set environment variable: `export GH_TOKEN=your_personal_access_token`
- Token needs `repo` scope for creating releases

## Verifying Setup

Check that workflow can authenticate:

1. Open a PR on a feature branch to trigger automatic preview packages via pkg.pr.new
2. Verify the preview package workflow runs successfully
3. Merge to main to trigger production release
4. Verify workflow can authenticate to npm
5. Check that packages are published with provenance

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

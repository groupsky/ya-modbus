# Dependencies Optimization Analysis

## Current State

### Root package.json

- 15 devDependencies
- TypeScript: ^5.3.3

### Workspace Packages

**driver-sdk:**

- 5 devDependencies: @types/jest, @types/node, jest, ts-jest, typescript (^5.7.2)
- 1 dependency: @ya-modbus/driver-types

**driver-types:**

- 1 devDependency: typescript (^5.7.2)

**ya-modbus-driver-xymd1:**

- 5 devDependencies: @types/jest, @types/node, jest, ts-jest, typescript (^5.7.2)
- 1 dependency: @ya-modbus/driver-types
- 1 peerDependency: @ya-modbus/driver-types (duplicates dependency)

## Issues Identified

1. **Duplicate devDependencies**: Testing-related packages (@types/jest, @types/node, jest, ts-jest) are duplicated in root and workspace packages
2. **Inconsistent TypeScript versions**: Root uses ^5.3.3 while workspaces use ^5.7.2
3. **Redundant peerDependency**: ya-modbus-driver-xymd1 has @ya-modbus/driver-types in both dependencies and peerDependencies
4. **Unnecessary hoisting prevention**: npm workspaces automatically hoist common devDependencies to root

## Optimization Strategy

### 1. Hoist Common devDependencies to Root

With npm workspaces, devDependencies defined in the root are available to all workspace packages. We can remove duplicates from workspace packages:

**Remove from workspace packages:**

- @types/jest
- @types/node
- jest
- ts-jest

**Keep in workspace packages only if version differs from root or if needed for specific functionality**

### 2. Standardize TypeScript Version

Update root to use TypeScript ^5.7.2 (latest used in workspaces). Remove TypeScript from workspace packages except driver-types (which only has TypeScript as dependency).

### 3. Remove Redundant peerDependencies

Remove @ya-modbus/driver-types from peerDependencies in ya-modbus-driver-xymd1 since it's already in dependencies.

### 4. Review Necessity of ts-node

ts-node is only in root devDependencies. Verify if it's needed for build/test scripts.

## Optimized Structure

### Root package.json

- Keep all current devDependencies
- Update TypeScript to ^5.7.2
- Total: 15 devDependencies (no change in count, but standardized versions)

### driver-sdk

- Remove: @types/jest, @types/node, jest, ts-jest, typescript
- Keep: @ya-modbus/driver-types (dependency)
- New total: 0 devDependencies, 1 dependency

### driver-types

- Remove: typescript
- New total: 0 devDependencies

### ya-modbus-driver-xymd1

- Remove: @types/jest, @types/node, jest, ts-jest, typescript
- Remove: @ya-modbus/driver-types from peerDependencies
- Keep: @ya-modbus/driver-types (dependency)
- New total: 0 devDependencies, 1 dependency

## Benefits

1. **Reduced total package count**: From ~26 to ~16 unique packages
2. **Single source of truth**: Version management in one place (root)
3. **Consistent versions**: All packages use same testing/tooling versions
4. **Faster installs**: Less duplication in node_modules
5. **Easier updates**: Update versions once in root instead of multiple files
6. **Smaller lockfile**: Fewer duplicate entries

## Migration Notes

After optimization:

1. Run `npm install` to regenerate lockfile
2. Verify all tests still pass
3. Check that TypeScript compilation works for all packages
4. Ensure no breaking changes from TypeScript version update

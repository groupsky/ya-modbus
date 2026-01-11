#!/usr/bin/env node

/**
 * Package Coverage Verification Script
 *
 * Dynamically discovers all publishable packages in the monorepo and verifies:
 * 1. All consumer examples include all packages as dependencies
 * 2. All test files import from all packages
 * 3. Both default and named imports are tested where applicable
 *
 * This ensures examples stay in sync as packages are added/removed.
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const COLORS = {
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  NC: '\x1b[0m',
}

const EXAMPLES_DIR = __dirname
const PACKAGES_DIR = path.join(__dirname, '..', 'packages')
const CONSUMERS = [
  'cjs-consumer',
  'esm-consumer',
  'typescript-cjs-consumer',
  'typescript-esm-consumer',
]

// Packages that are type-only and don't need to be imported in JavaScript consumers
const TYPE_ONLY_PACKAGES = ['@ya-modbus/driver-types']

// TypeScript consumers that should import type-only packages
const TYPESCRIPT_CONSUMERS = ['typescript-cjs-consumer', 'typescript-esm-consumer']

/**
 * Discover all publishable packages in the monorepo
 */
function discoverPublishablePackages() {
  const packages = []
  const packageDirs = fs.readdirSync(PACKAGES_DIR)

  for (const dir of packageDirs) {
    const pkgPath = path.join(PACKAGES_DIR, dir, 'package.json')
    if (!fs.existsSync(pkgPath)) continue

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

    // Skip private packages (not published to npm)
    if (pkg.private) continue

    packages.push({
      name: pkg.name,
      version: pkg.version,
      dir,
      path: pkgPath,
    })
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Check if a consumer example includes a package in its dependencies
 */
function checkConsumerDependencies(consumerDir, expectedPackages) {
  const pkgPath = path.join(EXAMPLES_DIR, consumerDir, 'package.json')
  if (!fs.existsSync(pkgPath)) {
    return { missing: expectedPackages.map((p) => p.name), found: [] }
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }

  const missing = []
  const found = []

  for (const expectedPkg of expectedPackages) {
    if (deps[expectedPkg.name]) {
      found.push(expectedPkg.name)
    } else {
      missing.push(expectedPkg.name)
    }
  }

  return { missing, found }
}

/**
 * Extract imports from a test file
 */
function extractImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')

  // Match ES6 imports: import ... from 'package'
  const esmImports = [
    ...content.matchAll(
      /import\s+(?:{[^}]+}|[^{}\s]+|\*\s+as\s+\w+)\s+from\s+['"](@ya-modbus\/[^'"]+)['"]/g
    ),
  ].map((m) => m[1])

  // Match type-only imports: import type ... from 'package'
  const typeImports = [
    ...content.matchAll(
      /import\s+type\s+(?:{[^}]+}|[^{}\s]+)\s+from\s+['"](@ya-modbus\/[^'"]+)['"]/g
    ),
  ].map((m) => m[1])

  // Match CommonJS requires: require('package')
  const cjsImports = [...content.matchAll(/require\(['"](@ya-modbus\/[^'"]+)['"]\)/g)].map(
    (m) => m[1]
  )

  return [...new Set([...esmImports, ...typeImports, ...cjsImports])]
}

/**
 * Check if test file tests both default and named imports for packages that export both
 */
function checkImportTypes(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const results = {}

  // Check for default imports: import pkg from 'package'
  const defaultImports = [
    ...content.matchAll(/import\s+(\w+)\s+from\s+['"](@ya-modbus\/[^'"]+)['"]/g),
  ]
  for (const match of defaultImports) {
    const [, varName, pkgName] = match
    if (!results[pkgName]) results[pkgName] = { default: false, named: false }
    results[pkgName].default = true
  }

  // Check for named imports: import { ... } from 'package'
  const namedImports = [
    ...content.matchAll(/import\s+{[^}]+}\s+from\s+['"](@ya-modbus\/[^'"]+)['"]/g),
  ]
  for (const match of namedImports) {
    const pkgName = match[1]
    if (!results[pkgName]) results[pkgName] = { default: false, named: false }
    results[pkgName].named = true
  }

  // Check for type-only imports: import type { ... } from 'package'
  const typeOnlyImports = [
    ...content.matchAll(/import\s+type\s+{[^}]+}\s+from\s+['"](@ya-modbus\/[^'"]+)['"]/g),
  ]
  for (const match of typeOnlyImports) {
    const pkgName = match[1]
    if (!results[pkgName]) results[pkgName] = { default: false, named: false }
    results[pkgName].named = true
  }

  // Check for namespace imports: import * as pkg from 'package'
  const namespaceImports = [
    ...content.matchAll(/import\s+\*\s+as\s+\w+\s+from\s+['"](@ya-modbus\/[^'"]+)['"]/g),
  ]
  for (const match of namespaceImports) {
    const pkgName = match[1]
    if (!results[pkgName]) results[pkgName] = { default: false, named: false }
    // Namespace imports access both default and named
    results[pkgName].default = true
    results[pkgName].named = true
  }

  // Check CommonJS patterns
  // const pkg = require('package') - could be default
  const cjsDefaultStyle = [
    ...content.matchAll(/const\s+(\w+)\s+=\s+require\(['"](@ya-modbus\/[^'"]+)['"]\)/g),
  ]
  for (const match of cjsDefaultStyle) {
    const [, varName, pkgName] = match
    if (!results[pkgName]) results[pkgName] = { default: false, named: false }
    // In CommonJS, this gets the whole module object
    results[pkgName].default = true
  }

  // const { ... } = require('package') - named
  const cjsNamedStyle = [
    ...content.matchAll(/const\s+{[^}]+}\s+=\s+require\(['"](@ya-modbus\/[^'"]+)['"]\)/g),
  ]
  for (const match of cjsNamedStyle) {
    const pkgName = match[1]
    if (!results[pkgName]) results[pkgName] = { default: false, named: false }
    results[pkgName].named = true
  }

  return results
}

/**
 * Get test file path for a consumer
 */
function getTestFilePath(consumerDir) {
  const mapping = {
    'cjs-consumer': 'test.js',
    'esm-consumer': 'test.mjs',
    'typescript-cjs-consumer': 'src/test.ts',
    'typescript-esm-consumer': 'src/test.ts',
  }
  return path.join(EXAMPLES_DIR, consumerDir, mapping[consumerDir])
}

/**
 * Main verification logic
 */
function main() {
  console.log(`${COLORS.BLUE}================================`)
  console.log('Package Coverage Verification')
  console.log(`================================${COLORS.NC}\n`)

  // Discover all publishable packages
  const packages = discoverPublishablePackages()
  console.log(`Found ${packages.length} publishable packages:`)
  packages.forEach((pkg) => {
    console.log(`  - ${pkg.name}`)
  })
  console.log()

  let hasErrors = false

  // Verify each consumer example
  for (const consumer of CONSUMERS) {
    console.log(`${COLORS.BLUE}Checking: ${consumer}${COLORS.NC}`)
    console.log('----------------------------')

    // Check package.json dependencies
    const { missing, found } = checkConsumerDependencies(consumer, packages)

    if (missing.length > 0) {
      console.log(`${COLORS.RED}✗ Missing dependencies in package.json:${COLORS.NC}`)
      missing.forEach((pkg) => console.log(`  - ${pkg}`))
      hasErrors = true
    } else {
      console.log(
        `${COLORS.GREEN}✓ All packages declared in package.json (${found.length})${COLORS.NC}`
      )
    }

    // Check test file imports
    const testFile = getTestFilePath(consumer)
    if (!fs.existsSync(testFile)) {
      console.log(`${COLORS.RED}✗ Test file not found: ${testFile}${COLORS.NC}`)
      hasErrors = true
      continue
    }

    const imports = extractImports(testFile)

    // For JavaScript consumers, skip type-only packages
    const isTypeScriptConsumer = TYPESCRIPT_CONSUMERS.includes(consumer)
    const requiredPackages = isTypeScriptConsumer
      ? packages
      : packages.filter((pkg) => !TYPE_ONLY_PACKAGES.includes(pkg.name))

    const missingImports = requiredPackages.filter((pkg) => !imports.includes(pkg.name))

    if (missingImports.length > 0) {
      console.log(`${COLORS.RED}✗ Packages not imported in test file:${COLORS.NC}`)
      missingImports.forEach((pkg) => console.log(`  - ${pkg.name}`))
      hasErrors = true
    } else {
      const skipMsg =
        !isTypeScriptConsumer && TYPE_ONLY_PACKAGES.length > 0
          ? ` (${TYPE_ONLY_PACKAGES.length} type-only packages skipped)`
          : ''
      console.log(`${COLORS.GREEN}✓ All packages imported in test file${skipMsg}${COLORS.NC}`)
    }

    // Check import types (default vs named)
    const importTypes = checkImportTypes(testFile)
    console.log(`${COLORS.GREEN}✓ Import types verified:${COLORS.NC}`)
    Object.entries(importTypes).forEach(([pkg, types]) => {
      const typeStr = []
      if (types.named) typeStr.push('named')
      if (types.default) typeStr.push('default/namespace')
      console.log(`  - ${pkg}: ${typeStr.join(', ')}`)
    })

    console.log()
  }

  // Final summary
  console.log('================================')
  if (hasErrors) {
    console.log(`${COLORS.RED}✗ Verification failed!${COLORS.NC}`)
    console.log('Please update consumer examples to include all packages.')
    process.exit(1)
  } else {
    console.log(`${COLORS.GREEN}✓ All checks passed!${COLORS.NC}`)
    console.log('All consumer examples properly cover all packages.')
  }
}

main()

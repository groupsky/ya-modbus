#!/usr/bin/env node

/**
 * Dist Import Check
 *
 * Checks that every package a built file imports is declared in the
 * `dependencies`, `peerDependencies` or `optionalDependencies` of its package.
 * ESLint checks the imports in the sources, but the compiler adds imports of
 * its own (for example `tslib` with `importHelpers`). In the monorepo an
 * undeclared import still resolves through hoisting, so only a consumer that
 * installs the package from npm would see the error.
 *
 * Checks the dist folders of all publishable packages (via lerna, like
 * validate-bins.js), and the bin folder of bin-only packages. Lines in comments are skipped, so code examples in JSDoc
 * do not count. Node.js built-in modules do not need to be declared. The files
 * that ESLint does not check for this either (see eslint.config.mjs) are skipped.
 *
 * Run after `npm run build`.
 */

const { execFileSync } = require('child_process')
const fs = require('fs')
const { builtinModules } = require('module')
const path = require('path')

const ROOT = path.join(__dirname, '..')

// require("x") and import("x") anywhere; import/export statements, which tsc
// writes on one line, at the start of a line
const IMPORT_PATTERN =
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)|\bimport\(\s*['"]([^'"]+)['"]\s*\)|^\s*(?:import|export)\b.*?\bfrom\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/g

// Test helpers, and driver-loader's testing entry, which imports @jest/globals
// from the jest install of the consumer (jest is an optional peer dependency)
const SKIPPED_FILES = [
  /(^|\/)test-utils\.js$/,
  /^packages\/driver-loader\/dist\/[^/]+\/src\/testing\.js$/,
]

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))

// lerna lists the publishable (non-private) packages
function discoverPackageDirs() {
  const output = execFileSync('npx', ['lerna', 'ls', '--json', '--loglevel', 'silent'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  return JSON.parse(output).map((pkg) => pkg.location)
}

function listJsFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) return listJsFiles(file)
    return /\.[cm]?js$/.test(entry.name) ? [file] : []
  })
}

/** Package name of a bare specifier: `@scope/name/sub` → `@scope/name`, `name/sub` → `name` */
function packageName(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('node:')) {
    return undefined
  }
  const parts = specifier.split('/')
  const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
  return builtinModules.includes(name) ? undefined : name
}

function importedPackages(file) {
  const names = new Set()
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (/^\s*(\*|\/\*|\/\/)/.test(line)) continue
    for (const match of line.matchAll(IMPORT_PATTERN)) {
      const name = packageName(match[1] ?? match[2] ?? match[3] ?? match[4])
      if (name) names.add(name)
    }
  }
  return names
}

function main() {
  const problems = []
  for (const dir of discoverPackageDirs()) {
    const pkg = readJson(path.join(dir, 'package.json'))
    const declared = new Set([
      pkg.name,
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}),
      ...Object.keys(pkg.optionalDependencies ?? {}),
    ])
    // Bin-only packages (no `main` or `exports`, such as the unscoped npx
    // wrappers) have no build and publish their plain JavaScript `bin` folder.
    // Their target is loaded via `createRequire().resolve()`, which this check
    // does not see; validate-bins starts it instead
    const isBinOnly = pkg.bin && !pkg.main && !pkg.exports
    const files = listJsFiles(path.join(dir, isBinOnly ? 'bin' : 'dist'))
    if (files.length === 0) {
      problems.push(`${pkg.name}: no built files (run \`npm run build\` first)`)
    }
    for (const file of files) {
      if (SKIPPED_FILES.some((pattern) => pattern.test(path.relative(ROOT, file)))) continue
      for (const name of importedPackages(file)) {
        if (!declared.has(name)) {
          problems.push(`${pkg.name}: ${path.relative(dir, file)} imports undeclared "${name}"`)
        }
      }
    }
  }

  if (problems.length > 0) {
    console.error(problems.map((problem) => `✗ ${problem}`).join('\n'))
    console.error(`\n${problems.length} problem(s) in built files`)
    process.exit(1)
  }
  console.log('✓ All packages declare the packages their built files import')
}

main()

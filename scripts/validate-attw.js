#!/usr/bin/env node

/**
 * Runs arethetypeswrong on all publishable packages in the monorepo.
 * Exits with non-zero code if any package has issues.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const PACKAGES_DIR = path.join(__dirname, '..', 'packages')

function getPublishablePackages() {
  const packages = []
  const packageDirs = fs.readdirSync(PACKAGES_DIR)

  for (const dir of packageDirs) {
    const pkgPath = path.join(PACKAGES_DIR, dir, 'package.json')
    if (!fs.existsSync(pkgPath)) continue

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    if (pkg.private) continue

    packages.push({
      name: pkg.name,
      dir: path.join(PACKAGES_DIR, dir),
    })
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name))
}

function main() {
  const packages = getPublishablePackages()
  console.log(`Running attw on ${packages.length} packages...\n`)

  let hasErrors = false

  for (const pkg of packages) {
    console.log(`\x1b[34m${pkg.name}\x1b[0m`)
    try {
      // Use node16 profile since all packages require Node.js 20+
      execSync(`npx attw --pack "${pkg.dir}" --profile node16`, {
        stdio: 'inherit',
      })
    } catch {
      hasErrors = true
    }
    console.log()
  }

  if (hasErrors) {
    console.log('\x1b[31mArethetypeswrong validation failed!\x1b[0m')
    process.exit(1)
  } else {
    console.log('\x1b[32mAll packages passed attw validation.\x1b[0m')
  }
}

main()

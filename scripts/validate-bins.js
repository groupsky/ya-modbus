#!/usr/bin/env node

/**
 * Bin Smoke Test
 *
 * Discovers the `bin` entries of all publishable packages (via lerna, like
 * validate-publint.sh) and checks each built bin file:
 * - exists
 * - starts with the node shebang
 * - is executable
 * - starts: `<bin> --help` exits 0 and prints help (catches module load errors
 *   that unit tests miss, because Jest runs the sources as CommonJS)
 *
 * The CommonJS twin (dist/cjs/bin/...) gets the same file checks but is not
 * started: npm links only the `bin` entry, so users never run the twin.
 *
 * Bins run from the repo with hoisted node_modules, so this does not catch a
 * dependency missing from a package's own `dependencies` or `files`.
 *
 * Run after `npm run build`.
 */

const { execFileSync, spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SHEBANG = '#!/usr/bin/env node'
const START_TIMEOUT_MS = 10000

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))

// lerna lists the publishable (non-private) packages
function discoverPackageDirs() {
  const output = execFileSync('npx', ['lerna', 'ls', '--json', '--loglevel', 'silent'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  return JSON.parse(output).map((pkg) => pkg.location)
}

function discoverBins() {
  const bins = []
  for (const dir of discoverPackageDirs()) {
    const pkg = readJson(path.join(dir, 'package.json'))
    if (!pkg.bin) continue

    const entries = typeof pkg.bin === 'string' ? { [pkg.name.split('/').pop()]: pkg.bin } : pkg.bin
    for (const [name, file] of Object.entries(entries)) {
      bins.push({ pkg: pkg.name, name, file: path.join(dir, file), start: true })

      const cjsTwin = path.join(dir, file.replace('dist/esm/', 'dist/cjs/'))
      if (cjsTwin !== path.join(dir, file) && fs.existsSync(cjsTwin)) {
        bins.push({ pkg: pkg.name, name, file: cjsTwin, start: false })
      }
    }
  }
  return bins
}

function checkStart(file) {
  const result = spawnSync(file, ['--help'], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: START_TIMEOUT_MS,
  })
  if (result.error?.code === 'ETIMEDOUT') {
    return [`\`--help\` did not exit within ${START_TIMEOUT_MS / 1000}s`]
  }
  if (result.error) return [`failed to start: ${result.error.message}`]
  if (result.status === 0) {
    return result.stdout.trim() ? [] : ['`--help` exited 0 but printed nothing']
  }

  const output = (result.stderr.trim() || result.stdout.trim()).replace(/^/gm, '      ')
  return [`\`--help\` exited with ${result.status ?? result.signal}${output ? `:\n${output}` : ''}`]
}

function checkBin({ file, start }) {
  if (!fs.existsSync(file)) return ['file not found (run `npm run build` first)']

  const problems = []
  const firstLine = fs.readFileSync(file, 'utf8').split('\n', 1)[0]
  if (firstLine !== SHEBANG) {
    problems.push(`first line is "${firstLine}", expected "${SHEBANG}"`)
  }
  try {
    fs.accessSync(file, fs.constants.X_OK)
  } catch {
    problems.push('file is not executable (missing `chmod +x` in the build script?)')
  }
  if (start && problems.length === 0) problems.push(...checkStart(file))
  return problems
}

function main() {
  const bins = discoverBins()
  if (bins.length === 0) {
    console.error('✗ No bin files found in publishable packages')
    process.exit(1)
  }

  let failed = 0
  for (const bin of bins) {
    const label = `${bin.pkg} ${bin.name} (${path.relative(ROOT, bin.file)})`
    const problems = checkBin(bin)
    if (problems.length === 0) {
      console.log(`✓ ${label}${bin.start ? ' starts' : ''}`)
      continue
    }
    failed++
    console.error(`✗ ${label}`)
    problems.forEach((problem) => console.error(`    - ${problem}`))
  }

  if (failed > 0) {
    console.error(`\n✗ ${failed} of ${bins.length} bin files are broken`)
    process.exit(1)
  }
  console.log(`\n✓ All ${bins.length} bin files are valid`)
}

main()

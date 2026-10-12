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
 * - reports its version: `<bin> --version` prints the version from the package's
 *   package.json (catches hardcoded versions)
 *
 * Both the ESM bin and its CommonJS twin (dist/cjs/bin/...) get all checks. npm
 * links only the ESM `bin` entry, but starting the twin runs the CommonJS build of
 * the CLI code, which catches ESM-only syntax (such as `import.meta`) in the CJS output.
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
      bins.push({ pkg: pkg.name, version: pkg.version, name, file: path.join(dir, file) })

      const cjsTwin = path.join(dir, file.replace('dist/esm/', 'dist/cjs/'))
      if (cjsTwin !== path.join(dir, file) && fs.existsSync(cjsTwin)) {
        bins.push({ pkg: pkg.name, version: pkg.version, name, file: cjsTwin })
      }
    }
  }
  return bins
}

function run(file, arg) {
  const result = spawnSync(file, [arg], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: START_TIMEOUT_MS,
  })
  if (result.error?.code === 'ETIMEDOUT') {
    return { problem: `\`${arg}\` did not exit within ${START_TIMEOUT_MS / 1000}s` }
  }
  if (result.error) return { problem: `failed to start: ${result.error.message}` }
  if (result.status !== 0) {
    const output = (result.stderr.trim() || result.stdout.trim()).replace(/^/gm, '      ')
    const exit = result.status ?? result.signal
    return { problem: `\`${arg}\` exited with ${exit}${output ? `:\n${output}` : ''}` }
  }
  return { stdout: result.stdout.trim() }
}

function checkStart(file, version) {
  const help = run(file, '--help')
  if (help.problem) return [help.problem]
  if (!help.stdout) return ['`--help` exited 0 but printed nothing']

  const reported = run(file, '--version')
  if (reported.problem) return [reported.problem]
  if (reported.stdout !== version) {
    return [`\`--version\` printed "${reported.stdout}", expected "${version}" from package.json`]
  }
  return []
}

function checkBin({ file, version }) {
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
  if (problems.length === 0) problems.push(...checkStart(file, version))
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
      console.log(`✓ ${label} starts and reports ${bin.version}`)
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

#!/usr/bin/env node
/**
 * Documentation test CLI
 *
 * Usage:
 *   ya-modbus-doctest 'packages/* /README.md'
 *   ya-modbus-doctest --verbose packages/driver-xymd1/README.md
 */

import { glob } from 'glob'

import { runDocTests, type TestResult } from './runner.js'

interface CliOptions {
  verbose: boolean
  bail: boolean
  patterns: string[]
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    verbose: false,
    bail: false,
    patterns: [],
  }

  for (const arg of args) {
    if (arg === '--verbose' || arg === '-v') {
      options.verbose = true
    } else if (arg === '--bail' || arg === '-b') {
      options.bail = true
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else if (!arg.startsWith('-')) {
      options.patterns.push(arg)
    }
  }

  return options
}

function printHelp(): void {
  console.log(`
ya-modbus-doctest - Test documentation code examples

Usage:
  ya-modbus-doctest [options] <patterns...>

Options:
  -v, --verbose  Show detailed output
  -b, --bail     Stop on first failure
  -h, --help     Show this help message

Examples:
  ya-modbus-doctest 'packages/*/README.md'
  ya-modbus-doctest --verbose packages/driver-xymd1/README.md

Configuration:
  Code blocks in markdown can have a preceding HTML comment with config:

  <!-- doctest: { "slaveId": 1, "registers": { "input": { "1": 250 } } } -->
  \`\`\`typescript
  // code here
  \`\`\`

  To skip a block:
  <!-- doctest: skip -->

  To only typecheck (no runtime):
  <!-- doctest: { "typecheck": true } -->
`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const options = parseArgs(args)

  if (options.patterns.length === 0) {
    console.error('Error: No file patterns provided')
    printHelp()
    process.exit(1)
  }

  // Expand glob patterns
  const files: string[] = []
  for (const pattern of options.patterns) {
    const matches = await glob(pattern)
    files.push(...matches)
  }

  if (files.length === 0) {
    console.error('Error: No files found matching patterns:', options.patterns)
    process.exit(1)
  }

  if (options.verbose) {
    console.log(`Testing ${files.length} file(s):\n`)
  }

  // Run tests for each file
  const allResults: TestResult[] = []
  let hasFailures = false

  for (const file of files) {
    if (options.verbose) {
      console.log(`\n--- ${file} ---\n`)
    }

    const results = await runDocTests(file, {
      verbose: options.verbose,
      bail: options.bail,
    })

    allResults.push(...results)

    for (const result of results) {
      if (!result.success) {
        hasFailures = true
        console.error(`FAIL: ${result.filePath}:${result.lineNumber}`)
        console.error(`  ${result.message}`)
        if (result.error !== undefined && options.verbose) {
          console.error(`  ${result.error.stack}`)
        }
      } else if (options.verbose) {
        console.log(`PASS: line ${result.lineNumber} - ${result.message}`)
      }
    }

    if (hasFailures && options.bail) {
      break
    }
  }

  // Summary
  const passed = allResults.filter((r) => r.success).length
  const failed = allResults.filter((r) => !r.success).length
  const total = allResults.length

  console.log(`\n${passed}/${total} tests passed`)

  if (failed > 0) {
    console.log(`${failed} test(s) failed`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

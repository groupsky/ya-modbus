#!/usr/bin/env tsx
/**
 * Documentation examples test runner
 *
 * Discovers and runs all example files that test documentation snippets.
 * Example files are self-contained and use the @ya-modbus/doctest helpers.
 *
 * Usage:
 *   npm run test:examples
 *   node --import tsx scripts/test-examples.ts
 */

import { readdirSync, statSync } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'

interface TestResult {
  file: string
  success: boolean
  duration: number
  error?: string
}

async function runExample(file: string): Promise<TestResult> {
  const startTime = Date.now()

  return new Promise((resolve) => {
    const proc = spawn('node', ['--import', 'tsx', file], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' },
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      const duration = Date.now() - startTime
      const success = code === 0

      resolve({
        file,
        success,
        duration,
        error: success ? undefined : stderr || stdout || `Exit code: ${code}`,
      })
    })

    proc.on('error', (err) => {
      const duration = Date.now() - startTime
      resolve({
        file,
        success: false,
        duration,
        error: err.message,
      })
    })
  })
}

function findExampleFiles(): string[] {
  const files: string[] = []
  const packagesDir = 'packages'

  // Read all package directories
  const packageDirs = readdirSync(packagesDir)

  for (const pkgDir of packageDirs) {
    const examplesDir = path.join(packagesDir, pkgDir, 'examples')

    try {
      const stat = statSync(examplesDir)
      if (!stat.isDirectory()) continue

      // Find example-*.ts files
      const exampleFiles = readdirSync(examplesDir)
        .filter((f) => f.startsWith('example-') && f.endsWith('.ts'))
        .map((f) => path.join(examplesDir, f))

      files.push(...exampleFiles)
    } catch {
      // examples directory doesn't exist, skip
    }
  }

  return files
}

async function main(): Promise<void> {
  // Find all example files
  // Convention: packages/*/examples/example-*.ts
  const files = findExampleFiles()

  if (files.length === 0) {
    console.log('No example files found.')
    console.log('Expected pattern: packages/*/examples/example-*.ts')
    process.exit(0)
  }

  console.log(`Running ${files.length} example(s)...\n`)

  const results: TestResult[] = []
  let hasFailures = false

  for (const file of files.sort()) {
    const relativePath = path.relative(process.cwd(), file)
    process.stdout.write(`  ${relativePath} ... `)

    const result = await runExample(file)
    results.push(result)

    if (result.success) {
      console.log(`PASS (${result.duration}ms)`)
    } else {
      console.log('FAIL')
      hasFailures = true
    }
  }

  // Summary
  console.log('')
  const passed = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  if (failed > 0) {
    console.log('Failures:\n')
    for (const result of results.filter((r) => !r.success)) {
      console.log(`  ${result.file}:`)
      if (result.error) {
        const lines = result.error.trim().split('\n')
        for (const line of lines) {
          console.log(`    ${line}`)
        }
      }
      console.log('')
    }
  }

  console.log(`${passed}/${results.length} examples passed`)

  if (hasFailures) {
    process.exit(1)
  }
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

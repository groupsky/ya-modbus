#!/usr/bin/env tsx
/**
 * Documentation examples test runner
 *
 * Discovers and runs self-contained example files.
 * Examples with .test.ts files are skipped (Jest handles them).
 *
 * Usage:
 *   npm run test:examples
 *   node --import tsx scripts/test-examples.ts
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'

interface TestResult {
  file: string
  success: boolean
  duration: number
  skipped?: boolean
  skipReason?: string
  error?: string
}

/**
 * Run a self-contained example
 */
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
      resolve({
        file,
        success: false,
        duration: Date.now() - startTime,
        error: err.message,
      })
    })
  })
}

/**
 * Find example files, excluding those with Jest test files
 */
function findExampleFiles(): Array<{ file: string; hasJestTest: boolean }> {
  const files: Array<{ file: string; hasJestTest: boolean }> = []
  const packagesDir = 'packages'

  const packageDirs = readdirSync(packagesDir)

  for (const pkgDir of packageDirs) {
    const examplesDir = path.join(packagesDir, pkgDir, 'examples')

    try {
      const stat = statSync(examplesDir)
      if (!stat.isDirectory()) continue

      const allFiles = readdirSync(examplesDir)

      // Find example-*.ts files (excluding .test.ts and .config.json)
      const exampleFiles = allFiles
        .filter((f) => f.startsWith('example-') && f.endsWith('.ts') && !f.endsWith('.test.ts'))
        .map((f) => {
          const filePath = path.join(examplesDir, f)
          const testFile = f.replace(/\.ts$/, '.test.ts')
          const hasJestTest = allFiles.includes(testFile)
          return { file: filePath, hasJestTest }
        })

      files.push(...exampleFiles)
    } catch {
      // examples directory doesn't exist, skip
    }
  }

  return files
}

async function main(): Promise<void> {
  const examples = findExampleFiles()

  if (examples.length === 0) {
    console.log('No example files found.')
    console.log('Expected pattern: packages/*/examples/example-*.ts')
    process.exit(0)
  }

  console.log(`Found ${examples.length} example(s)...\n`)

  const results: TestResult[] = []
  let hasFailures = false

  for (const { file, hasJestTest } of examples.sort((a, b) => a.file.localeCompare(b.file))) {
    const relativePath = path.relative(process.cwd(), file)
    process.stdout.write(`  ${relativePath} ... `)

    if (hasJestTest) {
      // Skip - Jest handles this example
      results.push({
        file,
        success: true,
        skipped: true,
        skipReason: 'Jest test exists',
        duration: 0,
      })
      console.log('SKIP (Jest test exists)')
      continue
    }

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
  const passed = results.filter((r) => r.success && !r.skipped).length
  const skipped = results.filter((r) => r.skipped).length
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

  const skipNote = skipped > 0 ? ` (${skipped} handled by Jest)` : ''
  console.log(`${passed}/${examples.length - skipped} examples passed${skipNote}`)

  if (hasFailures) {
    process.exit(1)
  }
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

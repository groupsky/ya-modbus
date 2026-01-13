/**
 * Jest test for example-read-sensor.ts
 *
 * This example is self-testing via withEmulator and assertions.
 * This test runs the example as a subprocess and verifies it exits successfully.
 */

import { spawn } from 'node:child_process'
import { join } from 'node:path'

/**
 * Run the example script as a subprocess
 */
async function runExample(): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    const examplePath = join(__dirname, 'example-read-sensor.ts')
    const proc = spawn('node', ['--import', 'tsx', examplePath], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
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
      resolve({ stdout, stderr, code })
    })

    proc.on('error', (err) => {
      resolve({ stdout, stderr: err.message, code: 1 })
    })
  })
}

describe('example-read-sensor', () => {
  it('runs without errors', async () => {
    const result = await runExample()

    // The example uses withEmulator and assert.deepStrictEqual internally
    // If it exits with code 0, all assertions passed
    expect(result.code).toBe(0)
  })
})

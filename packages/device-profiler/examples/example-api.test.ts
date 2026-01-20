/**
 * Jest test for example-api.ts
 *
 * Tests the API example by:
 * 1. Creating a mock transport
 * 2. Running the scanDevice function
 * 3. Verifying it completes without error
 */

import { spawn } from 'node:child_process'
import { join } from 'node:path'

import { isSocatAvailable, withRtuEmulator } from '@ya-modbus/emulator'

interface ExampleResult {
  stdout: string
  stderr: string
  code: number | null
}

/**
 * Strip ANSI color codes from string
 */
function stripAnsiCodes(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
}

/**
 * Run an example TypeScript file as a subprocess using tsx
 */
async function runExample(examplePath: string, args: string[] = []): Promise<ExampleResult> {
  return new Promise((resolve) => {
    const proc = spawn('node', ['--import', 'tsx', examplePath, ...args], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Set consistent terminal width to ensure consistent util.inspect formatting
        COLUMNS: '120',
        // Disable ANSI color codes in console.log output
        NO_COLOR: '1',
        NODE_DISABLE_COLORS: '1',
        // Unset FORCE_COLOR to allow color disabling to work
        FORCE_COLOR: undefined,
      },
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

describe('example-api', () => {
  it('scans registers using scanRegisters API', async () => {
    // Requires socat
    await expect(isSocatAvailable()).resolves.toBe(true)

    await withRtuEmulator(
      {
        slaveId: 1,
        holding: {
          0x0000: 0x00,
          0x0001: 0x01,
          0x0002: 0x00,
          0x0003: 0x02,
        },
      },
      async ({ clientPort }) => {
        // Run the example as a subprocess
        const examplePath = join(__dirname, 'example-api.ts')
        const result = await runExample(examplePath, [clientPort])

        // Verify exit code and no errors
        expect(result.stderr).toBe('')
        expect(result.code).toBe(0)

        // Strip ANSI color codes from output for consistent assertions
        const cleanOutput = stripAnsiCodes(result.stdout)

        // Verify results include found register data
        expect(cleanOutput).toContain('address: 1')
        expect(cleanOutput).toContain('success: true')
      }
    )
  }, 15000)
})

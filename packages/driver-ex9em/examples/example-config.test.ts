/**
 * Jest test for example-config.ts
 *
 * Tests the configuration example by:
 * 1. Setting up a virtual serial port pair with the emulator
 * 2. Running the example as a subprocess with the port argument
 * 3. Verifying the output contains expected values
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
 * Run an example TypeScript file as a subprocess using tsx
 */
async function runExample(examplePath: string, args: string[] = []): Promise<ExampleResult> {
  return new Promise((resolve) => {
    const proc = spawn('node', ['--import', 'tsx', examplePath, ...args], {
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

describe('example-config', () => {
  it('configures device address and baud rate', async () => {
    // Skip if socat is not available
    const socatAvailable = await isSocatAvailable()
    if (!socatAvailable) {
      console.warn('Skipping config example test: socat not available')
      return
    }

    await withRtuEmulator(
      {
        slaveId: 1,
        baudRate: 9600,
        parity: 'even',
        holding: {
          // Configuration registers
          0x002a: 4, // baud rate encoding (4 = 9600)
          0x002b: 1, // device address
        },
      },
      async ({ clientPort }) => {
        // Run the example as a subprocess
        const examplePath = join(__dirname, 'example-config.ts')
        const result = await runExample(examplePath, [clientPort])

        // Verify exit code and no errors
        expect(result.code).toBe(0)
        expect(result.stderr).toBe('')

        // Verify configuration changes
        expect(result.stdout).toContain('Device address changed to 5')
        expect(result.stdout).toContain('Baud rate changed to 4800')
      }
    )
  }, 30000) // Longer timeout for RTU setup
})

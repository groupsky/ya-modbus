/**
 * Jest test for usage-rtu.ts
 *
 * Tests the RTU transport example by:
 * 1. Setting up a virtual serial port pair with the emulator
 * 2. Running the example as a subprocess with the port argument
 * 3. Verifying the output contains expected hex values
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

describe('usage-rtu', () => {
  it('reads holding registers via RTU transport', async () => {
    // Skip if socat is not available
    const socatAvailable = await isSocatAvailable()
    if (!socatAvailable) {
      console.warn('Skipping RTU usage example test: socat not available')
      return
    }

    await withRtuEmulator(
      {
        slaveId: 1,
        baudRate: 9600,
        parity: 'none',
        holding: {
          // Set up 10 registers with test values
          0x0000: 0x1234,
          0x0001: 0x5678,
          0x0002: 0x9abc,
          0x0003: 0xdef0,
          0x0004: 0x1111,
          0x0005: 0x2222,
          0x0006: 0x3333,
          0x0007: 0x4444,
          0x0008: 0x5555,
          0x0009: 0x6666,
        },
      },
      async ({ clientPort }) => {
        // Run the example as a subprocess
        const examplePath = join(__dirname, 'usage-rtu.ts')
        const result = await runExample(examplePath, [clientPort])

        // Verify exit code and no errors
        expect(result.code).toBe(0)
        expect(result.stderr).toBe('')

        // Verify the hex output contains the expected register values
        // The output should be the 10 registers in hex (20 bytes)
        expect(result.stdout).toContain('1234')
        expect(result.stdout).toContain('5678')
        expect(result.stdout).toContain('9abc')
      }
    )
  }, 30000) // Longer timeout for RTU setup
})

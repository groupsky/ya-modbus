/**
 * Jest test for example-rtu.ts
 *
 * Tests the RTU example by:
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

describe('example-rtu', () => {
  it('reads energy meter data and configures device', async () => {
    // Skip if socat is not available
    const socatAvailable = await isSocatAvailable()
    if (!socatAvailable) {
      console.warn('Skipping RTU example test: socat not available')
      return
    }

    await withRtuEmulator(
      {
        slaveId: 1,
        baudRate: 9600,
        parity: 'even',
        holding: {
          // Measurement registers (0x0000-0x000A)
          0x0000: 2305, // voltage * 10 = 230.5V
          0x0001: 150, // current * 10 = 15.0A
          0x0002: 500, // frequency * 10 = 50.0Hz
          0x0003: 3450, // active power = 3450W
          0x0004: 500, // reactive power = 500VAr
          0x0005: 3486, // apparent power = 3486VA
          0x0006: 990, // power factor * 1000 = 0.990
          0x0007: 0x0001, // total active energy high word
          0x0008: 0x86a0, // total active energy low word (100000 = 1000.00 kWh)
          0x0009: 0x0000, // total reactive energy high word
          0x000a: 0x2710, // total reactive energy low word (10000 = 100.00 kVArh)
          // Configuration registers
          0x002a: 4, // baud rate encoding (4 = 9600)
          0x002b: 1, // device address
        },
      },
      async ({ clientPort }) => {
        // Run the example as a subprocess
        const examplePath = join(__dirname, 'example-rtu.ts')
        const result = await runExample(examplePath, [clientPort])

        // Verify exit code and no errors
        expect(result.code).toBe(0)
        expect(result.stderr).toBe('')

        // Verify voltage reading
        expect(result.stdout).toContain('Voltage: 230.5V')

        // Verify batch read values
        expect(result.stdout).toContain('voltage')
        expect(result.stdout).toContain('current')
        expect(result.stdout).toContain('active_power')
        expect(result.stdout).toContain('total_active_energy')

        // Verify configuration changes
        expect(result.stdout).toContain('Device address changed to 5')
        expect(result.stdout).toContain('Baud rate changed to 4800')
      }
    )
  }, 30000) // Longer timeout for RTU setup
})

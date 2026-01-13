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

/**
 * Helper to write IEEE 754 float to buffer at specified offset
 */
function writeFloat(buffer: Buffer, offset: number, value: number): void {
  buffer.writeFloatBE(value, offset)
}

describe('example-rtu', () => {
  it('reads 3-phase meter data and configures device', async () => {
    // Skip if socat is not available
    const socatAvailable = await isSocatAvailable()
    if (!socatAvailable) {
      console.warn('Skipping RTU example test: socat not available')
      return
    }

    // Create holding registers buffer for real-time data (0x0000-0x003B = 60 registers)
    const realtimeBuffer = Buffer.alloc(120) // 60 registers * 2 bytes

    // Device info
    realtimeBuffer.writeUInt32BE(12345678, 0) // serial_number (registers 0-1)
    realtimeBuffer.writeUInt16BE(1, 4) // device_address (register 2)
    realtimeBuffer.writeUInt16BE(9600, 6) // baud_rate (register 3)
    writeFloat(realtimeBuffer, 8, 1.5) // software_version (registers 4-5)
    writeFloat(realtimeBuffer, 12, 2.0) // hardware_version (registers 6-7)
    realtimeBuffer.writeUInt16BE(1, 16) // ct_rate (register 8)
    writeFloat(realtimeBuffer, 18, 1000.0) // s0_output_rate (registers 9-12)
    realtimeBuffer.writeUInt16BE(60, 26) // cycle_time (register 13)

    // Voltages (registers 14-19)
    writeFloat(realtimeBuffer, 28, 230.5) // voltage_l1
    writeFloat(realtimeBuffer, 32, 231.2) // voltage_l2
    writeFloat(realtimeBuffer, 36, 229.8) // voltage_l3

    // Frequency (registers 20-21)
    writeFloat(realtimeBuffer, 40, 50.01) // frequency

    // Currents (registers 22-27)
    writeFloat(realtimeBuffer, 44, 10.5) // current_l1
    writeFloat(realtimeBuffer, 48, 11.2) // current_l2
    writeFloat(realtimeBuffer, 52, 10.8) // current_l3

    // Active power (registers 28-35)
    writeFloat(realtimeBuffer, 56, 7.25) // active_power_total
    writeFloat(realtimeBuffer, 60, 2.5) // active_power_l1
    writeFloat(realtimeBuffer, 64, 2.4) // active_power_l2
    writeFloat(realtimeBuffer, 68, 2.35) // active_power_l3

    // Reactive power (registers 36-43)
    writeFloat(realtimeBuffer, 72, 1.5) // reactive_power_total
    writeFloat(realtimeBuffer, 76, 0.5) // reactive_power_l1
    writeFloat(realtimeBuffer, 80, 0.5) // reactive_power_l2
    writeFloat(realtimeBuffer, 84, 0.5) // reactive_power_l3

    // Apparent power (registers 44-51)
    writeFloat(realtimeBuffer, 88, 7.4) // apparent_power_total
    writeFloat(realtimeBuffer, 92, 2.55) // apparent_power_l1
    writeFloat(realtimeBuffer, 96, 2.45) // apparent_power_l2
    writeFloat(realtimeBuffer, 100, 2.4) // apparent_power_l3

    // Power factor (registers 52-59)
    writeFloat(realtimeBuffer, 104, 0.98) // power_factor_total
    writeFloat(realtimeBuffer, 108, 0.98) // power_factor_l1
    writeFloat(realtimeBuffer, 112, 0.98) // power_factor_l2
    writeFloat(realtimeBuffer, 116, 0.98) // power_factor_l3

    // Create energy registers buffer (0x0100-0x012F = 48 registers)
    const energyBuffer = Buffer.alloc(96) // 48 registers * 2 bytes
    writeFloat(energyBuffer, 0, 12345.67) // active_energy_total

    // Convert buffers to register maps
    const holdingRegisters: Record<number, number> = {}

    // Real-time registers (0x0000-0x003B)
    for (let i = 0; i < 60; i++) {
      holdingRegisters[i] = realtimeBuffer.readUInt16BE(i * 2)
    }

    // Energy registers (0x0100-0x012F)
    for (let i = 0; i < 48; i++) {
      holdingRegisters[0x100 + i] = energyBuffer.readUInt16BE(i * 2)
    }

    // Config register
    holdingRegisters[0x42] = 0 // combined_code

    await withRtuEmulator(
      {
        slaveId: 1,
        baudRate: 9600,
        parity: 'odd',
        holding: holdingRegisters,
      },
      async ({ clientPort }) => {
        // Run the example as a subprocess
        const examplePath = join(__dirname, 'example-rtu.ts')
        const result = await runExample(examplePath, [clientPort])

        // Verify exit code and no errors
        expect(result.code).toBe(0)
        expect(result.stderr).toBe('')

        // Verify voltage readings
        expect(result.stdout).toContain('voltage_l1')
        expect(result.stdout).toContain('voltage_l2')
        expect(result.stdout).toContain('voltage_l3')
        expect(result.stdout).toContain('frequency')

        // Verify energy reading
        expect(result.stdout).toContain('Total energy:')
        expect(result.stdout).toContain('kWh')

        // Verify power values
        expect(result.stdout).toContain('active_power_total')
        expect(result.stdout).toContain('reactive_power_total')
        expect(result.stdout).toContain('apparent_power_total')
        expect(result.stdout).toContain('power_factor_total')

        // Verify configuration changes
        expect(result.stdout).toContain('Device address changed to 5')
        expect(result.stdout).toContain('Baud rate changed to 4800')
        expect(result.stdout).toContain('S0 output rate set to 1000')
        expect(result.stdout).toContain('Combined code set to 5')
      }
    )
  }, 30000) // Longer timeout for RTU setup
})

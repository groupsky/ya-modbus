/**
 * API examples for documentation purposes.
 * This file demonstrates how to use the functions exported by @ya-modbus/driver-sdk.
 */

import {
  createEnumValidator,
  createRangeValidator,
  formatEnumError,
  formatRangeError,
  isValidInteger,
  readScaledInt16BE,
  readScaledUInt16BE,
  readScaledUInt32BE,
  writeScaledInt16BE,
  writeScaledUInt16BE,
} from '@ya-modbus/driver-sdk'
import type { DeviceDriver, Transport } from '@ya-modbus/driver-types'

// readScaledUInt16BE example
export async function readTemperature(transport: Transport): Promise<number> {
  // Device stores temperature as integer ×10 (235 = 23.5°C)
  const buffer = await transport.readInputRegisters(0, 1)
  const temperature = readScaledUInt16BE(buffer, 0, 10)
  // temperature = 23.5
  return temperature
}

// readScaledInt16BE example
export async function readCorrection(transport: Transport): Promise<number> {
  // Device stores correction offset as signed integer ×10 (-50 = -5.0°C)
  const buffer = await transport.readHoldingRegisters(0x103, 1)
  const correction = readScaledInt16BE(buffer, 0, 10)
  // correction = -5.0
  return correction
}

// readScaledUInt32BE example
export async function readTotalEnergy(transport: Transport): Promise<number> {
  // Device stores total energy as 32-bit integer ×100 (1000000 = 10000.00 kWh)
  const buffer = await transport.readHoldingRegisters(0x0007, 2)
  const totalEnergy = readScaledUInt32BE(buffer, 0, 100)
  // totalEnergy = 10000.0
  return totalEnergy
}

// writeScaledUInt16BE example
export async function writeHumidityCorrection(transport: Transport): Promise<void> {
  // Write humidity correction of 5.5% (stored as 55)
  const buffer = writeScaledUInt16BE(5.5, 10)
  await transport.writeMultipleRegisters(0x104, buffer)
}

// writeScaledInt16BE example
export async function writeTemperatureCorrection(transport: Transport): Promise<void> {
  // Write temperature correction of -3.5°C (stored as -35)
  const buffer = writeScaledInt16BE(-3.5, 10)
  await transport.writeMultipleRegisters(0x103, buffer)
}

// createEnumValidator example
const VALID_BAUD_RATES = [9600, 14400, 19200] as const
type ValidBaudRate = (typeof VALID_BAUD_RATES)[number]

const isValidBaudRate = createEnumValidator(VALID_BAUD_RATES)

export function validateBaudRate(value: unknown): ValidBaudRate {
  if (!isValidBaudRate(value)) {
    throw new Error(formatEnumError('baud rate', VALID_BAUD_RATES))
  }
  // value is now typed as ValidBaudRate (9600 | 14400 | 19200)
  return value
}

// createRangeValidator example
const isValidAddress = createRangeValidator(1, 247)

export function validateAddress(value: unknown): number {
  if (!isValidAddress(value)) {
    throw new Error(formatRangeError('device address', 1, 247))
  }
  // value is a finite number between 1 and 247
  return value
}

// isValidInteger example
export function validateInteger(value: unknown): number {
  if (!isValidInteger(value)) {
    throw new Error('Device address must be an integer')
  }
  return value
}

// formatRangeError example
export function demoFormatRangeError(): string {
  return formatRangeError('device address', 1, 247)
  // => 'Invalid device address: must be between 1 and 247'
}

// formatEnumError example
export function demoFormatEnumError(): string {
  return formatEnumError('baud rate', [9600, 14400, 19200])
  // => 'Invalid baud rate: must be one of 9600, 14400, 19200'
}

// Edge case handling examples
export function demoEdgeCases(): void {
  const _buffer = Buffer.alloc(2)

  // Throws: Invalid scale: must be greater than 0
  // readScaledUInt16BE(_buffer, 0, 0)

  // Throws: Invalid value: must be a finite number
  // writeScaledUInt16BE(NaN, 10)

  // Throws: Invalid scaled value: 65536 is outside uint16 range (0 to 65535)
  // writeScaledUInt16BE(6553.6, 10)

  console.log('Edge cases demonstrated')
}

// TypeScript type narrowing example
export function demoTypeNarrowing(): void {
  const isValidBaudRateNarrow = createEnumValidator([9600, 14400, 19200] as const)

  const value: unknown = getUserInput()

  if (isValidBaudRateNarrow(value)) {
    // TypeScript knows: value is 9600 | 14400 | 19200
    console.log('Valid baud rate:', value)
  }
}

function getUserInput(): unknown {
  return 9600
}

// Usage in Drivers - complete example
export function createExampleDriver(transport: Transport): DeviceDriver {
  // Validate configuration
  if (!isValidBaudRate(9600)) {
    throw new Error(formatEnumError('baud rate', VALID_BAUD_RATES))
  }

  return {
    name: 'my-device',
    manufacturer: 'Example Corp',
    model: 'EX-100',
    dataPoints: [],

    async readDataPoint(id: string) {
      if (id === 'temperature') {
        const buffer = await transport.readInputRegisters(0, 1)
        return readScaledUInt16BE(buffer, 0, 10)
      }
      if (id === 'correction') {
        const buffer = await transport.readHoldingRegisters(0x103, 1)
        return readScaledInt16BE(buffer, 0, 10)
      }
      return null
    },

    async writeDataPoint(id: string, value: unknown) {
      if (id === 'correction' && typeof value === 'number') {
        const buffer = writeScaledInt16BE(value, 10)
        await transport.writeMultipleRegisters(0x103, buffer)
      }
    },

    readDataPoints(_ids: string[]) {
      return Promise.resolve({})
    },
  }
}

/**
 * Type usage examples for documentation purposes.
 * This file demonstrates how to use the types exported by @ya-modbus/driver-types.
 */

// DeviceDriver example
import type {
  DataPoint,
  DefaultSerialConfig,
  DeviceDriver,
  DeviceRegistry,
  SupportedSerialConfig,
  Transport,
} from '@ya-modbus/driver-types'

// Example DeviceDriver implementation structure
export function createExampleDriver(_transport: Transport): DeviceDriver {
  const driver: DeviceDriver = {
    name: 'my-device',
    manufacturer: 'Acme Corp',
    model: 'MD-100',
    dataPoints: [],

    readDataPoint(_id: string) {
      return Promise.resolve(0)
    },
    writeDataPoint(_id: string, _value: unknown) {
      return Promise.resolve()
    },
    readDataPoints(_ids: string[]) {
      return Promise.resolve({})
    },
  }
  return driver
}

// Transport usage example
export async function transportExample(transport: Transport): Promise<void> {
  // Read holding registers
  const buffer = await transport.readHoldingRegisters(0x0000, 2)
  console.log(buffer)

  // Write single register
  await transport.writeSingleRegister(0x0100, 1234)
}

// DataPoint example
export const temperaturePoint: DataPoint = {
  id: 'temperature',
  name: 'Temperature',
  description: 'Current temperature reading',
  unit: '°C',
  dataType: 'float',
  access: 'read',
}

// Configuration types example
export const DEFAULT_CONFIG = {
  baudRate: 9600,
  parity: 'even',
  dataBits: 8,
  stopBits: 1,
  defaultAddress: 1,
} as const satisfies DefaultSerialConfig

export const SUPPORTED_CONFIG = {
  validBaudRates: [9600, 14400, 19200],
  validParity: ['even', 'none'],
} as const satisfies SupportedSerialConfig

// Multi-device registry example
export const DEVICES = {
  'or-we-514': {
    manufacturer: 'ORNO',
    model: 'OR-WE-514',
    description: 'Single-phase energy meter',
  },
  'or-we-516': {
    manufacturer: 'ORNO',
    model: 'OR-WE-516',
    description: 'Three-phase energy meter',
  },
} as const satisfies DeviceRegistry

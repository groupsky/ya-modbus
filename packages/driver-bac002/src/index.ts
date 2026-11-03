/**
 * BAC-002 room thermostat driver
 */

import type { CreateDriverFunction, DefaultSerialConfig } from '@ya-modbus/driver-types'

/** Factory default serial settings of the BAC-002 */
export const DEFAULT_CONFIG = {
  baudRate: 9600,
  parity: 'none',
  dataBits: 8,
  stopBits: 1,
  defaultAddress: 1,
} as const satisfies DefaultSerialConfig

export const createDriver: CreateDriverFunction = () =>
  Promise.resolve({
    name: 'BAC-002',
    manufacturer: 'Unknown',
    model: 'BAC-002',
    dataPoints: [],
    readDataPoint: () => Promise.reject(new Error('Not implemented')),
    readDataPoints: () => Promise.resolve({}),
    writeDataPoint: () => Promise.reject(new Error('Not implemented')),
  })

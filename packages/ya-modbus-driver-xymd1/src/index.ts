/**
 * XYMD1 Temperature and Humidity Sensor Driver
 *
 * Device specifications:
 * - Default address: 1
 * - Baud rate: 9600
 * - Parity: Even
 * - Stop bits: 1
 * - Data bits: 8
 *
 * Register mapping:
 * - Input registers 1-2: Temperature (×10) and Humidity (×10)
 * - Holding register 0x101: Device address configuration
 * - Holding register 0x102: Baud rate configuration
 */

import type { DeviceDriver, DataPoint, CreateDriverFunction } from '@ya-modbus/driver-types'

/**
 * Valid baud rates for XYMD1
 */
const VALID_BAUD_RATES = [2400, 4800, 9600, 19200, 38400] as const

/**
 * Data point definitions for XYMD1
 */
const DATA_POINTS: ReadonlyArray<DataPoint> = [
  {
    id: 'temperature',
    name: 'Temperature',
    type: 'float',
    unit: '°C',
    access: 'r',
    description: 'Temperature in degrees Celsius',
    decimals: 1,
  },
  {
    id: 'humidity',
    name: 'Relative Humidity',
    type: 'float',
    unit: '%',
    access: 'r',
    description: 'Relative humidity percentage',
    decimals: 1,
    min: 0,
    max: 100,
  },
  {
    id: 'device_address',
    name: 'Device Address',
    type: 'integer',
    access: 'rw',
    pollType: 'on-demand',
    description: 'Modbus device address (1-247). Changes applied after device restart.',
    min: 1,
    max: 247,
  },
  {
    id: 'baud_rate',
    name: 'Baud Rate',
    type: 'enum',
    access: 'rw',
    pollType: 'on-demand',
    description: 'Serial communication baud rate. Changes applied after device restart.',
    enumValues: {
      2400: '2400 bps',
      4800: '4800 bps',
      9600: '9600 bps',
      19200: '19200 bps',
      38400: '38400 bps',
    },
  },
]

/**
 * Decode raw Modbus value to data point value
 */
function decodeDataPoint(id: string, rawValue: Buffer): unknown {
  if (id === 'temperature') {
    const temp = rawValue.readUInt16BE(0)
    return temp / 10
  }
  if (id === 'humidity') {
    const humidity = rawValue.readUInt16BE(2)
    return humidity / 10
  }
  if (id === 'device_address') {
    return rawValue.readUInt16BE(0)
  }
  if (id === 'baud_rate') {
    return rawValue.readUInt16BE(0)
  }
  throw new Error(`Unknown data point: ${id}`)
}

/**
 * Encode data point value to Modbus register value(s)
 */
function encodeDataPoint(id: string, value: unknown): Buffer {
  if (id === 'device_address') {
    if (typeof value !== 'number' || value < 1 || value > 247) {
      throw new Error('Invalid device address: must be between 1 and 247')
    }
    const buffer = Buffer.allocUnsafe(2)
    buffer.writeUInt16BE(value, 0)
    return buffer
  }
  if (id === 'baud_rate') {
    if (typeof value !== 'number' || !(VALID_BAUD_RATES as readonly number[]).includes(value)) {
      throw new Error(`Invalid baud rate: must be one of ${VALID_BAUD_RATES.join(', ')}`)
    }
    const buffer = Buffer.allocUnsafe(2)
    buffer.writeUInt16BE(value, 0)
    return buffer
  }
  throw new Error(`Data point ${id} is read-only`)
}

/**
 * Create XYMD1 device driver
 */
export const createDriver: CreateDriverFunction = (config) => {
  const { transport } = config

  const driver: DeviceDriver = {
    name: 'XY-MD1',
    manufacturer: 'Unknown',
    model: 'XY-MD1',
    dataPoints: DATA_POINTS,

    async readDataPoint(id: string): Promise<unknown> {
      if (id === 'device_address') {
        const buffer = await transport.readHoldingRegisters(0x101, 1)
        return decodeDataPoint(id, buffer)
      }
      if (id === 'baud_rate') {
        const buffer = await transport.readHoldingRegisters(0x102, 1)
        return decodeDataPoint(id, buffer)
      }
      // Always read both input registers for temperature and humidity
      const buffer = await transport.readInputRegisters(1, 2)
      return decodeDataPoint(id, buffer)
    },

    async writeDataPoint(id: string, value: unknown): Promise<void> {
      if (id === 'device_address') {
        const buffer = encodeDataPoint(id, value)
        await transport.writeMultipleRegisters(0x101, buffer)
        return
      }
      if (id === 'baud_rate') {
        const buffer = encodeDataPoint(id, value)
        await transport.writeMultipleRegisters(0x102, buffer)
        return
      }
      throw new Error(`Data point ${id} is read-only`)
    },

    async readDataPoints(ids: string[]): Promise<Record<string, unknown>> {
      // Read both registers once
      const buffer = await transport.readInputRegisters(1, 2)

      const result: Record<string, unknown> = {}
      for (const id of ids) {
        result[id] = decodeDataPoint(id, buffer)
      }
      return result
    },
  }

  return Promise.resolve(driver)
}

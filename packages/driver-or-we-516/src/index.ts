/**
 * ORNO OR-WE-516 3-Phase Energy Meter Driver
 *
 * 3-phase energy meter with RS-485, 80A, MID, 3 modules, DIN TH-35mm
 * https://orno.pl/en/product/1086/3-phase-energy-meter-with-rs-485-80a-mid-3-modules-din-th-35mm
 *
 * Factory default specifications are exported via the DEFAULT_CONFIG constant.
 * See DEFAULT_CONFIG for baud rate, parity, data bits, stop bits, and default address.
 *
 * Register mapping:
 * - Holding registers 0x0000-0x003B: Device info and real-time measurements
 * - Holding registers 0x0100-0x012E: Energy counters
 * - All float values are IEEE 754 single-precision (32-bit)
 */

import {
  readFloatBE,
  writeFloatBE,
  createEnumValidator,
  createRangeValidator,
  isValidInteger,
  formatEnumError,
  formatRangeError,
} from '@ya-modbus/driver-sdk'
import type {
  DeviceDriver,
  DataPoint,
  CreateDriverFunction,
  DriverConfig,
  DefaultSerialConfig,
  SupportedSerialConfig,
} from '@ya-modbus/driver-types'

/**
 * Supported configuration values for OR-WE-516
 *
 * The device supports:
 * - Baud rates: 1200, 2400, 4800, 9600 bps
 * - Parity: odd
 * - Data bits: 8 only
 * - Stop bits: 1 only
 * - Slave address: 1-247 (standard Modbus range)
 *
 * See DEFAULT_CONFIG for factory defaults.
 */
export const SUPPORTED_CONFIG = {
  validBaudRates: [1200, 2400, 4800, 9600],
  validParity: ['odd'],
  validDataBits: [8],
  validStopBits: [1],
  validAddressRange: [1, 247],
} as const satisfies SupportedSerialConfig

/**
 * Default OR-WE-516 device configuration
 *
 * Use these values when connecting to a factory-default OR-WE-516 device.
 * These are the settings the device ships with from the manufacturer.
 */
export const DEFAULT_CONFIG = {
  baudRate: 9600,
  parity: 'odd',
  dataBits: 8,
  stopBits: 1,
  defaultAddress: 1,
} as const satisfies DefaultSerialConfig

/**
 * Validators for writable data points
 */
const isValidBaudRate = createEnumValidator(SUPPORTED_CONFIG.validBaudRates)
const isValidAddress = createRangeValidator(...SUPPORTED_CONFIG.validAddressRange)
const isValidCycleTime = createRangeValidator(0, 65535)

/**
 * Data point definitions for OR-WE-516
 */
const DATA_POINTS: ReadonlyArray<DataPoint> = [
  // Device info
  {
    id: 'serial_number',
    name: 'Serial Number',
    type: 'integer',
    access: 'r',
    pollType: 'static',
    description: 'Device serial number',
  },
  {
    id: 'device_address',
    name: 'Device Address',
    type: 'integer',
    access: 'rw',
    pollType: 'on-demand',
    description: 'Modbus device address (1-247)',
    min: 1,
    max: 247,
  },
  {
    id: 'baud_rate',
    name: 'Baud Rate',
    type: 'enum',
    access: 'rw',
    pollType: 'on-demand',
    description: 'Serial communication baud rate',
    enumValues: {
      1200: '1200 bps',
      2400: '2400 bps',
      4800: '4800 bps',
      9600: '9600 bps',
    },
  },
  {
    id: 'software_version',
    name: 'Software Version',
    type: 'float',
    access: 'r',
    pollType: 'static',
    description: 'Firmware software version',
  },
  {
    id: 'hardware_version',
    name: 'Hardware Version',
    type: 'float',
    access: 'r',
    pollType: 'static',
    description: 'Hardware version',
  },
  {
    id: 'ct_rate',
    name: 'CT Rate',
    type: 'integer',
    access: 'r',
    pollType: 'static',
    description: 'Current transformer ratio',
  },
  {
    id: 's0_output_rate',
    name: 'S0 Output Rate',
    type: 'float',
    access: 'rw',
    pollType: 'on-demand',
    description: 'S0 pulse output rate',
  },
  {
    id: 'cycle_time',
    name: 'Cycle Time',
    type: 'integer',
    access: 'rw',
    pollType: 'on-demand',
    description: 'Measurement cycle time',
  },
  {
    id: 'combined_code',
    name: 'Combined Code',
    type: 'integer',
    access: 'rw',
    pollType: 'on-demand',
    description: 'Synthesis code for bidirectional energy calculation mode',
  },

  // Voltage measurements
  {
    id: 'voltage_l1',
    name: 'L1 Voltage',
    type: 'float',
    unit: 'V',
    access: 'r',
    description: 'Phase L1 voltage',
    decimals: 1,
  },
  {
    id: 'voltage_l2',
    name: 'L2 Voltage',
    type: 'float',
    unit: 'V',
    access: 'r',
    description: 'Phase L2 voltage',
    decimals: 1,
  },
  {
    id: 'voltage_l3',
    name: 'L3 Voltage',
    type: 'float',
    unit: 'V',
    access: 'r',
    description: 'Phase L3 voltage',
    decimals: 1,
  },

  // Frequency
  {
    id: 'frequency',
    name: 'Grid Frequency',
    type: 'float',
    unit: 'Hz',
    access: 'r',
    description: 'Grid frequency',
    decimals: 2,
  },

  // Current measurements
  {
    id: 'current_l1',
    name: 'L1 Current',
    type: 'float',
    unit: 'A',
    access: 'r',
    description: 'Phase L1 current',
    decimals: 3,
  },
  {
    id: 'current_l2',
    name: 'L2 Current',
    type: 'float',
    unit: 'A',
    access: 'r',
    description: 'Phase L2 current',
    decimals: 3,
  },
  {
    id: 'current_l3',
    name: 'L3 Current',
    type: 'float',
    unit: 'A',
    access: 'r',
    description: 'Phase L3 current',
    decimals: 3,
  },

  // Active power
  {
    id: 'active_power_total',
    name: 'Total Active Power',
    type: 'float',
    unit: 'kW',
    access: 'r',
    description: 'Total active power (all phases)',
    decimals: 3,
  },
  {
    id: 'active_power_l1',
    name: 'L1 Active Power',
    type: 'float',
    unit: 'kW',
    access: 'r',
    description: 'Phase L1 active power',
    decimals: 3,
  },
  {
    id: 'active_power_l2',
    name: 'L2 Active Power',
    type: 'float',
    unit: 'kW',
    access: 'r',
    description: 'Phase L2 active power',
    decimals: 3,
  },
  {
    id: 'active_power_l3',
    name: 'L3 Active Power',
    type: 'float',
    unit: 'kW',
    access: 'r',
    description: 'Phase L3 active power',
    decimals: 3,
  },

  // Reactive power
  {
    id: 'reactive_power_total',
    name: 'Total Reactive Power',
    type: 'float',
    unit: 'kVAr',
    access: 'r',
    description: 'Total reactive power (all phases)',
    decimals: 3,
  },
  {
    id: 'reactive_power_l1',
    name: 'L1 Reactive Power',
    type: 'float',
    unit: 'kVAr',
    access: 'r',
    description: 'Phase L1 reactive power',
    decimals: 3,
  },
  {
    id: 'reactive_power_l2',
    name: 'L2 Reactive Power',
    type: 'float',
    unit: 'kVAr',
    access: 'r',
    description: 'Phase L2 reactive power',
    decimals: 3,
  },
  {
    id: 'reactive_power_l3',
    name: 'L3 Reactive Power',
    type: 'float',
    unit: 'kVAr',
    access: 'r',
    description: 'Phase L3 reactive power',
    decimals: 3,
  },

  // Apparent power
  {
    id: 'apparent_power_total',
    name: 'Total Apparent Power',
    type: 'float',
    unit: 'kVA',
    access: 'r',
    description: 'Total apparent power (all phases)',
    decimals: 3,
  },
  {
    id: 'apparent_power_l1',
    name: 'L1 Apparent Power',
    type: 'float',
    unit: 'kVA',
    access: 'r',
    description: 'Phase L1 apparent power',
    decimals: 3,
  },
  {
    id: 'apparent_power_l2',
    name: 'L2 Apparent Power',
    type: 'float',
    unit: 'kVA',
    access: 'r',
    description: 'Phase L2 apparent power',
    decimals: 3,
  },
  {
    id: 'apparent_power_l3',
    name: 'L3 Apparent Power',
    type: 'float',
    unit: 'kVA',
    access: 'r',
    description: 'Phase L3 apparent power',
    decimals: 3,
  },

  // Power factor
  {
    id: 'power_factor_total',
    name: 'Total Power Factor',
    type: 'float',
    access: 'r',
    description: 'Total power factor (all phases)',
    decimals: 3,
    min: -1,
    max: 1,
  },
  {
    id: 'power_factor_l1',
    name: 'L1 Power Factor',
    type: 'float',
    access: 'r',
    description: 'Phase L1 power factor',
    decimals: 3,
    min: -1,
    max: 1,
  },
  {
    id: 'power_factor_l2',
    name: 'L2 Power Factor',
    type: 'float',
    access: 'r',
    description: 'Phase L2 power factor',
    decimals: 3,
    min: -1,
    max: 1,
  },
  {
    id: 'power_factor_l3',
    name: 'L3 Power Factor',
    type: 'float',
    access: 'r',
    description: 'Phase L3 power factor',
    decimals: 3,
    min: -1,
    max: 1,
  },

  // Active energy
  {
    id: 'active_energy_total',
    name: 'Total Active Energy',
    type: 'float',
    unit: 'kWh',
    access: 'r',
    description: 'Total active energy (all phases)',
    decimals: 2,
  },
  {
    id: 'active_energy_l1',
    name: 'L1 Total Active Energy',
    type: 'float',
    unit: 'kWh',
    access: 'r',
    description: 'Phase L1 total active energy',
    decimals: 2,
  },
  {
    id: 'active_energy_l2',
    name: 'L2 Total Active Energy',
    type: 'float',
    unit: 'kWh',
    access: 'r',
    description: 'Phase L2 total active energy',
    decimals: 2,
  },
  {
    id: 'active_energy_l3',
    name: 'L3 Total Active Energy',
    type: 'float',
    unit: 'kWh',
    access: 'r',
    description: 'Phase L3 total active energy',
    decimals: 2,
  },
  {
    id: 'active_energy_forward',
    name: 'Forward Active Energy',
    type: 'float',
    unit: 'kWh',
    access: 'r',
    description: 'Forward (import) active energy',
    decimals: 2,
  },
  {
    id: 'active_energy_forward_l1',
    name: 'L1 Forward Active Energy',
    type: 'float',
    unit: 'kWh',
    access: 'r',
    description: 'Phase L1 forward active energy',
    decimals: 2,
  },
  {
    id: 'active_energy_forward_l2',
    name: 'L2 Forward Active Energy',
    type: 'float',
    unit: 'kWh',
    access: 'r',
    description: 'Phase L2 forward active energy',
    decimals: 2,
  },
  {
    id: 'active_energy_forward_l3',
    name: 'L3 Forward Active Energy',
    type: 'float',
    unit: 'kWh',
    access: 'r',
    description: 'Phase L3 forward active energy',
    decimals: 2,
  },
  {
    id: 'active_energy_reverse',
    name: 'Reverse Active Energy',
    type: 'float',
    unit: 'kWh',
    access: 'r',
    description: 'Reverse (export) active energy',
    decimals: 2,
  },
  {
    id: 'active_energy_reverse_l1',
    name: 'L1 Reverse Active Energy',
    type: 'float',
    unit: 'kWh',
    access: 'r',
    description: 'Phase L1 reverse active energy',
    decimals: 2,
  },
  {
    id: 'active_energy_reverse_l2',
    name: 'L2 Reverse Active Energy',
    type: 'float',
    unit: 'kWh',
    access: 'r',
    description: 'Phase L2 reverse active energy',
    decimals: 2,
  },
  {
    id: 'active_energy_reverse_l3',
    name: 'L3 Reverse Active Energy',
    type: 'float',
    unit: 'kWh',
    access: 'r',
    description: 'Phase L3 reverse active energy',
    decimals: 2,
  },

  // Reactive energy
  {
    id: 'reactive_energy_total',
    name: 'Total Reactive Energy',
    type: 'float',
    unit: 'kVArh',
    access: 'r',
    description: 'Total reactive energy (all phases)',
    decimals: 2,
  },
  {
    id: 'reactive_energy_l1',
    name: 'L1 Total Reactive Energy',
    type: 'float',
    unit: 'kVArh',
    access: 'r',
    description: 'Phase L1 total reactive energy',
    decimals: 2,
  },
  {
    id: 'reactive_energy_l2',
    name: 'L2 Total Reactive Energy',
    type: 'float',
    unit: 'kVArh',
    access: 'r',
    description: 'Phase L2 total reactive energy',
    decimals: 2,
  },
  {
    id: 'reactive_energy_l3',
    name: 'L3 Total Reactive Energy',
    type: 'float',
    unit: 'kVArh',
    access: 'r',
    description: 'Phase L3 total reactive energy',
    decimals: 2,
  },
  {
    id: 'reactive_energy_forward',
    name: 'Forward Reactive Energy',
    type: 'float',
    unit: 'kVArh',
    access: 'r',
    description: 'Forward (import) reactive energy',
    decimals: 2,
  },
  {
    id: 'reactive_energy_forward_l1',
    name: 'L1 Forward Reactive Energy',
    type: 'float',
    unit: 'kVArh',
    access: 'r',
    description: 'Phase L1 forward reactive energy',
    decimals: 2,
  },
  {
    id: 'reactive_energy_forward_l2',
    name: 'L2 Forward Reactive Energy',
    type: 'float',
    unit: 'kVArh',
    access: 'r',
    description: 'Phase L2 forward reactive energy',
    decimals: 2,
  },
  {
    id: 'reactive_energy_forward_l3',
    name: 'L3 Forward Reactive Energy',
    type: 'float',
    unit: 'kVArh',
    access: 'r',
    description: 'Phase L3 forward reactive energy',
    decimals: 2,
  },
  {
    id: 'reactive_energy_reverse',
    name: 'Reverse Reactive Energy',
    type: 'float',
    unit: 'kVArh',
    access: 'r',
    description: 'Reverse (export) reactive energy',
    decimals: 2,
  },
  {
    id: 'reactive_energy_reverse_l1',
    name: 'L1 Reverse Reactive Energy',
    type: 'float',
    unit: 'kVArh',
    access: 'r',
    description: 'Phase L1 reverse reactive energy',
    decimals: 2,
  },
  {
    id: 'reactive_energy_reverse_l2',
    name: 'L2 Reverse Reactive Energy',
    type: 'float',
    unit: 'kVArh',
    access: 'r',
    description: 'Phase L2 reverse reactive energy',
    decimals: 2,
  },
  {
    id: 'reactive_energy_reverse_l3',
    name: 'L3 Reverse Reactive Energy',
    type: 'float',
    unit: 'kVArh',
    access: 'r',
    description: 'Phase L3 reverse reactive energy',
    decimals: 2,
  },
]

/**
 * Register mapping for real-time data (0x0000-0x003B)
 */
const REALTIME_REGISTER_MAP: Record<string, number> = {
  serial_number: 0,
  device_address: 2,
  baud_rate: 3,
  software_version: 4,
  hardware_version: 6,
  ct_rate: 8,
  s0_output_rate: 9,
  cycle_time: 13,
  voltage_l1: 14,
  voltage_l2: 16,
  voltage_l3: 18,
  frequency: 20,
  current_l1: 22,
  current_l2: 24,
  current_l3: 26,
  active_power_total: 28,
  active_power_l1: 30,
  active_power_l2: 32,
  active_power_l3: 34,
  reactive_power_total: 36,
  reactive_power_l1: 38,
  reactive_power_l2: 40,
  reactive_power_l3: 42,
  apparent_power_total: 44,
  apparent_power_l1: 46,
  apparent_power_l2: 48,
  apparent_power_l3: 50,
  power_factor_total: 52,
  power_factor_l1: 54,
  power_factor_l2: 56,
  power_factor_l3: 58,
}

/**
 * Register mapping for energy data (relative to 0x0100)
 */
const ENERGY_REGISTER_MAP: Record<string, number> = {
  active_energy_total: 0,
  active_energy_l1: 2,
  active_energy_l2: 4,
  active_energy_l3: 6,
  active_energy_forward: 8,
  active_energy_forward_l1: 10,
  active_energy_forward_l2: 12,
  active_energy_forward_l3: 14,
  active_energy_reverse: 16,
  active_energy_reverse_l1: 18,
  active_energy_reverse_l2: 20,
  active_energy_reverse_l3: 22,
  reactive_energy_total: 24,
  reactive_energy_l1: 26,
  reactive_energy_l2: 28,
  reactive_energy_l3: 30,
  reactive_energy_forward: 32,
  reactive_energy_forward_l1: 34,
  reactive_energy_forward_l2: 36,
  reactive_energy_forward_l3: 38,
  reactive_energy_reverse: 40,
  reactive_energy_reverse_l1: 42,
  reactive_energy_reverse_l2: 44,
  reactive_energy_reverse_l3: 46,
}

/**
 * Register mapping for config registers outside bulk read range
 * These registers are read/written individually
 */
const CONFIG_REGISTER_MAP: Record<string, number> = {
  combined_code: 0x0042,
}

/**
 * Data points that are single 16-bit registers (not floats)
 */
const SINGLE_REGISTER_POINTS = new Set([
  'device_address',
  'baud_rate',
  'ct_rate',
  'cycle_time',
  'combined_code',
])

/**
 * Data points that are 32-bit integers (2 registers)
 */
const DOUBLE_REGISTER_INT_POINTS = new Set(['serial_number'])

/**
 * Decode data point value from buffer
 */
function decodeRealtimeDataPoint(id: string, buffer: Buffer): unknown {
  const registerOffset = REALTIME_REGISTER_MAP[id]
  if (registerOffset === undefined) {
    throw new Error(`Unknown realtime data point: ${id}`)
  }

  if (SINGLE_REGISTER_POINTS.has(id)) {
    return buffer.readUInt16BE(registerOffset * 2)
  }

  if (DOUBLE_REGISTER_INT_POINTS.has(id)) {
    return buffer.readUInt32BE(registerOffset * 2)
  }

  return readFloatBE(buffer, registerOffset * 2)
}

/**
 * Decode energy data point value from buffer
 */
function decodeEnergyDataPoint(id: string, buffer: Buffer): unknown {
  const registerOffset = ENERGY_REGISTER_MAP[id]
  if (registerOffset === undefined) {
    throw new Error(`Unknown energy data point: ${id}`)
  }
  return readFloatBE(buffer, registerOffset * 2)
}

/**
 * Create OR-WE-516 device driver
 */
export const createDriver: CreateDriverFunction = (config: DriverConfig) => {
  const { transport } = config

  const driver: DeviceDriver = {
    name: 'OR-WE-516',
    manufacturer: 'ORNO',
    model: 'OR-WE-516',
    dataPoints: DATA_POINTS,

    async readDataPoint(id: string): Promise<unknown> {
      // Check if it's a realtime data point
      if (id in REALTIME_REGISTER_MAP) {
        const buffer = await transport.readHoldingRegisters(0, 60)
        return decodeRealtimeDataPoint(id, buffer)
      }

      // Check if it's an energy data point
      if (id in ENERGY_REGISTER_MAP) {
        const buffer = await transport.readHoldingRegisters(0x100, 48)
        return decodeEnergyDataPoint(id, buffer)
      }

      // Check if it's a config register (read individually)
      const configRegister = CONFIG_REGISTER_MAP[id]
      if (configRegister !== undefined) {
        const buffer = await transport.readHoldingRegisters(configRegister, 1)
        return buffer.readUInt16BE(0)
      }

      throw new Error(`Unknown data point: ${id}`)
    },

    async writeDataPoint(id: string, value: unknown): Promise<void> {
      if (id === 'device_address') {
        if (!isValidInteger(value) || !isValidAddress(value)) {
          const [min, max] = SUPPORTED_CONFIG.validAddressRange
          throw new Error(formatRangeError('device address', min, max))
        }
        await transport.writeSingleRegister(2, value)
        return
      }

      if (id === 'baud_rate') {
        if (!isValidBaudRate(value)) {
          throw new Error(formatEnumError('baud rate', SUPPORTED_CONFIG.validBaudRates))
        }
        await transport.writeSingleRegister(3, value)
        return
      }

      if (id === 's0_output_rate') {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          throw new Error('Invalid S0 output rate: must be a finite number')
        }
        const buffer = writeFloatBE(value)
        await transport.writeMultipleRegisters(0x0009, buffer)
        return
      }

      if (id === 'cycle_time') {
        if (!isValidInteger(value) || !isValidCycleTime(value)) {
          throw new Error(formatRangeError('cycle time', 0, 65535))
        }
        await transport.writeSingleRegister(0x000d, value)
        return
      }

      if (id === 'combined_code') {
        if (!isValidInteger(value) || value < 0 || value > 65535) {
          throw new Error(formatRangeError('combined code', 0, 65535))
        }
        await transport.writeSingleRegister(0x0042, value)
        return
      }

      throw new Error(`Data point ${id} is read-only`)
    },

    async readDataPoints(ids: string[]): Promise<Record<string, unknown>> {
      const result: Record<string, unknown> = {}

      // Separate data points by register type
      const realtimePoints = ids.filter((id) => id in REALTIME_REGISTER_MAP)
      const energyPoints = ids.filter((id) => id in ENERGY_REGISTER_MAP)
      const configPoints = ids.filter((id) => id in CONFIG_REGISTER_MAP)

      // Read realtime registers if needed
      if (realtimePoints.length > 0) {
        const buffer = await transport.readHoldingRegisters(0, 60)
        for (const id of realtimePoints) {
          result[id] = decodeRealtimeDataPoint(id, buffer)
        }
      }

      // Read energy registers if needed
      if (energyPoints.length > 0) {
        const buffer = await transport.readHoldingRegisters(0x100, 48)
        for (const id of energyPoints) {
          result[id] = decodeEnergyDataPoint(id, buffer)
        }
      }

      // Read config registers individually
      for (const id of configPoints) {
        const register = CONFIG_REGISTER_MAP[id]
        if (register !== undefined) {
          const buffer = await transport.readHoldingRegisters(register, 1)
          result[id] = buffer.readUInt16BE(0)
        }
      }

      // Check for unknown data points
      const unknownPoints = ids.filter(
        (id) =>
          !(id in REALTIME_REGISTER_MAP) &&
          !(id in ENERGY_REGISTER_MAP) &&
          !(id in CONFIG_REGISTER_MAP)
      )
      if (unknownPoints.length > 0) {
        throw new Error(`Unknown data points: ${unknownPoints.join(', ')}`)
      }

      return result
    },
  }

  return Promise.resolve(driver)
}

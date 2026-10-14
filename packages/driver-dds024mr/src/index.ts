/**
 * Sinotimer DDS024MR 3-Phase Energy Meter Driver
 *
 * 3-phase + N energy meter (despite the "DDS" name), DIN rail, RS-485.
 *
 * Factory default specifications are exported via the DEFAULT_CONFIG constant.
 * See DEFAULT_CONFIG for baud rate, parity, data bits, stop bits, and default address.
 *
 * Register mapping (input registers, FC 04, float32 big-endian, 2 registers each):
 * - 0x0000-0x0037: voltage, current, power, power factor, frequency
 * - 0x0100: total active energy
 * - 0x0400: total reactive energy
 *
 * Power is in W and var. The vendor register list says kW; the real meter returns W.
 */

import { readFloatBE } from '@ya-modbus/driver-sdk'
import type {
  CreateDriverFunction,
  DataPoint,
  DefaultSerialConfig,
  DeviceDriver,
  DriverConfig,
  SupportedSerialConfig,
} from '@ya-modbus/driver-types'

/**
 * Supported configuration values for DDS024MR
 *
 * Baud rates and parity codes come from the vendor register list (settings table);
 * the address range comes from the manual of the sibling model DDS661.
 */
export const SUPPORTED_CONFIG = {
  validBaudRates: [300, 600, 1200, 2400, 4800, 9600],
  validParity: ['even', 'odd', 'none'],
  validDataBits: [8],
  validStopBits: [1],
  validAddressRange: [1, 247],
} as const satisfies SupportedSerialConfig

/**
 * Default DDS024MR device configuration
 *
 * Use these values when connecting to a factory-default DDS024MR device.
 */
export const DEFAULT_CONFIG = {
  baudRate: 9600,
  parity: 'even',
  dataBits: 8,
  stopBits: 1,
  defaultAddress: 1,
} as const satisfies DefaultSerialConfig

/**
 * One request reads one block of input registers.
 * The realtime block covers 0x00-0x37 in one request (56 registers).
 */
interface Block {
  address: number
  count: number
}

const REALTIME: Block = { address: 0x00, count: 56 }
const ACTIVE_ENERGY: Block = { address: 0x100, count: 2 }
const REACTIVE_ENERGY: Block = { address: 0x400, count: 2 }

interface Register {
  block: Block
  /** Input register address */
  register: number
  point: DataPoint
}

function floatPoint(
  id: string,
  name: string,
  unit: DataPoint['unit'],
  decimals: number,
  description: string
): DataPoint {
  return { id, name, type: 'float', ...(unit && { unit }), access: 'r', description, decimals }
}

const phases = ['l1', 'l2', 'l3'] as const

/** Three data points for the phases, 2 registers apart, starting at `first` */
function perPhase(
  block: Block,
  first: number,
  idPrefix: string,
  namePrefix: string,
  unit: DataPoint['unit'],
  decimals: number
): Register[] {
  return phases.map((phase, i) => ({
    block,
    register: first + i * 2,
    point: floatPoint(
      `${idPrefix}_${phase}`,
      `${phase.toUpperCase()} ${namePrefix}`,
      unit,
      decimals,
      `Phase ${phase.toUpperCase()} ${namePrefix.toLowerCase()}`
    ),
  }))
}

const REGISTERS: ReadonlyArray<Register> = [
  ...perPhase(REALTIME, 0x00, 'voltage', 'Voltage', 'V', 1),
  ...perPhase(REALTIME, 0x08, 'current', 'Current', 'A', 3),
  {
    block: REALTIME,
    register: 0x10,
    point: floatPoint('active_power_total', 'Total Active Power', 'W', 1, 'Total active power'),
  },
  ...perPhase(REALTIME, 0x12, 'active_power', 'Active Power', 'W', 1),
  {
    block: REALTIME,
    register: 0x18,
    point: floatPoint(
      'reactive_power_total',
      'Total Reactive Power',
      'VAr',
      1,
      'Total reactive power'
    ),
  },
  ...perPhase(REALTIME, 0x1a, 'reactive_power', 'Reactive Power', 'VAr', 1),
  ...perPhase(REALTIME, 0x2a, 'power_factor', 'Power Factor', undefined, 3),
  {
    block: REALTIME,
    register: 0x36,
    point: floatPoint('frequency', 'Grid Frequency', 'Hz', 2, 'Grid frequency'),
  },
  {
    block: ACTIVE_ENERGY,
    register: 0x100,
    point: floatPoint(
      'active_energy_total',
      'Total Active Energy',
      'kWh',
      2,
      'Total active energy'
    ),
  },
  {
    block: REACTIVE_ENERGY,
    register: 0x400,
    point: floatPoint(
      'reactive_energy_total',
      'Total Reactive Energy',
      'kVArh',
      2,
      'Total reactive energy'
    ),
  },
]

const DATA_POINTS: ReadonlyArray<DataPoint> = REGISTERS.map((r) => r.point)

const REGISTER_BY_ID = new Map(REGISTERS.map((r) => [r.point.id, r]))

/**
 * Create DDS024MR device driver
 */
export const createDriver: CreateDriverFunction = (config: DriverConfig) => {
  const { transport } = config

  /** Read each needed block once and decode the requested ids */
  async function read(ids: string[]): Promise<Record<string, unknown>> {
    const unknown = ids.filter((id) => !REGISTER_BY_ID.has(id))
    if (unknown.length > 0) {
      throw new Error(`Unknown data points: ${unknown.join(', ')}`)
    }

    const wanted = ids.map((id) => REGISTER_BY_ID.get(id) as Register)
    const blocks = new Set(wanted.map((r) => r.block))
    const buffers = new Map<Block, Buffer>()
    for (const block of blocks) {
      buffers.set(block, await transport.readInputRegisters(block.address, block.count))
    }

    const result: Record<string, unknown> = {}
    for (const { block, register, point } of wanted) {
      result[point.id] = readFloatBE(buffers.get(block) as Buffer, (register - block.address) * 2)
    }
    return result
  }

  const driver: DeviceDriver = {
    name: 'DDS024MR',
    manufacturer: 'Sinotimer',
    model: 'DDS024MR',
    dataPoints: DATA_POINTS,

    async readDataPoint(id: string): Promise<unknown> {
      if (!REGISTER_BY_ID.has(id)) {
        throw new Error(`Unknown data point: ${id}`)
      }
      return (await read([id]))[id]
    },

    writeDataPoint(id: string): Promise<void> {
      return Promise.reject(new Error(`Data point ${id} is read-only`))
    },

    readDataPoints: read,
  }

  return Promise.resolve(driver)
}

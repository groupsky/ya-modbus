/**
 * Data points of the Aspar MOD-16RO and where each one lives.
 *
 * Registers come from the Aspar user manual of the module, version 1.6. Our own copy of the
 * list is in `docs/register-map.md`.
 *
 * The manual swaps the usual Modbus names: it reads registers 0x00-0x01 with function code 03
 * and all other registers with function code 04. The old homy reader does the same on the
 * real modules, so the driver does too.
 */

import type { DataPoint, PollType } from '@ya-modbus/driver-types'

/** One read request */
export interface Block {
  /** 3 = read holding registers, 4 = read input registers */
  functionCode: 3 | 4
  address: number
  count: number
}

/** Version and type, DIP switches (0x00-0x01), function code 03 */
const IDENTITY: Block = { functionCode: 3, address: 0x00, count: 2 }
/** Serial settings, watchdog and default output state (0x02-0x0C), function code 04 */
const SETTINGS: Block = { functionCode: 4, address: 0x02, count: 11 }
/** Packet counters (0x20-0x25), function code 04 */
const COUNTERS: Block = { functionCode: 4, address: 0x20, count: 6 }
/** Output states (0x33), function code 04 */
const OUTPUTS: Block = { functionCode: 4, address: 0x33, count: 1 }

/** Number of relay outputs */
export const OUTPUT_COUNT = 16

/** Coil of output 1. Coil 0x330 + n is bit n of register 0x33. */
const FIRST_OUTPUT_COIL = 0x330

export interface Register {
  block: Block
  point: DataPoint
  /** Value from the buffer of the block */
  decode: (buffer: Buffer) => unknown
  /** Coil that writes this data point (function code 05) */
  coil?: number
}

const offset = (block: Block, address: number): number => (address - block.address) * 2

const uint16 =
  (block: Block, address: number) =>
  (buffer: Buffer): number =>
    buffer.readUInt16BE(offset(block, address))

const highByte =
  (block: Block, address: number) =>
  (buffer: Buffer): number =>
    buffer.readUInt8(offset(block, address))

const lowByte =
  (block: Block, address: number) =>
  (buffer: Buffer): number =>
    buffer.readUInt8(offset(block, address) + 1)

/** Unsigned 32-bit value, low word first */
const uint32LowFirst =
  (block: Block, address: number) =>
  (buffer: Buffer): number => {
    const start = offset(block, address)
    return buffer.readUInt16BE(start) + buffer.readUInt16BE(start + 2) * 0x10000
  }

/** A code from a table, or null for a code that is not in the table */
const code =
  <T>(block: Block, address: number, table: Record<number, T>) =>
  (buffer: Buffer): T | null =>
    table[buffer.readUInt16BE(offset(block, address))] ?? null

const BAUD_RATES: Record<number, number> = {
  0: 2400,
  1: 4800,
  2: 9600,
  3: 19200,
  4: 38400,
  5: 57600,
  6: 115200,
}

/** Baud rate code 0-6, any other value is the baud rate divided by 10 */
const baudRate =
  (block: Block, address: number) =>
  (buffer: Buffer): number => {
    const value = buffer.readUInt16BE(offset(block, address))
    return BAUD_RATES[value] ?? value * 10
  }

const PARITIES: Record<number, string> = {
  0: 'none',
  1: 'odd',
  2: 'even',
  3: 'mark',
  4: 'space',
}

const MODBUS_MODES: Record<number, string> = { 0: 'RTU', 1: 'ASCII' }

interface Options {
  name: string
  description: string
  decimals?: number
  pollType?: PollType
  enumValues?: Record<string | number, string>
}

function point(
  id: string,
  type: DataPoint['type'],
  block: Block,
  decode: Register['decode'],
  options: Options
): Register {
  return { block, decode, point: { id, type, access: 'r', ...options } }
}

/** Settings and identity are read once, when the bridge starts */
const once = { pollType: 'static' } as const

/** Output 1-16: bit 0-15 of register 0x33, written with coil 0x330-0x33F */
function output(n: number): Register {
  const bit = n - 1
  return {
    block: OUTPUTS,
    decode: (buffer) => ((buffer.readUInt16BE(0) >> bit) & 1) === 1,
    coil: FIRST_OUTPUT_COIL + bit,
    point: {
      id: `output_${n}`,
      type: 'boolean',
      access: 'rw',
      name: `Output ${n}`,
      description: `Relay output ${n}: true = on (closed), false = off`,
    },
  }
}

export const REGISTERS: ReadonlyArray<Register> = [
  // -------------------------------------------------------------------------
  // Identity (0x00-0x01), function code 03
  // -------------------------------------------------------------------------
  point('firmware_version', 'float', IDENTITY, (b) => highByte(IDENTITY, 0x00)(b) / 10, {
    name: 'Firmware Version',
    description: 'Firmware version, from the high byte of register 0x00 divided by 10',
    decimals: 1,
    ...once,
  }),
  point('module_type', 'integer', IDENTITY, lowByte(IDENTITY, 0x00), {
    name: 'Module Type',
    description: 'Aspar module type code, from the low byte of register 0x00. MOD-16RO is 7',
    ...once,
  }),
  point('switches', 'integer', IDENTITY, uint16(IDENTITY, 0x01), {
    name: 'Switches',
    description: 'State of the DIP switches, as the raw register value',
    ...once,
  }),

  // -------------------------------------------------------------------------
  // Settings (0x02-0x0C), function code 04
  // -------------------------------------------------------------------------
  point('baud_rate', 'integer', SETTINGS, baudRate(SETTINGS, 0x02), {
    name: 'Baud Rate',
    description: 'Serial baud rate',
    ...once,
  }),
  point('data_bits', 'integer', SETTINGS, highByte(SETTINGS, 0x03), {
    name: 'Data Bits',
    description: 'Serial data bits, 7 or 8, from the high byte of register 0x03',
    ...once,
  }),
  point('stop_bits', 'integer', SETTINGS, lowByte(SETTINGS, 0x03), {
    name: 'Stop Bits',
    description: 'Serial stop bits, 1 or 2, from the low byte of register 0x03',
    ...once,
  }),
  point('parity', 'enum', SETTINGS, code(SETTINGS, 0x04, PARITIES), {
    name: 'Parity',
    description: 'Serial parity',
    enumValues: {
      none: 'No parity',
      odd: 'Odd parity',
      even: 'Even parity',
      mark: 'Parity bit always 1',
      space: 'Parity bit always 0',
    },
    ...once,
  }),
  point('response_delay_ms', 'integer', SETTINGS, uint16(SETTINGS, 0x05), {
    name: 'Response Delay',
    description: 'Wait before the module answers, in milliseconds',
    ...once,
  }),
  point('modbus_mode', 'enum', SETTINGS, code(SETTINGS, 0x06, MODBUS_MODES), {
    name: 'Modbus Mode',
    description: 'Modbus framing on the serial line',
    enumValues: { RTU: 'Modbus RTU', ASCII: 'Modbus ASCII' },
    ...once,
  }),
  point('watchdog_ms', 'integer', SETTINGS, uint16(SETTINGS, 0x08), {
    name: 'Watchdog',
    description:
      'Milliseconds without a valid message before all outputs go to their default state; 0 = off',
    ...once,
  }),
  point('default_output_state', 'integer', SETTINGS, uint16(SETTINGS, 0x0c), {
    name: 'Default Output State',
    description: 'Output states after power on or a watchdog reset, bit 0 = output 1',
    ...once,
  }),

  // -------------------------------------------------------------------------
  // Packet counters (0x20-0x25), function code 04
  // -------------------------------------------------------------------------
  point('received_packets', 'integer', COUNTERS, uint32LowFirst(COUNTERS, 0x20), {
    name: 'Received Packets',
    description: 'Number of packets the module received',
  }),
  point('incorrect_packets', 'integer', COUNTERS, uint32LowFirst(COUNTERS, 0x22), {
    name: 'Incorrect Packets',
    description: 'Number of received packets with an error',
  }),
  point('sent_packets', 'integer', COUNTERS, uint32LowFirst(COUNTERS, 0x24), {
    name: 'Sent Packets',
    description: 'Number of packets the module sent',
  }),

  // -------------------------------------------------------------------------
  // Outputs (0x33), function code 04
  // -------------------------------------------------------------------------
  point('outputs', 'integer', OUTPUTS, uint16(OUTPUTS, 0x33), {
    name: 'Outputs',
    description: 'States of all 16 outputs, bit 0 = output 1',
  }),
  ...Array.from({ length: OUTPUT_COUNT }, (_, i) => output(i + 1)),
]

/**
 * Data point table of the Autonics TF3
 *
 * Register groups ("blocks") are read whole. Every data point says which block it lives in, at
 * which register (word) of the block, and how to decode it.
 *
 * Source: the register use of the homy `autonics-tf3` reader, checked against the vendor
 * "TF3 Series User Manual for Communication" V1.1 (addresses, enums, decimal-point scaling).
 */

import type { DataPoint } from '@ya-modbus/driver-types'

/** Where a block lives: function code family, first address, register (or coil) count */
export interface Block {
  readonly table: 'input' | 'holding' | 'coil'
  readonly address: number
  readonly count: number
}

export const BLOCKS = {
  /** Measured values and the decimal-point register (word 12) */
  status: { table: 'input', address: 0x03e8, count: 13 },
  coils: { table: 'coil', address: 0x0000, count: 2 },
  info: { table: 'input', address: 0x0064, count: 14 },
  /** Input and display setup (parameter group 1) */
  input: { table: 'holding', address: 0x0064, count: 12 },
  /** Control and compressor setup (parameter group 2) */
  control: { table: 'holding', address: 0x0096, count: 22 },
  /** Defrost setup (parameter group 3) */
  defrost: { table: 'holding', address: 0x00c8, count: 2 },
} as const satisfies Record<string, Block>

export type BlockName = keyof typeof BLOCKS

/** Word of the decimal-point register in the status block */
export const DIVISOR_WORD = 12

export type Kind =
  /** Signed 16 bit temperature, divided by the decimal-point scale */
  | 'temp'
  /** Unsigned 16 bit temperature difference, divided by the decimal-point scale */
  | 'temp_unsigned'
  /** Unsigned 16 bit integer */
  | 'uint16'
  /** Unsigned 16 bit, in tenths */
  | 'tenths'
  /** Unsigned 16 bit number that is one of the data point's enum values */
  | 'enum'
  /** Register that is 0 or 1 */
  | 'flag'
  /** A coil, one bit */
  | 'coil'
  /** The decimal-point register: 0 means scale 1, 1 means scale 10 */
  | 'divisor'
  /** Two registers, high word first */
  | 'uint32'
  /** ASCII text, two characters per register */
  | 'text'

export interface PointSpec {
  readonly point: DataPoint
  readonly block: BlockName
  /** Register (or coil) number inside the block */
  readonly word: number
  readonly kind: Kind
  /** Registers used by the value, for 'uint32' and 'text' (default 1) */
  readonly words?: number
  /** Address to write to. Absent when the point is read-only. */
  readonly writeAddress?: number
}

const CELSIUS_FAHRENHEIT = { 0: 'celsius', 1: 'fahrenheit' }
const TEMP_UNIT_NOTE = "in the controller's temperature unit"

const temp = (
  id: string,
  name: string,
  block: BlockName,
  word: number,
  extra: { writeAddress?: number; description?: string; unsigned?: boolean } = {}
): PointSpec => ({
  point: {
    id,
    name,
    type: 'float',
    access: extra.writeAddress === undefined ? 'r' : 'rw',
    description: `${extra.description ?? name}, ${TEMP_UNIT_NOTE}`,
  },
  block,
  word,
  kind: extra.unsigned ? 'temp_unsigned' : 'temp',
  ...(extra.writeAddress === undefined ? {} : { writeAddress: extra.writeAddress }),
})

const count = (
  id: string,
  name: string,
  block: BlockName,
  word: number,
  writeAddress?: number,
  description?: string
): PointSpec => ({
  point: {
    id,
    name,
    type: 'integer',
    access: writeAddress === undefined ? 'r' : 'rw',
    ...(description === undefined ? {} : { description }),
  },
  block,
  word,
  kind: 'uint16',
  ...(writeAddress === undefined ? {} : { writeAddress }),
})

const choice = (
  id: string,
  name: string,
  block: BlockName,
  word: number,
  enumValues: Record<number, string>,
  writeAddress?: number
): PointSpec => ({
  point: {
    id,
    name,
    type: 'enum',
    access: writeAddress === undefined ? 'r' : 'rw',
    enumValues,
  },
  block,
  word,
  kind: 'enum',
  ...(writeAddress === undefined ? {} : { writeAddress }),
})

const flag = (id: string, name: string, block: BlockName, word: number): PointSpec => ({
  point: { id, name, type: 'boolean', access: 'r' },
  block,
  word,
  kind: 'flag',
})

const coil = (id: string, name: string, word: number): PointSpec => ({
  point: { id, name, type: 'boolean', access: 'rw' },
  block: 'coils',
  word,
  kind: 'coil',
  writeAddress: word,
})

const info = (
  id: string,
  name: string,
  word: number,
  kind: 'uint16' | 'uint32' | 'text',
  words = 1
): PointSpec => ({
  point: {
    id,
    name,
    type: kind === 'text' ? 'string' : 'integer',
    access: 'r',
    pollType: 'static',
  },
  block: 'info',
  word,
  kind,
  words,
})

export const POINT_SPECS: ReadonlyArray<PointSpec> = [
  // Measured values (input registers 0x03E8..)
  temp('current_temp', 'Current Temperature', 'status', 0),
  temp('target_temp', 'Target Temperature', 'status', 1, {
    writeAddress: 0x0000,
    description: 'Target temperature (set point)',
  }),
  choice('temperature_unit', 'Temperature Unit', 'status', 3, CELSIUS_FAHRENHEIT),
  count('inputs', 'Inputs', 'status', 7, undefined, 'Raw bit word of the inputs'),
  temp('s1_temp', 'Sensor 1 Temperature', 'status', 8),
  temp('s2_temp', 'Sensor 2 Temperature', 'status', 9),
  temp('s3_temp', 'Sensor 3 Temperature', 'status', 10),
  temp('virtual_temp', 'Virtual Temperature', 'status', 11),
  {
    point: {
      id: 'temp_divisor',
      name: 'Temperature Divisor',
      type: 'integer',
      access: 'r',
      description: 'Scale of the temperatures: 1 (no decimals) or 10 (one decimal)',
    },
    block: 'status',
    word: DIVISOR_WORD,
    kind: 'divisor',
  },

  // Outputs (coils)
  coil('aux_enabled', 'Auxiliary Output Enabled', 0),
  coil('comp_enabled', 'Compressor Enabled', 1),

  // Device information (input registers 0x0064..)
  info('product_number', 'Product Number', 0, 'uint32', 2),
  info('hardware_version', 'Hardware Version', 2, 'uint16'),
  info('software_version', 'Software Version', 3, 'uint16'),
  info('model', 'Model', 4, 'text', 10),

  // Input and display setup (holding registers 0x0064..)
  choice('input_type', 'Input Type', 'input', 0, {
    0: 'ntc5k-1',
    1: 'ntc5k-0.1',
    2: 'ntc10k-1',
    3: 'ntc10k-0.1',
    4: 'dpt100-1',
    5: 'dpt100-0.1',
  }),
  flag('input2_enabled', 'Input 2 Enabled', 'input', 1),
  choice('input3_type', 'Input 3 Type', 'input', 2, { 0: 'di', 1: 'temp' }),
  count('virtual_temp_rate', 'Virtual Temperature Rate', 'input', 3, 0x0067),
  choice('temperature_unit_setting', 'Temperature Unit Setting', 'input', 4, CELSIUS_FAHRENHEIT),
  temp('input1_correction', 'Input 1 Correction', 'input', 5, { writeAddress: 0x0069 }),
  temp('input2_correction', 'Input 2 Correction', 'input', 6, { writeAddress: 0x006a }),
  temp('input3_correction', 'Input 3 Correction', 'input', 7, { writeAddress: 0x006b }),
  {
    point: { id: 'display_delay', name: 'Display Delay', type: 'float', access: 'r' },
    block: 'input',
    word: 8,
    kind: 'tenths',
  },
  choice('def_aux_output', 'Defrost or Auxiliary Output', 'input', 9, { 0: 'def', 1: 'aux' }),
  choice('aux_output', 'Auxiliary Output Use', 'input', 10, { 0: 'off', 1: 'fan', 2: 'alarm' }),
  flag('buzzer', 'Buzzer', 'input', 11),

  // Control and compressor setup (holding registers 0x0096..)
  choice('mode', 'Mode', 'control', 0, { 0: 'cooling', 1: 'heating' }, 0x0096),
  temp('hysteresis', 'Hysteresis', 'control', 1, { writeAddress: 0x0097, unsigned: true }),
  temp('offset', 'Offset', 'control', 2, { writeAddress: 0x0098, unsigned: true }),
  temp('high_temp_limit', 'High Temperature Limit', 'control', 3, { writeAddress: 0x0099 }),
  temp('low_temp_limit', 'Low Temperature Limit', 'control', 4, { writeAddress: 0x009a }),
  count('compressor_startup_delay', 'Compressor Startup Delay', 'control', 14, 0x00a4),
  count('compressor_min_cycle_time', 'Compressor Minimum Cycle Time', 'control', 15, 0x00a5),
  count('compressor_restart_delay', 'Compressor Restart Delay', 'control', 16, 0x00a6),
  count('compressor_min_run_time', 'Compressor Minimum Run Time', 'control', 17, 0x00a7),
  count(
    'compressor_continuous_operation',
    'Compressor Continuous Operation',
    'control',
    18,
    0x00a8
  ),
  count(
    'alarm_delay_after_continuous_operation',
    'Alarm Delay After Continuous Operation',
    'control',
    19
  ),
  count(
    'compressor_operation_cycle_when_sensor_break',
    'Compressor Operation Cycle When Sensor Is Broken',
    'control',
    20
  ),
  count(
    'compressor_duty_rate_when_sensor_break',
    'Compressor Duty Rate When Sensor Is Broken',
    'control',
    21
  ),

  // Defrost setup (holding registers 0x00C8..)
  choice(
    'defrost_method',
    'Defrost Method',
    'defrost',
    0,
    { 0: 'heater_time', 1: 'hotgas_time', 2: 'heater_temperature', 3: 'hotgas_temperature' },
    0x00c8
  ),
  count('defrost_cycle', 'Defrost Cycle', 'defrost', 1, 0x00c9),
]

export const DATA_POINTS: ReadonlyArray<DataPoint> = POINT_SPECS.map((spec) => spec.point)

export const SPEC_BY_ID: ReadonlyMap<string, PointSpec> = new Map(
  POINT_SPECS.map((spec) => [spec.point.id, spec])
)

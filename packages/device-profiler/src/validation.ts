/**
 * Validation of command-line options
 */

import { InvalidArgumentError } from 'commander'

import {
  MAX_BATCH_SIZE,
  MAX_REGISTER_ADDRESS,
  MAX_SLAVE_ID,
  MAX_TIMEOUT_MS,
  MIN_BATCH_SIZE,
  MIN_REGISTER_ADDRESS,
  MIN_SLAVE_ID,
  MIN_TIMEOUT_MS,
} from './constants.js'

/**
 * Numeric options that must be valid before a scan starts
 */
export interface ProfileOptions {
  slaveId: number
  start: number
  end: number
  batch: number
  baud: number
  timeout: number
}

/**
 * Parse a whole number from a command-line value
 *
 * Rejects decimals and text mixed with digits, which `parseInt` would accept silently.
 *
 * @param value - Raw command-line value
 * @throws InvalidArgumentError if the value is not a whole number
 */
export function parseInteger(value: string): number {
  if (!/^-?\d+$/.test(value)) {
    throw new InvalidArgumentError('Expected a whole number.')
  }
  return parseInt(value, 10)
}

function assertInRange(label: string, value: number, min: number, max: number, note = ''): void {
  if (value < min || value > max) {
    throw new Error(`Invalid ${label}: ${value}. Must be between ${min} and ${max}${note}`)
  }
}

function assertPositive(label: string, value: number): void {
  if (value <= 0) {
    throw new Error(`Invalid ${label}: ${value}. Must be greater than 0`)
  }
}

/**
 * Validate option values and their relations
 *
 * @param options - Parsed command-line options
 * @throws Error with a message that names the invalid option and the allowed values
 */
export function validateOptions(options: ProfileOptions): void {
  assertInRange('slave ID', options.slaveId, MIN_SLAVE_ID, MAX_SLAVE_ID, ' (Modbus specification)')
  assertInRange('start address', options.start, MIN_REGISTER_ADDRESS, MAX_REGISTER_ADDRESS)
  assertInRange('end address', options.end, MIN_REGISTER_ADDRESS, MAX_REGISTER_ADDRESS)
  if (options.start > options.end) {
    throw new Error(
      `Invalid address range: start (${options.start}) is greater than end (${options.end})`
    )
  }
  assertInRange(
    'batch size',
    options.batch,
    MIN_BATCH_SIZE,
    MAX_BATCH_SIZE,
    ' (Modbus limit for one read)'
  )
  assertInRange('timeout', options.timeout, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS, ' milliseconds')
  assertPositive('baud rate', options.baud)
}

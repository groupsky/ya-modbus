/**
 * Read testing utilities for Modbus registers
 */

import type { Transport } from '@ya-modbus/driver-types'

import { classifyError, ErrorType } from './error-classifier.js'

/**
 * Modbus register type
 */
export enum RegisterType {
  /** Holding registers (FC03) */
  Holding = 'holding',
  /** Input registers (FC04) */
  Input = 'input',
}

/**
 * Result of a register read test
 */
export interface ReadTestResult {
  /** Whether the read was successful */
  success: boolean
  /** Register data if successful */
  data?: Buffer
  /** Time taken for the read operation in milliseconds */
  timing: number
  /** Error message if failed */
  error?: string
  /** Classified error type if failed */
  errorType?: ErrorType
}

/**
 * Test reading a register with timing measurement
 *
 * @param transport - Modbus transport
 * @param type - Register type (holding or input)
 * @param address - Starting register address
 * @param count - Number of registers to read
 * @returns Read test result with timing information
 */
export async function testRead(
  transport: Transport,
  type: RegisterType,
  address: number,
  count: number
): Promise<ReadTestResult> {
  const startTime = performance.now()

  try {
    let data: Buffer
    if (type === RegisterType.Holding) {
      data = await transport.readHoldingRegisters(address, count)
    } else {
      data = await transport.readInputRegisters(address, count)
    }

    const timing = performance.now() - startTime

    return {
      success: true,
      data,
      timing,
    }
  } catch (err) {
    const timing = performance.now() - startTime
    const error = err instanceof Error ? err : new Error(String(err))

    return {
      success: false,
      timing,
      error: error.message,
      errorType: classifyError(error),
    }
  }
}

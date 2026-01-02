/**
 * Timing behavior simulation
 */

import type { TimingBehavior } from '../types/config.js'

/**
 * Calculate a delay value from a fixed number or random range
 */
export function calculateDelay(delay: number | [number, number] | undefined): number {
  if (delay === undefined) {
    return 0
  }

  if (typeof delay === 'number') {
    return delay
  }

  // Random value in range [min, max]
  const [min, max] = delay
  return min + Math.random() * (max - min)
}

/**
 * Calculate transmission delay based on baud rate and frame size
 * Formula: (frameBytes * 11 bits per byte) / (baudRate / 1000)
 */
export function calculateTransmissionDelay(frameBytes: number, baudRate: number): number {
  // Each byte requires 11 bits (1 start + 8 data + 1 parity + 1 stop)
  const totalBits = frameBytes * 11
  // Convert baud rate to bits per millisecond
  const bitsPerMs = baudRate / 1000
  return totalBits / bitsPerMs
}

/**
 * Thin abstraction over setTimeout for dependency injection
 */
export interface DelayFunction {
  (ms: number): Promise<void>
}

/**
 * Default delay implementation using setTimeout
 */
export const defaultDelay: DelayFunction = (ms: number): Promise<void> => {
  if (ms <= 0) {
    return Promise.resolve()
  }
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Timing simulator that calculates and applies realistic device delays
 */
export class TimingSimulator {
  private config: TimingBehavior
  private delayFn: DelayFunction

  constructor(config: TimingBehavior, delayFn: DelayFunction = defaultDelay) {
    this.config = config
    this.delayFn = delayFn
  }

  /**
   * Calculate total delay for a request
   * @param request - The Modbus request buffer
   * @param registerCount - Number of registers being accessed
   * @returns Total delay in milliseconds
   */
  calculateTotalDelay(request: Buffer, registerCount: number): number {
    let totalDelay = 0

    // 1. Command detection delay (or random value in [0, pollingInterval])
    if (this.config.commandDetectionDelay !== undefined) {
      totalDelay += calculateDelay(this.config.commandDetectionDelay)
    } else if (this.config.pollingInterval !== undefined) {
      // Use random value in range [0, pollingInterval] as detection time
      totalDelay += calculateDelay([0, this.config.pollingInterval])
    }

    // 2. Processing delay
    if (this.config.processingDelay !== undefined) {
      totalDelay += calculateDelay(this.config.processingDelay)
    }

    // 3. Per-register delay
    if (this.config.perRegisterDelay !== undefined) {
      totalDelay += registerCount * this.config.perRegisterDelay
    }

    // 4. Transmission delay (RTU only, when enabled)
    if (this.config.autoCalculateTransmissionDelay && this.config.baudRate !== undefined) {
      const frameSize = request.length
      totalDelay += calculateTransmissionDelay(frameSize, this.config.baudRate)
    }

    return totalDelay
  }

  /**
   * Apply timing delay for a request
   * @param request - The Modbus request buffer
   * @param registerCount - Number of registers being accessed
   * @returns Promise that resolves after the calculated delay
   */
  async delay(request: Buffer, registerCount: number): Promise<void> {
    const delayMs = this.calculateTotalDelay(request, registerCount)
    return this.delayFn(delayMs)
  }
}

/**
 * Auto-mock for process utilities
 * Used in tests via jest.mock('./utils/process.js')
 */

import { jest, beforeEach } from '@jest/globals'

import type { ProcessUtils } from '../process.js'

/**
 * Map of registered signal handlers
 * Populated by onSignal mock implementation
 * Automatically cleared before each test
 */
export const signalHandlers = new Map<string, () => void>()

/**
 * Trigger a signal handler that was registered via onSignal
 *
 * @param signal - The signal to trigger (e.g., 'SIGINT', 'SIGTERM')
 * @returns true if handler was found and called, false otherwise
 */
export function triggerSignal(signal: string): boolean {
  const handler = signalHandlers.get(signal)
  if (handler) {
    handler()
    return true
  }
  return false
}

// Automatically reset signal handlers before each test
// This ensures test isolation without requiring explicit cleanup
beforeEach(() => {
  signalHandlers.clear()
})

export const processUtils: ProcessUtils = {
  exit: jest.fn(),
  onSignal: jest.fn((signal: NodeJS.Signals, handler: () => void) => {
    signalHandlers.set(signal, handler)
  }),
}

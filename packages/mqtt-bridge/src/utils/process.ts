/**
 * Process utilities for signal handling and exit
 * Extracted to separate module for testability
 */

export interface ProcessUtils {
  exit(code: number): void
  onSignal(signal: NodeJS.Signals, handler: () => void): void
}

export const processUtils: ProcessUtils = {
  exit(code: number): void {
    process.exit(code)
  },

  onSignal(signal: NodeJS.Signals, handler: () => void): void {
    process.on(signal, handler)
  },
}

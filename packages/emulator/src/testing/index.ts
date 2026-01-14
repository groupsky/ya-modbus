/**
 * Testing utilities for documentation examples
 *
 * Provides helpers for running code examples against the emulator.
 */

export { createClientTransport } from './client-transport.js'
export { createPtyPair, isSocatAvailable, type PtyPair } from './pty-pair.js'
export { withEmulator, type TestEmulatorConfig, type TestEmulatorContext } from './with-emulator.js'
export {
  withRtuEmulator,
  type RtuEmulatorConfig,
  type RtuEmulatorContext,
} from './with-rtu-emulator.js'

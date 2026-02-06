/**
 * @ya-modbus/emulator - Software Modbus device emulator
 */

export { ModbusEmulator } from './emulator.js'
export { EmulatedDevice } from './device.js'
export type { EmulatorConfig, DeviceConfig, RegisterStorage } from './types/config.js'
export type { EmulatedDevice as IEmulatedDevice } from './types/device.js'

// Testing utilities for documentation examples
export {
  withEmulator,
  withRtuEmulator,
  withTcpEmulator,
  createClientTransport,
  createPtyPair,
  isSocatAvailable,
  type PtyPair,
  type TestEmulatorConfig,
  type TestEmulatorContext,
  type RtuEmulatorConfig,
  type RtuEmulatorContext,
  type TcpEmulatorConfig,
  type TcpEmulatorContext,
} from './testing/index.js'

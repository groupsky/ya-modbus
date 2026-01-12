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
  createClientTransport,
  type TestEmulatorConfig,
  type TestEmulatorContext,
} from './testing/index.js'

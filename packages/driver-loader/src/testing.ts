/**
 * Test utilities for driver-loader
 *
 * Provides mock drivers and system dependencies for testing applications
 * that use driver-loader.
 */

import { jest } from '@jest/globals'

import type {
  CreateDriverFunction,
  DefaultConfig,
  DeviceRegistry,
  SupportedConfig,
} from '@ya-modbus/driver-types'

import type { LoadedDriver, SystemDependencies } from './loader.js'

/**
 * Options for creating a mock driver
 */
export interface MockDriverOptions {
  /** Custom createDriver implementation */
  createDriver?: CreateDriverFunction
  /** Mock default configuration */
  defaultConfig?: DefaultConfig
  /** Mock supported configuration */
  supportedConfig?: SupportedConfig
  /** Mock device registry */
  devices?: DeviceRegistry
}

/**
 * Create a mock driver for testing
 *
 * @param options - Mock driver options
 * @returns Mock driver that can be used with loadDriver
 *
 * @example
 * ```typescript
 * const mockDriver = createMockDriver({
 *   defaultConfig: { baudRate: 9600 },
 *   devices: { 'test': { manufacturer: 'Test', model: 'Model' } }
 * })
 * ```
 */
export function createMockDriver(options: MockDriverOptions = {}): LoadedDriver {
  const {
    createDriver = jest.fn().mockReturnValue({}) as unknown as CreateDriverFunction,
    defaultConfig,
    supportedConfig,
    devices,
  } = options

  const result: LoadedDriver = {
    createDriver,
  }

  if (defaultConfig) {
    result.defaultConfig = defaultConfig
  }

  if (supportedConfig) {
    result.supportedConfig = supportedConfig
  }

  if (devices) {
    result.devices = devices
  }

  return result
}

/**
 * Options for creating mock system dependencies
 */
export interface MockSystemDepsOptions {
  /** Custom readFile implementation */
  readFile?: SystemDependencies['readFile']
  /** Custom importModule implementation */
  importModule?: SystemDependencies['importModule']
  /** Custom getCwd implementation */
  getCwd?: SystemDependencies['getCwd']
}

/**
 * Create mock system dependencies for testing
 *
 * @param options - Mock system dependencies options
 * @returns Mock SystemDependencies that can be passed to loadDriver
 *
 * @example
 * ```typescript
 * const deps = mockSystemDeps({
 *   importModule: jest.fn().mockResolvedValue(mockDriver)
 * })
 *
 * const driver = await loadDriver({ driverPackage: 'test' }, deps)
 * ```
 */
export function mockSystemDeps(options: MockSystemDepsOptions = {}): SystemDependencies {
  const { readFile, importModule, getCwd } = options

  return {
    readFile:
      readFile ??
      (jest
        .fn<SystemDependencies['readFile']>()
        .mockResolvedValue('{}') as SystemDependencies['readFile']),
    importModule:
      importModule ??
      (jest
        .fn<SystemDependencies['importModule']>()
        .mockResolvedValue(createMockDriver()) as SystemDependencies['importModule']),
    getCwd:
      getCwd ??
      (jest
        .fn<SystemDependencies['getCwd']>()
        .mockReturnValue('/mock/cwd') as SystemDependencies['getCwd']),
  }
}

/**
 * Test utilities for @ya-modbus/driver-loader
 *
 * Import from '@ya-modbus/driver-loader/testing' in your tests
 *
 * @example
 * ```typescript
 * import { createMockDriver, mockSystemDeps } from '@ya-modbus/driver-loader/testing'
 *
 * const mockDriver = createMockDriver({
 *   defaultConfig: { baudRate: 9600 }
 * })
 *
 * const deps = mockSystemDeps({
 *   importModule: jest.fn().mockResolvedValue(mockDriver)
 * })
 * ```
 */

export { createMockDriver, mockSystemDeps } from '../testing.js'
export type { MockDriverOptions, MockSystemDepsOptions } from '../testing.js'

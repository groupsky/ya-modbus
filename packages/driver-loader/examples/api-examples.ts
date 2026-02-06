/**
 * API examples for documentation purposes.
 * This file demonstrates how to use the functions exported by @ya-modbus/driver-loader.
 */

import {
  clearDriverCache,
  DriverNotFoundError,
  getDriverCacheStats,
  loadDriver,
  PackageJsonError,
  ValidationError,
  type Logger,
} from '@ya-modbus/driver-loader'

// Auto-detect driver from current directory
export async function autoDetectExample(): Promise<void> {
  const driver = await loadDriver({})
  console.log('Loaded driver:', driver)
}

// Load specific driver package
export async function loadSpecificExample(): Promise<void> {
  const driver = await loadDriver({ driverPackage: '@ya-modbus/driver-xymd1' })
  console.log('Loaded driver:', driver)
}

// Error Handling example
export async function errorHandlingExample(): Promise<void> {
  try {
    const driver = await loadDriver({ driverPackage: 'my-driver' })
    console.log('Loaded driver:', driver)
  } catch (error) {
    // Type-safe error handling with instanceof
    if (error instanceof DriverNotFoundError) {
      console.error(`Package not found: ${error.packageName}`)
      console.error(`Install with: npm install ${error.packageName}`)
    } else if (error instanceof ValidationError) {
      console.error(`Validation failed for field: ${error.field ?? 'unknown'}`)
      console.error(`Error: ${error.message}`)
    } else if (error instanceof PackageJsonError) {
      console.error('package.json issue:', error.message)
    } else {
      console.error('Unexpected error:', error)
    }
  }
}

// Custom Logging example
export async function customLoggingExample(): Promise<void> {
  const myLogger = {
    warning: (prefix: string, msg: string) => console.warn(prefix, msg),
    debug: (prefix: string, msg: string) => console.debug(prefix, msg),
  }

  const logger: Logger = {
    warn: (msg) => myLogger.warning('[DRIVER]', msg),
    debug: (msg) => myLogger.debug('[DRIVER]', msg), // Optional
  }

  const driver = await loadDriver({
    driverPackage: 'my-driver',
    logger,
  })
  console.log('Loaded driver:', driver)
}

// clearDriverCache usage example
export function clearCacheExample(): void {
  // In test setup
  clearDriverCache() // Ensure each test starts with clean cache

  // After updating a driver package
  // await updateDriver('my-driver')
  clearDriverCache() // Force reload on next loadDriver call
}

// getDriverCacheStats example
export async function cacheStatsExample(): Promise<void> {
  // First load - cache miss
  await loadDriver({ driverPackage: 'my-driver' })
  console.log(getDriverCacheStats()) // { hits: 0, misses: 1, size: 1 }

  // Second load - cache hit
  await loadDriver({ driverPackage: 'my-driver' })
  console.log(getDriverCacheStats()) // { hits: 1, misses: 1, size: 1 }
}

// Troubleshooting - verbose logging example
export async function verboseLoggingExample(): Promise<void> {
  const logger = {
    warn: (msg: string) => console.warn('[DRIVER]', msg),
    debug: (msg: string) => console.debug('[DRIVER]', msg),
  }
  const driver = await loadDriver({ logger })
  console.log('Loaded driver:', driver)
}

// Troubleshooting - check cache statistics
export function checkCacheExample(): void {
  console.log(getDriverCacheStats())
}

// Troubleshooting - clear the cache
export function clearCacheTroubleshoot(): void {
  clearDriverCache()
}

// Example of correct DEFAULT_CONFIG
export const DEFAULT_CONFIG_CORRECT = { baudRate: 9600 }

// Example of correct SUPPORTED_CONFIG
export const SUPPORTED_CONFIG_CORRECT = { validBaudRates: [9600, 19200] }

// Testing Utilities example - showing the mock pattern
// In actual test files, use static imports from '@ya-modbus/driver-loader/testing'
export function testingUtilitiesExample(
  createMockDriver: CreateMockDriver,
  mockSystemDeps: MockSystemDeps,
  mockFn: () => { mockResolvedValue: (v: unknown) => unknown }
): void {
  // Create a mock driver
  const mockDriver = createMockDriver({
    defaultConfig: { baudRate: 9600 },
    devices: { test: { manufacturer: 'Test', model: 'Model' } },
  })

  // Create mock system dependencies
  const deps = mockSystemDeps({
    importModule: mockFn().mockResolvedValue(mockDriver),
  })

  // Use with loadDriver in tests
  void loadDriver({ driverPackage: 'test-driver' }, deps)
}

// Type declarations for testing utilities
type CreateMockDriver = (opts: {
  defaultConfig?: { baudRate: number }
  devices?: Record<string, { manufacturer: string; model: string }>
}) => unknown
type MockSystemDeps = (opts: { importModule: unknown }) => Record<string, unknown>
// Correct createDriver export pattern
export function createDriver(): void {
  // Driver implementation
}
// Consistent configuration example
export const DEFAULT_CONFIG_CONSISTENT = { baudRate: 9600 }
export const SUPPORTED_CONFIG_CONSISTENT = { validBaudRates: [9600, 19200] }

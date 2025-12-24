import { readFile } from 'fs/promises'

import { loadDriver } from './loader.js'

jest.mock('fs/promises')

describe('Driver Loader', () => {
  const mockReadFile = readFile as jest.MockedFunction<typeof readFile>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Note: These tests verify error handling and validation logic.
  // Actual dynamic import mocking is complex in ES modules and tested via integration tests.

  test('should require either localPackage or driverPackage', async () => {
    await expect(loadDriver({})).rejects.toThrow(
      'Either localPackage or driverPackage must be specified'
    )
  })

  test('should not allow both localPackage and driverPackage', async () => {
    await expect(loadDriver({ localPackage: true, driverPackage: 'some-package' })).rejects.toThrow(
      'Cannot specify both localPackage and driverPackage'
    )
  })

  test('should throw error if package.json is missing when auto-detecting', async () => {
    const error = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException
    error.code = 'ENOENT'
    mockReadFile.mockRejectedValue(error)

    await expect(loadDriver({ localPackage: true })).rejects.toThrow('package.json not found')
  })

  test('should throw error if package.json does not have ya-modbus-driver keyword', async () => {
    const packageJson = {
      name: 'some-other-package',
      version: '1.0.0',
      keywords: ['other'],
    }

    mockReadFile.mockResolvedValue(JSON.stringify(packageJson))

    await expect(loadDriver({ localPackage: true })).rejects.toThrow(
      'Current package is not a ya-modbus driver'
    )
  })

  // Note: Tests that require dynamic import mocking are skipped.
  // These scenarios are covered by integration tests with real driver packages.
  //
  // Skipped scenarios:
  // - Loading driver from explicit package name
  // - Loading driver from local package
  // - Fallback from src to dist
  // - Validation of createDriver export
  //
  // These require complex mocking of ES module dynamic imports which is not
  // reliable in the Jest test environment. The functionality is tested via
  // integration tests with actual driver packages like @ya-modbus/driver-xymd1.
})

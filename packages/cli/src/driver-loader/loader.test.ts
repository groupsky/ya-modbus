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

  test('should throw error if package.json does not have a name field', async () => {
    const packageJson = {
      version: '1.0.0',
      keywords: ['ya-modbus-driver'],
    }

    mockReadFile.mockResolvedValue(JSON.stringify(packageJson))

    await expect(loadDriver({ localPackage: true })).rejects.toThrow(
      'package.json must have a "name" field'
    )
  })

  test('should load driver from explicit package name', async () => {
    // Use real package that exists in node_modules
    const driverMetadata = await loadDriver({ driverPackage: 'ya-modbus-driver-xymd1' })

    expect(driverMetadata).toBeDefined()
    expect(driverMetadata.createDriver).toBeDefined()
    expect(typeof driverMetadata.createDriver).toBe('function')
    // XYMD1 should export DEFAULT_CONFIG and SUPPORTED_CONFIG
    expect(driverMetadata.defaultConfig).toBeDefined()
    expect(driverMetadata.supportedConfig).toBeDefined()
    // XYMD1 is a single-device driver, so devices should be undefined
    expect(driverMetadata.devices).toBeUndefined()
  })

  test('should throw error if explicit package does not exist', async () => {
    await expect(loadDriver({ driverPackage: 'nonexistent-driver-package-xyz' })).rejects.toThrow(
      'Driver package not found'
    )
  })

  test('should throw error if package does not export createDriver', async () => {
    // Try to load a package that exists but doesn't export createDriver
    await expect(loadDriver({ driverPackage: 'modbus-serial' })).rejects.toThrow(
      'Driver package must export a createDriver function'
    )
  })

  test('should throw error if package.json has empty keywords array', async () => {
    const packageJson = {
      name: 'test-package',
      version: '1.0.0',
      keywords: [],
    }

    mockReadFile.mockResolvedValue(JSON.stringify(packageJson))

    await expect(loadDriver({ localPackage: true })).rejects.toThrow(
      'Current package is not a ya-modbus driver'
    )
  })

  test('should throw error if package.json has no keywords field', async () => {
    const packageJson = {
      name: 'test-package',
      version: '1.0.0',
    }

    mockReadFile.mockResolvedValue(JSON.stringify(packageJson))

    await expect(loadDriver({ localPackage: true })).rejects.toThrow(
      'Current package is not a ya-modbus driver'
    )
  })

  test('should throw error with JSON parse error details', async () => {
    mockReadFile.mockResolvedValue('{ invalid json')

    await expect(loadDriver({ localPackage: true })).rejects.toThrow()
  })

  // Note: Testing local package loading with dynamic imports is complex.
  // This is covered by integration tests with actual driver packages.
})

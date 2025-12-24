import { loadDriver } from './loader.js'
import { readFile } from 'fs/promises'
import { join } from 'path'

jest.mock('fs/promises')

describe('Driver Loader', () => {
  const mockReadFile = readFile as jest.MockedFunction<typeof readFile>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should load driver from explicit package name', async () => {
    const mockCreateDriver = jest.fn()
    const mockDriverModule = { createDriver: mockCreateDriver }

    // Mock dynamic import
    jest.unstable_mockModule('ya-modbus-driver-xymd1', () => mockDriverModule)

    const createDriver = await loadDriver({ driverPackage: 'ya-modbus-driver-xymd1' })

    expect(createDriver).toBe(mockCreateDriver)
  })

  test('should auto-detect local driver package in development mode', async () => {
    const packageJson = {
      name: 'ya-modbus-driver-solar',
      version: '1.0.0',
      keywords: ['ya-modbus-driver'],
      main: './dist/index.js',
    }

    mockReadFile.mockResolvedValue(JSON.stringify(packageJson))

    const mockCreateDriver = jest.fn()

    // Mock the local import - try src first
    const importSpy = jest.spyOn(global, 'import' as any).mockResolvedValue({
      createDriver: mockCreateDriver,
    })

    const createDriver = await loadDriver({ localPackage: true })

    expect(mockReadFile).toHaveBeenCalled()
    expect(createDriver).toBe(mockCreateDriver)

    importSpy.mockRestore()
  })

  test('should throw error if package.json is missing when auto-detecting', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT: no such file or directory'))

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

  test('should throw error if driver package not found', async () => {
    // Mock dynamic import to throw module not found
    jest.unstable_mockModule('non-existent-driver', () => {
      throw new Error('Cannot find module')
    })

    await expect(loadDriver({ driverPackage: 'non-existent-driver' })).rejects.toThrow(
      'Driver package not found'
    )
  })

  test('should throw error if driver package does not export createDriver', async () => {
    const mockDriverModule = { somethingElse: jest.fn() }

    jest.unstable_mockModule('invalid-driver', () => mockDriverModule)

    await expect(loadDriver({ driverPackage: 'invalid-driver' })).rejects.toThrow(
      'Driver package must export a createDriver function'
    )
  })

  test('should throw error if createDriver is not a function', async () => {
    const mockDriverModule = { createDriver: 'not-a-function' }

    jest.unstable_mockModule('invalid-driver-2', () => mockDriverModule)

    await expect(loadDriver({ driverPackage: 'invalid-driver-2' })).rejects.toThrow(
      'createDriver must be a function'
    )
  })

  test('should fallback from src to dist when loading local package', async () => {
    const packageJson = {
      name: 'ya-modbus-driver-test',
      version: '1.0.0',
      keywords: ['ya-modbus-driver'],
    }

    mockReadFile.mockResolvedValue(JSON.stringify(packageJson))

    const mockCreateDriver = jest.fn()

    // Mock import - src fails, dist succeeds
    const importSpy = jest
      .spyOn(global, 'import' as any)
      .mockRejectedValueOnce(new Error('Cannot find module'))
      .mockResolvedValueOnce({ createDriver: mockCreateDriver })

    const createDriver = await loadDriver({ localPackage: true })

    expect(createDriver).toBe(mockCreateDriver)

    importSpy.mockRestore()
  })

  test('should throw error if neither localPackage nor driverPackage is provided', async () => {
    await expect(loadDriver({})).rejects.toThrow(
      'Either localPackage or driverPackage must be specified'
    )
  })
})

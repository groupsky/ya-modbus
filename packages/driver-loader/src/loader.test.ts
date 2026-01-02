import { loadDriver } from './loader.js'
import type { SystemDependencies } from './loader.js'

describe('Driver Loader', () => {
  let mockDeps: SystemDependencies

  beforeEach(() => {
    mockDeps = {
      readFile: jest.fn(),
      importModule: jest.fn(),
      getCwd: jest.fn(() => '/fake/cwd'),
    }
  })

  describe('auto-detection mode', () => {
    test('should throw error if package.json not found', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      mockDeps.readFile = jest.fn().mockRejectedValue(error)

      await expect(loadDriver({}, mockDeps)).rejects.toThrow('package.json not found')
    })

    test('should throw error if package.json is invalid JSON', async () => {
      mockDeps.readFile = jest.fn().mockResolvedValue('{ invalid json')

      await expect(loadDriver({}, mockDeps)).rejects.toThrow('Failed to parse package.json')
    })

    test('should throw error if package.json has no name field', async () => {
      const packageJson = { version: '1.0.0', keywords: ['ya-modbus-driver'] }
      mockDeps.readFile = jest.fn().mockResolvedValue(JSON.stringify(packageJson))

      await expect(loadDriver({}, mockDeps)).rejects.toThrow(
        'package.json must have a "name" field'
      )
    })

    test('should throw error if package.json has no keywords', async () => {
      const packageJson = { name: 'test-package', version: '1.0.0' }
      mockDeps.readFile = jest.fn().mockResolvedValue(JSON.stringify(packageJson))

      await expect(loadDriver({}, mockDeps)).rejects.toThrow(
        'Current package is not a ya-modbus driver'
      )
    })

    test('should throw error if package.json has empty keywords array', async () => {
      const packageJson = { name: 'test-package', version: '1.0.0', keywords: [] }
      mockDeps.readFile = jest.fn().mockResolvedValue(JSON.stringify(packageJson))

      await expect(loadDriver({}, mockDeps)).rejects.toThrow(
        'Current package is not a ya-modbus driver'
      )
    })

    test('should throw error if package.json does not have ya-modbus-driver keyword', async () => {
      const packageJson = { name: 'test-package', version: '1.0.0', keywords: ['other'] }
      mockDeps.readFile = jest.fn().mockResolvedValue(JSON.stringify(packageJson))

      await expect(loadDriver({}, mockDeps)).rejects.toThrow(
        'Current package is not a ya-modbus driver'
      )
    })

    test('should try multiple import paths in order', async () => {
      const packageJson = { name: 'test-driver', keywords: ['ya-modbus-driver'] }
      mockDeps.readFile = jest.fn().mockResolvedValue(JSON.stringify(packageJson))

      const importError = new Error('Module not found')
      mockDeps.importModule = jest
        .fn()
        .mockRejectedValueOnce(importError) // src/index.js fails
        .mockRejectedValueOnce(importError) // src/index.ts fails
        .mockResolvedValueOnce({ createDriver: jest.fn() }) // dist/index.js succeeds

      const result = await loadDriver({}, mockDeps)

      expect(mockDeps.importModule).toHaveBeenCalledTimes(3)
      expect(mockDeps.importModule).toHaveBeenNthCalledWith(1, '/fake/cwd/src/index.js')
      expect(mockDeps.importModule).toHaveBeenNthCalledWith(2, '/fake/cwd/src/index.ts')
      expect(mockDeps.importModule).toHaveBeenNthCalledWith(3, '/fake/cwd/dist/index.js')
      expect(result.createDriver).toBeDefined()
    })

    test('should fall back to package name if all paths fail', async () => {
      const packageJson = { name: 'test-driver', keywords: ['ya-modbus-driver'] }
      mockDeps.readFile = jest.fn().mockResolvedValue(JSON.stringify(packageJson))

      const importError = new Error('Module not found')
      mockDeps.importModule = jest
        .fn()
        .mockRejectedValueOnce(importError) // src/index.js fails
        .mockRejectedValueOnce(importError) // src/index.ts fails
        .mockRejectedValueOnce(importError) // dist/index.js fails
        .mockResolvedValueOnce({ createDriver: jest.fn() }) // package name succeeds

      const result = await loadDriver({}, mockDeps)

      expect(mockDeps.importModule).toHaveBeenCalledTimes(4)
      expect(mockDeps.importModule).toHaveBeenNthCalledWith(4, 'test-driver')
      expect(result.createDriver).toBeDefined()
    })

    test('should throw error if all import paths fail including package name', async () => {
      const packageJson = { name: 'test-driver', keywords: ['ya-modbus-driver'] }
      mockDeps.readFile = jest.fn().mockResolvedValue(JSON.stringify(packageJson))

      const importError = new Error('Module not found')
      mockDeps.importModule = jest.fn().mockRejectedValue(importError)

      await expect(loadDriver({}, mockDeps)).rejects.toThrow(
        'Failed to import module from any path'
      )
    })
  })

  describe('explicit package mode', () => {
    test('should load driver from explicit package name', async () => {
      const driverModule = { createDriver: jest.fn() }
      mockDeps.importModule = jest.fn().mockResolvedValue(driverModule)

      const result = await loadDriver({ driverPackage: 'test-driver' }, mockDeps)

      expect(mockDeps.importModule).toHaveBeenCalledWith('test-driver')
      expect(result.createDriver).toBeDefined()
    })

    test('should throw error if explicit package not found', async () => {
      const error = new Error('Cannot find module')
      mockDeps.importModule = jest.fn().mockRejectedValue(error)

      await expect(loadDriver({ driverPackage: 'nonexistent' }, mockDeps)).rejects.toThrow(
        'Driver package not found: nonexistent'
      )
    })
  })

  describe('driver validation', () => {
    test('should throw error if driver module is not an object', async () => {
      mockDeps.importModule = jest.fn().mockResolvedValue(null)

      await expect(loadDriver({ driverPackage: 'test-driver' }, mockDeps)).rejects.toThrow(
        'Driver package must export a createDriver function'
      )
    })

    test('should throw error if driver does not export createDriver', async () => {
      mockDeps.importModule = jest.fn().mockResolvedValue({})

      await expect(loadDriver({ driverPackage: 'test-driver' }, mockDeps)).rejects.toThrow(
        'Driver package must export a createDriver function'
      )
    })

    test('should throw error if createDriver is not a function', async () => {
      mockDeps.importModule = jest.fn().mockResolvedValue({ createDriver: 'not a function' })

      await expect(loadDriver({ driverPackage: 'test-driver' }, mockDeps)).rejects.toThrow(
        'Driver package must export a createDriver function'
      )
    })

    test('should return driver with all optional exports', async () => {
      const driverModule = {
        createDriver: jest.fn(),
        DEFAULT_CONFIG: { baudRate: 9600 },
        SUPPORTED_CONFIG: { validBaudRates: [9600] },
        DEVICES: { device1: { manufacturer: 'Test', model: 'Model1' } },
      }
      mockDeps.importModule = jest.fn().mockResolvedValue(driverModule)

      const result = await loadDriver({ driverPackage: 'test-driver' }, mockDeps)

      expect(result.createDriver).toBe(driverModule.createDriver)
      expect(result.defaultConfig).toBe(driverModule.DEFAULT_CONFIG)
      expect(result.supportedConfig).toBe(driverModule.SUPPORTED_CONFIG)
      expect(result.devices).toBe(driverModule.DEVICES)
    })

    test('should return driver with only required createDriver', async () => {
      const driverModule = { createDriver: jest.fn() }
      mockDeps.importModule = jest.fn().mockResolvedValue(driverModule)

      const result = await loadDriver({ driverPackage: 'test-driver' }, mockDeps)

      expect(result.createDriver).toBe(driverModule.createDriver)
      expect(result.defaultConfig).toBeUndefined()
      expect(result.supportedConfig).toBeUndefined()
      expect(result.devices).toBeUndefined()
    })
  })

  describe('cross-validation warnings', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

    beforeEach(() => {
      consoleWarnSpy.mockClear()
    })

    afterAll(() => {
      consoleWarnSpy.mockRestore()
    })

    test('should warn when DEFAULT_CONFIG and SUPPORTED_CONFIG are inconsistent', async () => {
      const driverModule = {
        createDriver: jest.fn(),
        DEFAULT_CONFIG: { baudRate: 115200 },
        SUPPORTED_CONFIG: { validBaudRates: [9600] },
      }
      mockDeps.importModule = jest.fn().mockResolvedValue(driverModule)

      await loadDriver({ driverPackage: 'test-driver' }, mockDeps)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '\nWarning: Driver DEFAULT_CONFIG has inconsistencies:'
      )
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '  - baudRate: 115200 is not in validBaudRates: [9600]'
      )
      expect(consoleWarnSpy).toHaveBeenCalledWith('  This may indicate a driver authoring error\n')
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Run: ya-modbus show-defaults --driver <package> to inspect configuration\n'
      )
    })
  })

  describe('error handling', () => {
    test('should wrap unexpected errors from detectLocalPackage', async () => {
      mockDeps.readFile = jest.fn().mockResolvedValue('{ invalid json')

      await expect(loadDriver({}, mockDeps)).rejects.toThrow('Failed to parse package.json')
    })

    test('should handle JSON syntax errors', async () => {
      mockDeps.readFile = jest.fn().mockResolvedValue('invalid json{')

      await expect(loadDriver({}, mockDeps)).rejects.toThrow('Failed to parse package.json')
    })
  })

  describe('integration with real dependencies', () => {
    test('should load real driver package without deps parameter', async () => {
      const result = await loadDriver({ driverPackage: 'ya-modbus-driver-xymd1' })

      expect(result).toBeDefined()
      expect(result.createDriver).toBeDefined()
      expect(typeof result.createDriver).toBe('function')
      expect(result.defaultConfig).toBeDefined()
      expect(result.supportedConfig).toBeDefined()
    })
  })
})

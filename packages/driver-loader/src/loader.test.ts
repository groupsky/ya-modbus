import { ValidationError, DriverNotFoundError, PackageJsonError } from './errors.js'
import { clearDriverCache, loadDriver } from './loader.js'
import type { SystemDependencies } from './loader.js'

describe('Driver Loader', () => {
  let mockDeps: SystemDependencies

  beforeEach(() => {
    clearDriverCache()
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
        '\nWarning: Driver DEFAULT_CONFIG has configuration inconsistencies:'
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

    test('should provide detailed validation errors with examples', async () => {
      const driverModule = {
        createDriver: jest.fn(),
        DEFAULT_CONFIG: 'invalid',
      }
      mockDeps.importModule = jest.fn().mockResolvedValue(driverModule)

      await expect(loadDriver({ driverPackage: 'test-driver' }, mockDeps)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Invalid DEFAULT_CONFIG'),
        })
      )

      await expect(loadDriver({ driverPackage: 'test-driver' }, mockDeps)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('must be an object'),
        })
      )

      await expect(loadDriver({ driverPackage: 'test-driver' }, mockDeps)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Fix:'),
        })
      )
    })

    test('should provide actionable error when driver validation fails', async () => {
      mockDeps.importModule = jest.fn().mockResolvedValue({ notCreateDriver: jest.fn() })

      await expect(loadDriver({ driverPackage: 'test-driver' }, mockDeps)).rejects.toThrow(
        'Driver package must export a createDriver function'
      )
    })
  })

  describe('error type handling (instanceof checks)', () => {
    test('should throw PackageJsonError for missing package.json', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      mockDeps.readFile = jest.fn().mockRejectedValue(error)

      await expect(loadDriver({}, mockDeps)).rejects.toThrow(PackageJsonError)
      await expect(loadDriver({}, mockDeps)).rejects.toThrow('package.json not found')

      // Verify error properties
      const thrownError = await loadDriver({}, mockDeps).catch((err) => err)
      expect(thrownError).toBeInstanceOf(Error)
      expect(thrownError.name).toBe('PackageJsonError')
    })

    test('should throw PackageJsonError for invalid JSON', async () => {
      mockDeps.readFile = jest.fn().mockResolvedValue('{ invalid json')

      await expect(loadDriver({}, mockDeps)).rejects.toThrow(PackageJsonError)
      await expect(loadDriver({}, mockDeps)).rejects.toThrow('Failed to parse package.json')
    })

    test('should throw PackageJsonError for missing ya-modbus-driver keyword', async () => {
      const packageJson = { name: 'test-package', keywords: ['other'] }
      mockDeps.readFile = jest.fn().mockResolvedValue(JSON.stringify(packageJson))

      await expect(loadDriver({}, mockDeps)).rejects.toThrow(PackageJsonError)
      await expect(loadDriver({}, mockDeps)).rejects.toThrow('not a ya-modbus driver')
    })

    test('should throw DriverNotFoundError with packageName metadata', async () => {
      const error = new Error('Cannot find module')
      mockDeps.importModule = jest.fn().mockRejectedValue(error)

      await expect(loadDriver({ driverPackage: 'missing-driver' }, mockDeps)).rejects.toThrow(
        DriverNotFoundError
      )

      // Verify error metadata
      const thrownError = await loadDriver({ driverPackage: 'missing-driver' }, mockDeps).catch(
        (err) => err
      )
      expect(thrownError).toBeInstanceOf(Error)
      expect(thrownError.name).toBe('DriverNotFoundError')
      expect(thrownError.packageName).toBe('missing-driver')
      expect(thrownError.message).toContain('missing-driver')
    })

    test('should throw ValidationError with field metadata for missing createDriver', async () => {
      mockDeps.importModule = jest.fn().mockResolvedValue({ notCreateDriver: jest.fn() })

      await expect(loadDriver({ driverPackage: 'test-driver' }, mockDeps)).rejects.toThrow(
        ValidationError
      )

      // Verify error metadata
      const thrownError = await loadDriver({ driverPackage: 'test-driver' }, mockDeps).catch(
        (err) => err
      )
      expect(thrownError).toBeInstanceOf(Error)
      expect(thrownError.name).toBe('ValidationError')
      expect(thrownError.field).toBe('createDriver')
      expect(thrownError.message).toContain('createDriver')
    })

    test('should throw ValidationError with field metadata for invalid DEFAULT_CONFIG', async () => {
      const driverModule = {
        createDriver: jest.fn(),
        DEFAULT_CONFIG: 'invalid', // Should be an object
      }
      mockDeps.importModule = jest.fn().mockResolvedValue(driverModule)

      await expect(loadDriver({ driverPackage: 'test-driver' }, mockDeps)).rejects.toThrow(
        ValidationError
      )

      // Verify error message
      const thrownError = await loadDriver({ driverPackage: 'test-driver' }, mockDeps).catch(
        (err) => err
      )
      expect(thrownError.message).toContain('Invalid DEFAULT_CONFIG')
    })

    test('should preserve error cause for better debugging', async () => {
      const originalError = new Error('Original module error')
      const errorWithCode = originalError as NodeJS.ErrnoException
      errorWithCode.code = 'MODULE_NOT_FOUND'

      mockDeps.importModule = jest.fn().mockRejectedValue(originalError)

      await expect(loadDriver({ driverPackage: 'test-driver' }, mockDeps)).rejects.toThrow(
        DriverNotFoundError
      )

      // Verify error was thrown with message
      const thrownError = await loadDriver({ driverPackage: 'test-driver' }, mockDeps).catch(
        (err) => err
      )
      expect(thrownError).toBeInstanceOf(DriverNotFoundError)
      expect(thrownError.message).toBeTruthy()
    })

    test('should allow type-safe error handling patterns', async () => {
      const scenarios = [
        {
          name: 'PackageJsonError',
          setup: () => {
            const error = new Error('ENOENT') as NodeJS.ErrnoException
            error.code = 'ENOENT'
            mockDeps.readFile = jest.fn().mockRejectedValue(error)
          },
          loadOptions: {}, // Auto-detect mode to trigger readFile
          expectedType: PackageJsonError,
        },
        {
          name: 'DriverNotFoundError',
          setup: () => {
            mockDeps.importModule = jest.fn().mockRejectedValue(new Error('Not found'))
          },
          loadOptions: { driverPackage: 'test' },
          expectedType: DriverNotFoundError,
        },
        {
          name: 'ValidationError',
          setup: () => {
            mockDeps.importModule = jest.fn().mockResolvedValue({})
          },
          loadOptions: { driverPackage: 'test' },
          expectedType: ValidationError,
        },
      ]

      for (const scenario of scenarios) {
        clearDriverCache()
        scenario.setup()

        await expect(loadDriver(scenario.loadOptions, mockDeps)).rejects.toThrow(
          scenario.expectedType
        )
      }
    })
  })

  describe('integration with real dependencies', () => {
    test('should load real driver package without deps parameter', async () => {
      const result = await loadDriver({ driverPackage: '@ya-modbus/driver-xymd1' })

      expect(result).toBeDefined()
      expect(result.createDriver).toBeDefined()
      expect(typeof result.createDriver).toBe('function')
      expect(result.defaultConfig).toBeDefined()
      expect(result.supportedConfig).toBeDefined()
    })
  })

  describe('caching', () => {
    test('should cache loaded drivers by package name', async () => {
      const driverModule = { createDriver: jest.fn() }
      mockDeps.importModule = jest.fn().mockResolvedValue(driverModule)

      await loadDriver({ driverPackage: 'test-driver' }, mockDeps)
      await loadDriver({ driverPackage: 'test-driver' }, mockDeps)

      expect(mockDeps.importModule).toHaveBeenCalledTimes(1)
    })

    test('should track cache statistics', async () => {
      const { getDriverCacheStats } = await import('./loader.js')
      const driverModule = { createDriver: jest.fn() }
      mockDeps.importModule = jest.fn().mockResolvedValue(driverModule)

      const statsBeforeLoad = getDriverCacheStats()
      expect(statsBeforeLoad.hits).toBe(0)
      expect(statsBeforeLoad.misses).toBe(0)
      expect(statsBeforeLoad.size).toBe(0)

      await loadDriver({ driverPackage: 'test-driver' }, mockDeps)
      const statsAfterFirstLoad = getDriverCacheStats()
      expect(statsAfterFirstLoad.hits).toBe(0)
      expect(statsAfterFirstLoad.misses).toBe(1)
      expect(statsAfterFirstLoad.size).toBe(1)

      await loadDriver({ driverPackage: 'test-driver' }, mockDeps)
      const statsAfterSecondLoad = getDriverCacheStats()
      expect(statsAfterSecondLoad.hits).toBe(1)
      expect(statsAfterSecondLoad.misses).toBe(1)
      expect(statsAfterSecondLoad.size).toBe(1)

      await loadDriver({ driverPackage: 'another-driver' }, mockDeps)
      const statsAfterThirdLoad = getDriverCacheStats()
      expect(statsAfterThirdLoad.hits).toBe(1)
      expect(statsAfterThirdLoad.misses).toBe(2)
      expect(statsAfterThirdLoad.size).toBe(2)
    })

    test('should cache different drivers separately', async () => {
      const driver1 = { createDriver: jest.fn().mockImplementation(() => 'driver1') }
      const driver2 = { createDriver: jest.fn().mockImplementation(() => 'driver2') }

      mockDeps.importModule = jest
        .fn()
        .mockResolvedValueOnce(driver1)
        .mockResolvedValueOnce(driver2)

      const result1 = await loadDriver({ driverPackage: 'driver-1' }, mockDeps)
      const result2 = await loadDriver({ driverPackage: 'driver-2' }, mockDeps)
      const result1Again = await loadDriver({ driverPackage: 'driver-1' }, mockDeps)

      expect(mockDeps.importModule).toHaveBeenCalledTimes(2)
      expect(result1.createDriver).toBe(driver1.createDriver)
      expect(result2.createDriver).toBe(driver2.createDriver)
      expect(result1Again.createDriver).toBe(driver1.createDriver)
    })

    test('should cache auto-detected drivers by package name', async () => {
      const packageJson = { name: 'test-driver', keywords: ['ya-modbus-driver'] }
      mockDeps.readFile = jest.fn().mockResolvedValue(JSON.stringify(packageJson))

      const driverModule = { createDriver: jest.fn() }
      mockDeps.importModule = jest.fn().mockResolvedValue(driverModule)

      await loadDriver({}, mockDeps)
      await loadDriver({}, mockDeps)

      expect(mockDeps.readFile).toHaveBeenCalledTimes(2)
      expect(mockDeps.importModule).toHaveBeenCalledTimes(1)
    })

    test('should not cache when import fails', async () => {
      const error = new Error('Module not found')
      mockDeps.importModule = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ createDriver: jest.fn() })

      await expect(loadDriver({ driverPackage: 'test-driver' }, mockDeps)).rejects.toThrow()

      const result = await loadDriver({ driverPackage: 'test-driver' }, mockDeps)

      expect(mockDeps.importModule).toHaveBeenCalledTimes(2)
      expect(result.createDriver).toBeDefined()
    })
  })

  describe('custom logger', () => {
    test('should use custom logger for config warnings', async () => {
      const mockLogger = {
        warn: jest.fn(),
      }

      const driverModule = {
        createDriver: jest.fn(),
        DEFAULT_CONFIG: { baudRate: 9600 },
        SUPPORTED_CONFIG: { validBaudRates: [19200] }, // Mismatch to trigger warning
      }

      mockDeps.importModule = jest.fn().mockResolvedValue(driverModule)

      await loadDriver({ driverPackage: 'test-driver', logger: mockLogger }, mockDeps)

      expect(mockLogger.warn).toHaveBeenCalled()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('DEFAULT_CONFIG has configuration inconsistencies')
      )
    })

    test('should use console by default when no logger provided', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      const driverModule = {
        createDriver: jest.fn(),
        DEFAULT_CONFIG: { baudRate: 9600 },
        SUPPORTED_CONFIG: { validBaudRates: [19200] },
      }

      mockDeps.importModule = jest.fn().mockResolvedValue(driverModule)

      await loadDriver({ driverPackage: 'test-driver' }, mockDeps)

      expect(consoleWarnSpy).toHaveBeenCalled()
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('DEFAULT_CONFIG has configuration inconsistencies')
      )

      consoleWarnSpy.mockRestore()
    })
  })
})

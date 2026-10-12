import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  DriverNotBuiltError,
  DriverNotFoundError,
  PackageJsonError,
  ValidationError,
} from './errors.js'
import { clearDriverCache, getDriverCacheStats, loadDriver } from './loader.js'
import type { SystemDependencies } from './loader.js'

// An error like the ones Node throws, with its `code`
function nodeError(message: string, code: string): Error {
  return Object.assign(new Error(message), { code })
}

// What Node reports when a package is not installed (ESM and CommonJS wording)
function notInstalled(name: string, style: 'esm' | 'cjs' = 'esm'): Error {
  const error =
    style === 'esm'
      ? new Error(`Cannot find package '${name}' imported from /app/loader.js`)
      : new Error(`Cannot find module '${name}'\nRequire stack:\n- /app/loader.js`)
  return Object.assign(error, {
    code: style === 'esm' ? 'ERR_MODULE_NOT_FOUND' : 'MODULE_NOT_FOUND',
  })
}

// importModule for a project where no package is installed
const nothingInstalled = (name: string): Promise<never> => Promise.reject(notInstalled(name))

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

    describe('entry point', () => {
      const localDriver = (extra: Record<string, unknown> = {}): string =>
        JSON.stringify({ name: 'test-driver', keywords: ['ya-modbus-driver'], ...extra })
      const fileUrl = (...parts: string[]): string =>
        pathToFileURL(join('/fake/cwd', ...parts)).href

      test('should import the main entry of package.json as a file URL', async () => {
        mockDeps.readFile = jest.fn().mockResolvedValue(localDriver({ main: 'build/driver.js' }))
        mockDeps.importModule = jest.fn().mockResolvedValue({ createDriver: jest.fn() })

        const result = await loadDriver({}, mockDeps)

        expect(mockDeps.importModule).toHaveBeenCalledTimes(1)
        expect(mockDeps.importModule).toHaveBeenCalledWith(fileUrl('build', 'driver.js'))
        expect(result.createDriver).toBeDefined()
      })

      test('should prefer the import entry of exports over main', async () => {
        mockDeps.readFile = jest.fn().mockResolvedValue(
          localDriver({
            main: './dist/cjs/index.js',
            exports: {
              '.': {
                import: { types: './dist/esm/index.d.ts', default: './dist/esm/index.js' },
                require: { types: './dist/cjs/index.d.ts', default: './dist/cjs/index.js' },
              },
            },
          })
        )
        mockDeps.importModule = jest.fn().mockResolvedValue({ createDriver: jest.fn() })

        await loadDriver({}, mockDeps)

        expect(mockDeps.importModule).toHaveBeenCalledWith(fileUrl('dist', 'esm', 'index.js'))
      })

      test('should import index.js when package.json names no entry', async () => {
        mockDeps.readFile = jest.fn().mockResolvedValue(localDriver())
        mockDeps.importModule = jest.fn().mockResolvedValue({ createDriver: jest.fn() })

        await loadDriver({}, mockDeps)

        expect(mockDeps.importModule).toHaveBeenCalledWith(fileUrl('index.js'))
      })

      test('should not look for source files or the package name', async () => {
        mockDeps.readFile = jest.fn().mockResolvedValue(localDriver({ main: 'dist/index.js' }))
        mockDeps.importModule = jest.fn().mockRejectedValue(new Error('Boom'))

        await expect(loadDriver({}, mockDeps)).rejects.toThrow('Failed to load driver: Boom')

        expect(mockDeps.importModule).toHaveBeenCalledTimes(1)
      })

      test('should import a TypeScript entry when Node can load it', async () => {
        mockDeps.readFile = jest.fn().mockResolvedValue(localDriver({ main: 'src/index.ts' }))
        mockDeps.importModule = jest.fn().mockResolvedValue({ createDriver: jest.fn() })

        const result = await loadDriver({}, mockDeps)

        expect(mockDeps.importModule).toHaveBeenCalledWith(fileUrl('src', 'index.ts'))
        expect(result.createDriver).toBeDefined()
      })

      test.each([
        ['main without an extension', { main: 'dist/index' }],
        ['main that is a directory', { main: 'dist' }],
        ['exports without an extension', { exports: './dist/index' }],
      ])('should throw PackageJsonError for %s', async (_description, entry) => {
        mockDeps.readFile = jest.fn().mockResolvedValue(localDriver(entry))

        await expect(loadDriver({}, mockDeps)).rejects.toThrow(PackageJsonError)
        await expect(loadDriver({}, mockDeps)).rejects.toThrow('has no file extension')
        expect(mockDeps.importModule).not.toHaveBeenCalled()
      })

      test('should throw PackageJsonError when exports has no entry for import', async () => {
        mockDeps.readFile = jest
          .fn()
          .mockResolvedValue(
            localDriver({ main: 'index.js', exports: { '.': { require: './x.cjs' } } })
          )

        await expect(loadDriver({}, mockDeps)).rejects.toThrow(PackageJsonError)
        await expect(loadDriver({}, mockDeps)).rejects.toThrow(
          'package.json "exports" has no entry for "." that can be imported'
        )
        expect(mockDeps.importModule).not.toHaveBeenCalled()
      })
    })

    describe('driver that is not built', () => {
      const BUILD_HINT =
        "Build the driver first (npm run build), or run with Node's built-in type stripping (Node 22.18+ or 24)"
      const UNSUPPORTED_HINT = "Node's type stripping needs erasable syntax (no enums)"

      function setupLocalDriver(main: string, importError: Error): void {
        mockDeps.readFile = jest
          .fn()
          .mockResolvedValue(
            JSON.stringify({ name: 'test-driver', keywords: ['ya-modbus-driver'], main })
          )
        mockDeps.importModule = jest.fn().mockRejectedValue(importError)
      }

      test('should tell to build the driver when the entry file is missing', async () => {
        const entry = join('/fake/cwd', 'dist', 'index.js')
        const cause = nodeError(
          `Cannot find module '${entry}' imported from /usr/lib/driver-loader/loader.js`,
          'ERR_MODULE_NOT_FOUND'
        )
        setupLocalDriver('dist/index.js', cause)

        const error = await loadDriver({}, mockDeps).catch((err) => err)

        expect(error).toBeInstanceOf(DriverNotBuiltError)
        expect(error.packageName).toBe('test-driver')
        expect(error.cause).toBe(cause)
        expect(error.message).toBe(
          `Cannot load driver test-driver: Cannot find module '${entry}'\n` +
            'Drivers are loaded as built JavaScript. Build the driver first (npm run build).'
        )
      })

      test('should tell to build the driver when Node cannot load a TypeScript entry', async () => {
        setupLocalDriver(
          'src/index.ts',
          nodeError(
            'Unknown file extension ".ts" for /fake/cwd/src/index.ts',
            'ERR_UNKNOWN_FILE_EXTENSION'
          )
        )

        const error = await loadDriver({}, mockDeps).catch((err) => err)

        expect(error).toBeInstanceOf(DriverNotBuiltError)
        expect(error.message).toContain('Unknown file extension ".ts" for /fake/cwd/src/index.ts')
        expect(error.message).toContain(BUILD_HINT)
      })

      test('should tell to build the driver when TypeScript source uses syntax Node cannot strip', async () => {
        setupLocalDriver(
          'src/index.ts',
          nodeError(
            'TypeScript enum is not supported in strip-only mode',
            'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX'
          )
        )

        const error = await loadDriver({}, mockDeps).catch((err) => err)

        expect(error).toBeInstanceOf(DriverNotBuiltError)
        expect(error.message).toContain('TypeScript enum is not supported in strip-only mode')
        expect(error.message).toContain(UNSUPPORTED_HINT)
      })

      test('should tell to build the driver when TypeScript source imports a .js file', async () => {
        // Node runs the .ts entry but does not map './device.js' to device.ts
        setupLocalDriver(
          'src/index.ts',
          nodeError(
            "Cannot find module '/fake/cwd/src/device.js' imported from /fake/cwd/src/index.ts",
            'ERR_MODULE_NOT_FOUND'
          )
        )

        const error = await loadDriver({}, mockDeps).catch((err) => err)

        expect(error).toBeInstanceOf(DriverNotBuiltError)
        expect(error.message).toContain(
          "Cannot find module '/fake/cwd/src/device.js' imported from /fake/cwd/src/index.ts"
        )
        expect(error.message).toContain(UNSUPPORTED_HINT)
      })

      test.each([
        ['a syntax error', new SyntaxError('Unexpected token')],
        [
          'a missing dependency',
          nodeError(
            "Cannot find package 'modbus-serial' imported from /fake/cwd/dist/index.js",
            'ERR_MODULE_NOT_FOUND'
          ),
        ],
        [
          'a built driver that imports a file without its extension',
          nodeError(
            "Cannot find module '/fake/cwd/dist/utils' imported from /fake/cwd/dist/index.js",
            'ERR_MODULE_NOT_FOUND'
          ),
        ],
      ])('should not report %s as not built', async (_description, importError) => {
        setupLocalDriver('dist/index.js', importError)

        const error = await loadDriver({}, mockDeps).catch((err) => err)

        expect(error).not.toBeInstanceOf(DriverNotBuiltError)
        expect(error.message).toBe(`Failed to load driver: ${importError.message}`)
        expect(error.cause).toBe(importError)
      })

      test('should not cache a driver that is not built', async () => {
        const entry = join('/fake/cwd', 'dist', 'index.js')
        setupLocalDriver(
          'dist/index.js',
          nodeError(`Cannot find module '${entry}'`, 'ERR_MODULE_NOT_FOUND')
        )
        await expect(loadDriver({}, mockDeps)).rejects.toThrow(DriverNotBuiltError)

        // After `npm run build` the next call works
        mockDeps.importModule = jest.fn().mockResolvedValue({ createDriver: jest.fn() })
        const result = await loadDriver({}, mockDeps)

        expect(result.createDriver).toBeDefined()
        expect(getDriverCacheStats().size).toBe(1)
      })
    })
  })

  describe('explicit package mode', () => {
    test('should load driver from explicit package name', async () => {
      const driverModule = { createDriver: jest.fn() }
      mockDeps.importModule = jest.fn().mockResolvedValue(driverModule)

      const result = await loadDriver({ driverPackage: 'ya-modbus-driver-test' }, mockDeps)

      expect(mockDeps.importModule).toHaveBeenCalledWith('ya-modbus-driver-test')
      expect(result.createDriver).toBeDefined()
    })

    test('should throw error if explicit package not found', async () => {
      mockDeps.importModule = jest.fn().mockImplementation(nothingInstalled)

      await expect(loadDriver({ driverPackage: 'nonexistent' }, mockDeps)).rejects.toThrow(
        'Driver package not found: nonexistent'
      )
    })
  })

  describe('short driver names', () => {
    test('should load the scoped package first', async () => {
      mockDeps.importModule = jest.fn().mockResolvedValue({ createDriver: jest.fn() })

      await loadDriver({ driverPackage: 'xymd1' }, mockDeps)

      expect(mockDeps.importModule).toHaveBeenCalledTimes(1)
      expect(mockDeps.importModule).toHaveBeenCalledWith('@ya-modbus/driver-xymd1')
    })

    test.each(['esm', 'cjs'] as const)(
      'should fall back to the unscoped package when the scoped one is not installed (%s)',
      async (style) => {
        const driverModule = { createDriver: jest.fn() }
        mockDeps.importModule = jest
          .fn()
          .mockRejectedValueOnce(notInstalled('@ya-modbus/driver-xymd1', style))
          .mockResolvedValueOnce(driverModule)

        const result = await loadDriver({ driverPackage: 'xymd1' }, mockDeps)

        expect(mockDeps.importModule).toHaveBeenNthCalledWith(2, 'ya-modbus-driver-xymd1')
        expect(result.createDriver).toBe(driverModule.createDriver)
      }
    )

    test('should fall back to the name as given when no driver-named package is installed', async () => {
      const driverModule = { createDriver: jest.fn() }
      mockDeps.importModule = jest
        .fn()
        .mockRejectedValueOnce(notInstalled('@ya-modbus/driver-my-driver'))
        .mockRejectedValueOnce(notInstalled('ya-modbus-driver-my-driver'))
        .mockResolvedValueOnce(driverModule)

      const result = await loadDriver({ driverPackage: 'my-driver' }, mockDeps)

      expect(mockDeps.importModule).toHaveBeenNthCalledWith(3, 'my-driver')
      expect(result.createDriver).toBe(driverModule.createDriver)
    })

    test('should list every tried package when none is installed', async () => {
      mockDeps.importModule = jest
        .fn()
        .mockRejectedValueOnce(notInstalled('@ya-modbus/driver-xymd1'))
        .mockRejectedValueOnce(notInstalled('ya-modbus-driver-xymd1'))
        .mockRejectedValueOnce(notInstalled('xymd1'))

      const error = await loadDriver({ driverPackage: 'xymd1' }, mockDeps).catch((err) => err)

      expect(error).toBeInstanceOf(DriverNotFoundError)
      expect(error.packageName).toBe('@ya-modbus/driver-xymd1')
      expect(error.message).toContain('Driver package not found: xymd1')
      expect(error.message).toContain(
        'Tried: @ya-modbus/driver-xymd1, ya-modbus-driver-xymd1, xymd1'
      )
      expect(error.message).toContain('npm install @ya-modbus/driver-xymd1')
    })

    test('should report the load error of an installed package and not try further', async () => {
      // The package is installed, so a later candidate must not hide the real problem
      const loadError = new SyntaxError('Unexpected token')
      mockDeps.importModule = jest
        .fn()
        .mockRejectedValueOnce(notInstalled('@ya-modbus/driver-xymd1'))
        .mockRejectedValueOnce(loadError)

      const error = await loadDriver({ driverPackage: 'xymd1' }, mockDeps).catch((err) => err)

      expect(error).toBeInstanceOf(DriverNotFoundError)
      expect(error.message).toBe(
        'Failed to load driver package ya-modbus-driver-xymd1: Unexpected token'
      )
      expect(error.packageName).toBe('ya-modbus-driver-xymd1')
      expect(error.cause).toBe(loadError)
      expect(mockDeps.importModule).toHaveBeenCalledTimes(2)
    })

    test('should report a thrown value that is not an Error as a load error', async () => {
      mockDeps.importModule = jest.fn().mockRejectedValue('boom')

      await expect(loadDriver({ driverPackage: 'xymd1' }, mockDeps)).rejects.toThrow(
        'Failed to load driver package @ya-modbus/driver-xymd1: boom'
      )
    })

    test('should report a missing dependency of the package as a load error', async () => {
      mockDeps.importModule = jest.fn().mockRejectedValue(notInstalled('modbus-serial'))

      const error = await loadDriver({ driverPackage: 'xymd1' }, mockDeps).catch((err) => err)

      expect(error).toBeInstanceOf(DriverNotFoundError)
      expect(error.message).toContain(
        "Failed to load driver package @ya-modbus/driver-xymd1: Cannot find package 'modbus-serial'"
      )
      expect(mockDeps.importModule).toHaveBeenCalledTimes(1)
    })

    test.each([
      '@ya-modbus/driver-xymd1',
      'ya-modbus-driver-xymd1',
      '@org/ya-modbus-driver-xymd1',
      '@org/driver-pkg',
    ])('should import the full name %s as given', async (name) => {
      mockDeps.importModule = jest.fn().mockRejectedValue(notInstalled(name))

      await expect(loadDriver({ driverPackage: name }, mockDeps)).rejects.toThrow(
        `Driver package not found: ${name}\nInstall it with: npm install ${name}`
      )

      expect(mockDeps.importModule).toHaveBeenCalledTimes(1)
      expect(mockDeps.importModule).toHaveBeenCalledWith(name)
    })

    test('should share one cache entry between the short and the full name', async () => {
      mockDeps.importModule = jest.fn().mockResolvedValue({ createDriver: jest.fn() })

      const first = await loadDriver({ driverPackage: 'xymd1' }, mockDeps)
      const second = await loadDriver({ driverPackage: '@ya-modbus/driver-xymd1' }, mockDeps)
      const third = await loadDriver({ driverPackage: 'xymd1' }, mockDeps)

      expect(second).toBe(first)
      expect(third).toBe(first)
      expect(mockDeps.importModule).toHaveBeenCalledTimes(1)
      expect(getDriverCacheStats()).toEqual({ hits: 2, misses: 1, size: 1 })
    })

    test('should cache a driver found through the unscoped fallback', async () => {
      mockDeps.importModule = jest
        .fn()
        .mockRejectedValueOnce(notInstalled('@ya-modbus/driver-xymd1'))
        .mockResolvedValue({ createDriver: jest.fn() })

      const first = await loadDriver({ driverPackage: 'xymd1' }, mockDeps)
      const second = await loadDriver({ driverPackage: 'ya-modbus-driver-xymd1' }, mockDeps)

      expect(second).toBe(first)
      expect(mockDeps.importModule).toHaveBeenCalledTimes(2)
    })
  })

  describe('explicit package that is not built', () => {
    const installedPath = '/proj/node_modules/ya-modbus-driver-foo/dist/index.js'

    test.each([
      [
        'exports target',
        `Cannot find module '${installedPath}' imported from /app/loader.js`,
        'ERR_MODULE_NOT_FOUND',
      ],
      [
        'main',
        `Cannot find package '${installedPath}' imported from /app/loader.js`,
        'ERR_MODULE_NOT_FOUND',
      ],
      [
        'main in CommonJS',
        `Cannot find module '${installedPath}'. Please verify that the package.json has a valid "main" entry`,
        'MODULE_NOT_FOUND',
      ],
      [
        'TypeScript entry',
        'Unknown file extension ".ts" for /repo/packages/driver-foo/src/index.ts',
        'ERR_UNKNOWN_FILE_EXTENSION',
      ],
    ])('should tell to build an installed package: %s', async (_description, message, code) => {
      const cause = nodeError(message, code)
      mockDeps.importModule = jest.fn().mockRejectedValue(cause)

      const error = await loadDriver({ driverPackage: 'ya-modbus-driver-foo' }, mockDeps).catch(
        (err) => err
      )

      expect(error).toBeInstanceOf(DriverNotBuiltError)
      expect(error).not.toBeInstanceOf(DriverNotFoundError)
      expect(error.packageName).toBe('ya-modbus-driver-foo')
      expect(error.cause).toBe(cause)
      expect(error.message).toContain('Cannot load driver ya-modbus-driver-foo: ')
      expect(error.message).toContain('Build the driver first (npm run build)')
    })

    test('should keep the importing file in the message, since the entry file is not known', async () => {
      mockDeps.importModule = jest
        .fn()
        .mockRejectedValue(
          nodeError(
            "Cannot find module '/proj/node_modules/ya-modbus-driver-foo/dist/utils' imported from /proj/node_modules/ya-modbus-driver-foo/dist/index.js",
            'ERR_MODULE_NOT_FOUND'
          )
        )

      const error = await loadDriver({ driverPackage: 'ya-modbus-driver-foo' }, mockDeps).catch(
        (err) => err
      )

      expect(error).toBeInstanceOf(DriverNotBuiltError)
      expect(error.message).toContain(
        'imported from /proj/node_modules/ya-modbus-driver-foo/dist/index.js'
      )
    })

    test('should tell that a package under node_modules must ship built JavaScript', async () => {
      mockDeps.importModule = jest
        .fn()
        .mockRejectedValue(
          nodeError(
            'Stripping types is currently unsupported for files under node_modules',
            'ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING'
          )
        )

      const error = await loadDriver({ driverPackage: 'ya-modbus-driver-foo' }, mockDeps).catch(
        (err) => err
      )

      expect(error).toBeInstanceOf(DriverNotBuiltError)
      expect(error.message).toContain('Stripping types is currently unsupported')
      expect(error.message).toContain('a package must ship built JavaScript')
    })

    test('should stop the search at the package that is not built', async () => {
      mockDeps.importModule = jest
        .fn()
        .mockRejectedValueOnce(notInstalled('@ya-modbus/driver-foo'))
        .mockRejectedValueOnce(
          nodeError(`Cannot find module '${installedPath}'`, 'ERR_MODULE_NOT_FOUND')
        )

      const error = await loadDriver({ driverPackage: 'foo' }, mockDeps).catch((err) => err)

      expect(error).toBeInstanceOf(DriverNotBuiltError)
      expect(error.packageName).toBe('ya-modbus-driver-foo')
      expect(mockDeps.importModule).toHaveBeenCalledTimes(2)
    })

    test('should not cache a package that is not built', async () => {
      mockDeps.importModule = jest
        .fn()
        .mockRejectedValueOnce(
          nodeError(`Cannot find module '${installedPath}'`, 'ERR_MODULE_NOT_FOUND')
        )
        .mockResolvedValueOnce({ createDriver: jest.fn() })
      const options = { driverPackage: 'ya-modbus-driver-foo' }

      await expect(loadDriver(options, mockDeps)).rejects.toThrow(DriverNotBuiltError)
      const result = await loadDriver(options, mockDeps)

      expect(result.createDriver).toBeDefined()
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
      mockDeps.importModule = jest.fn().mockImplementation(nothingInstalled)

      await expect(loadDriver({ driverPackage: 'missing-driver' }, mockDeps)).rejects.toThrow(
        DriverNotFoundError
      )

      // Verify error metadata
      const thrownError = await loadDriver({ driverPackage: 'missing-driver' }, mockDeps).catch(
        (err) => err
      )
      expect(thrownError).toBeInstanceOf(Error)
      expect(thrownError.name).toBe('DriverNotFoundError')
      // The package to install: the short name stands for the scoped package
      expect(thrownError.packageName).toBe('@ya-modbus/driver-missing-driver')
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
      expect(thrownError.message).toContain('Original module error')
      expect(thrownError.cause).toBe(originalError)
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

    test('should load real driver package by its short name', async () => {
      const result = await loadDriver({ driverPackage: 'xymd1' })

      expect(typeof result.createDriver).toBe('function')
      expect(result.defaultConfig).toBeDefined()
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

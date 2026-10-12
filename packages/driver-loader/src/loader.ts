import { readFile } from 'fs/promises'

import type {
  CreateDriverFunction,
  DefaultConfig,
  DeviceRegistry,
  SupportedConfig,
} from '@ya-modbus/driver-types'

import {
  crossValidateConfigs,
  outputConfigWarnings,
  validateDefaultConfig,
  validateDevices,
  validateSupportedConfig,
} from './config-validator.js'
import { importDriverPackage, importLocalDriver } from './driver-import.js'
import { getDriverPackageCandidates } from './driver-name.js'
import {
  DriverNotBuiltError,
  DriverNotFoundError,
  PackageJsonError,
  ValidationError,
} from './errors.js'
import { detectLocalPackage } from './local-package.js'

/**
 * Loaded driver module with configuration metadata
 */
export interface LoadedDriver {
  /** Driver factory function */
  createDriver: CreateDriverFunction

  /** Registry of supported devices (for multi-device drivers) */
  devices?: DeviceRegistry

  /** Factory-default device configuration (if provided by driver) */
  defaultConfig?: DefaultConfig

  /** Supported configuration constraints (if provided by driver) */
  supportedConfig?: SupportedConfig
}

/**
 * Logger interface for driver loading
 *
 * @example
 * ```typescript
 * import { loadDriver, type Logger } from '@ya-modbus/driver-loader'
 *
 * const logger: Logger = {
 *   warn: (msg) => console.warn('[DRIVER]', msg),
 *   debug: (msg) => console.debug('[DRIVER]', msg), // Optional
 * }
 *
 * const driver = await loadDriver({ logger })
 * ```
 */
export interface Logger {
  /** Log warning messages */
  warn: (message: string) => void
  /** Log debug messages (optional) */
  debug?: (message: string) => void
}

/**
 * Driver loading options
 *
 * @example
 * ```typescript
 * import { loadDriver } from '@ya-modbus/driver-loader'
 *
 * // Auto-detect from current directory
 * const driver1 = await loadDriver({})
 *
 * // Load specific package
 * const driver2 = await loadDriver({ driverPackage: 'ya-modbus-driver-xymd1' })
 *
 * // With custom logger
 * const driver3 = await loadDriver({
 *   driverPackage: 'my-driver',
 *   logger: {
 *     warn: (msg) => console.warn('[WARN]', msg),
 *     debug: (msg) => console.debug('[DEBUG]', msg),
 *   }
 * })
 * ```
 */
export interface LoadDriverOptions {
  /**
   * Explicit driver package name
   * e.g., 'ya-modbus-driver-xymd1' or '@org/ya-modbus-driver-xymd1'
   *
   * A short name such as 'xymd1' is tried as '@ya-modbus/driver-xymd1',
   * then 'ya-modbus-driver-xymd1', then 'xymd1'.
   */
  driverPackage?: string

  /**
   * Custom logger for warnings and debug messages
   * Defaults to console if not provided
   */
  logger?: Logger
}

/**
 * System dependencies for driver loading (for dependency injection)
 */
export interface SystemDependencies {
  readFile: (path: string, encoding: 'utf-8') => Promise<string>
  /** Import a module by package name, or by `file:` URL for the entry file of a local package */
  importModule: (specifier: string) => Promise<unknown>
  getCwd: () => string
}

/**
 * Native `import()`, in the CommonJS build as well
 *
 * The CommonJS build compiles `import()` to `require()`, which cannot load a `file:` URL.
 * Going through `Function` keeps the native `import()`, which also loads ES modules.
 */
/* istanbul ignore next */
const nativeImport = (specifier: string): Promise<unknown> => {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- keeps `import()` out of the CommonJS transform
  const importFn = new Function('specifier', 'return import(specifier)') as typeof nativeImport
  return importFn(specifier)
}

/**
 * Default system dependencies using Node.js built-ins
 */
/* istanbul ignore next */
const defaultDeps: SystemDependencies = {
  /* istanbul ignore next */
  readFile: (path: string, encoding: 'utf-8') => readFile(path, encoding),
  /* istanbul ignore next */
  importModule: (specifier: string) =>
    specifier.startsWith('file:') ? nativeImport(specifier) : import(specifier),
  /* istanbul ignore next */
  getCwd: () => process.cwd(),
}

/**
 * Driver cache statistics
 */
export interface DriverCacheStats {
  /** Number of cache hits */
  hits: number
  /** Number of cache misses */
  misses: number
  /** Number of cached drivers */
  size: number
}

/**
 * LRU cache for loaded drivers
 */
const driverCache = new Map<string, LoadedDriver>()

/**
 * Cache statistics
 */
const cacheStats = {
  hits: 0,
  misses: 0,
}

/**
 * Clear the driver cache
 * Useful for testing or when you need to reload drivers
 */
export function clearDriverCache(): void {
  driverCache.clear()
  cacheStats.hits = 0
  cacheStats.misses = 0
}

/**
 * Get cache statistics
 * @returns Current cache statistics including hits, misses, and size
 */
export function getDriverCacheStats(): DriverCacheStats {
  return {
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    size: driverCache.size,
  }
}

/**
 * Load a driver package dynamically
 *
 * Supports two modes:
 * 1. Explicit package: `loadDriver({ driverPackage: 'ya-modbus-driver-xymd1' })`
 * 2. Auto-detect from cwd: `loadDriver({})` - reads package.json from current directory
 *
 * Auto-detection checks for `ya-modbus-driver` keyword in package.json keywords and loads
 * the entry file that `import` of the package resolves to (`exports["."]`, else `main`,
 * else `index.js`). The driver must be built: the entry file is JavaScript, or TypeScript
 * that Node can run itself.
 *
 * @example
 * // Auto-detect from current directory
 * const driver = await loadDriver({})
 *
 * // Load explicit package
 * const driver = await loadDriver({ driverPackage: 'ya-modbus-driver-xymd1' })
 *
 * @param options - Loading options (defaults to local package detection)
 * @param deps - System dependencies (for testing, uses Node.js built-ins by default)
 * @returns Loaded driver with createDriver function and optional configuration metadata
 * @throws Error if driver cannot be loaded or is invalid
 */
export async function loadDriver(
  options: LoadDriverOptions = {},
  deps: SystemDependencies = defaultDeps
): Promise<LoadedDriver> {
  const { driverPackage, logger = console } = options

  try {
    let packageName: string
    let driverModule: unknown

    if (driverPackage) {
      const candidates = getDriverPackageCandidates(driverPackage)

      for (const candidate of candidates) {
        const cached = driverCache.get(candidate)
        if (cached) {
          cacheStats.hits++
          return cached
        }
      }

      cacheStats.misses++

      const imported = await importDriverPackage(driverPackage, candidates, deps)
      packageName = imported.packageName
      driverModule = imported.driverModule
    } else {
      const localPackage = await detectLocalPackage(deps)
      packageName = localPackage.name

      const cached = driverCache.get(packageName)
      if (cached) {
        cacheStats.hits++
        return cached
      }

      cacheStats.misses++

      driverModule = await importLocalDriver(packageName, localPackage.entryPoint, deps)
    }

    if (!driverModule || typeof driverModule !== 'object') {
      throw new ValidationError(
        'Driver package must export a createDriver function',
        'createDriver'
      )
    }

    const { createDriver, DEVICES, DEFAULT_CONFIG, SUPPORTED_CONFIG } = driverModule as {
      createDriver?: unknown
      DEVICES?: unknown
      DEFAULT_CONFIG?: unknown
      SUPPORTED_CONFIG?: unknown
    }

    if (!createDriver) {
      throw new ValidationError(
        'Driver package must export a createDriver function',
        'createDriver'
      )
    }

    if (typeof createDriver !== 'function') {
      throw new ValidationError(
        'Driver package must export a createDriver function',
        'createDriver'
      )
    }

    const result: LoadedDriver = {
      createDriver: createDriver as CreateDriverFunction,
    }

    if (DEVICES !== null && DEVICES !== undefined) {
      result.devices = validateDevices(DEVICES, logger)
    }

    if (DEFAULT_CONFIG !== null && DEFAULT_CONFIG !== undefined) {
      result.defaultConfig = validateDefaultConfig(DEFAULT_CONFIG)
    }

    if (SUPPORTED_CONFIG !== null && SUPPORTED_CONFIG !== undefined) {
      result.supportedConfig = validateSupportedConfig(SUPPORTED_CONFIG)
    }

    if (result.defaultConfig && result.supportedConfig) {
      const warnings = crossValidateConfigs(result.defaultConfig, result.supportedConfig)
      if (warnings.length > 0) {
        outputConfigWarnings('Driver DEFAULT_CONFIG', warnings, logger)
      }
    }

    driverCache.set(packageName, result)

    return result
  } catch (error) {
    if (
      error instanceof ValidationError ||
      error instanceof DriverNotFoundError ||
      error instanceof DriverNotBuiltError ||
      error instanceof PackageJsonError
    ) {
      throw error
    }

    if (error instanceof Error) {
      throw new Error(`Failed to load driver: ${error.message}`, { cause: error })
    }

    throw new Error('Failed to load driver: Unknown error')
  }
}

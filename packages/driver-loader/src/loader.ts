import { readFile } from 'fs/promises'
import { join } from 'path'

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
import { DriverNotFoundError, PackageJsonError, ValidationError } from './errors.js'

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
 */
export interface Logger {
  /** Log warning messages */
  warn: (message: string) => void
  /** Log debug messages (optional) */
  debug?: (message: string) => void
}

/**
 * Driver loading options
 */
export interface LoadDriverOptions {
  /**
   * Explicit driver package name
   * e.g., 'ya-modbus-driver-xymd1' or '@org/driver-pkg'
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
  importModule: (modulePath: string) => Promise<unknown>
  getCwd: () => string
}

/**
 * Default system dependencies using Node.js built-ins
 */
/* istanbul ignore next */
const defaultDeps: SystemDependencies = {
  /* istanbul ignore next */
  readFile: (path: string, encoding: 'utf-8') => readFile(path, encoding),
  /* istanbul ignore next */
  importModule: (modulePath: string) => import(modulePath),
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
 * Auto-detect local driver package from package.json
 *
 * @param deps - System dependencies
 * @returns Package name if valid driver package
 * @throws Error if not a valid driver package
 */
async function detectLocalPackage(deps: SystemDependencies): Promise<string> {
  try {
    const packageJsonPath = join(deps.getCwd(), 'package.json')
    const packageJsonContent = await deps.readFile(packageJsonPath, 'utf-8')
    const packageJson = JSON.parse(packageJsonContent) as {
      name?: string
      keywords?: string[]
    }

    const keywords = packageJson.keywords ?? []
    if (!keywords.includes('ya-modbus-driver')) {
      throw new PackageJsonError(
        'Current package is not a ya-modbus driver. ' +
          'Add "ya-modbus-driver" to keywords in package.json'
      )
    }

    const name = packageJson.name
    if (!name) {
      throw new PackageJsonError('package.json must have a "name" field')
    }

    return name
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new PackageJsonError(
        'package.json not found in current directory. ' +
          'Run this command from a driver package directory or specify --driver'
      )
    }
    if (error instanceof SyntaxError) {
      throw new PackageJsonError('Failed to parse package.json: invalid JSON')
    }
    throw error
  }
}

/**
 * Try to import a module with multiple path attempts
 *
 * @param paths - Array of module paths to try
 * @param deps - System dependencies
 * @returns Imported module
 * @throws Error if all paths fail
 */
async function tryImport(paths: string[], deps: SystemDependencies): Promise<unknown> {
  const errors: Error[] = []

  for (const path of paths) {
    try {
      return await deps.importModule(path)
    } catch (error) {
      errors.push(error as Error)
    }
  }

  const lastError = errors[errors.length - 1]
  throw new Error(
    `Failed to import module from any path. Tried: ${paths.join(', ')}\nLast error: ${lastError?.message}`,
    { cause: lastError }
  )
}

/**
 * Load a driver package dynamically
 *
 * Supports two modes:
 * 1. Explicit package: `loadDriver({ driverPackage: 'ya-modbus-driver-xymd1' })`
 * 2. Auto-detect from cwd: `loadDriver({})` - reads package.json from current directory
 *
 * Auto-detection checks for `ya-modbus-driver` keyword in package.json keywords.
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
      packageName = driverPackage

      const cached = driverCache.get(packageName)
      if (cached) {
        cacheStats.hits++
        return cached
      }

      cacheStats.misses++

      try {
        driverModule = await deps.importModule(driverPackage)
      } catch {
        throw new DriverNotFoundError(
          `Driver package not found: ${driverPackage}\nInstall it with: npm install ${driverPackage}`,
          driverPackage
        )
      }
    } else {
      packageName = await detectLocalPackage(deps)

      const cached = driverCache.get(packageName)
      if (cached) {
        cacheStats.hits++
        return cached
      }

      cacheStats.misses++

      const cwd = deps.getCwd()

      const importPaths = [
        join(cwd, 'src', 'index.js'),
        join(cwd, 'src', 'index.ts'),
        join(cwd, 'dist', 'index.js'),
        packageName,
      ]

      driverModule = await tryImport(importPaths, deps)
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

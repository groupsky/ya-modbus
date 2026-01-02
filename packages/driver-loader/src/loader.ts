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
  validateDefaultConfig,
  validateDevices,
  validateSupportedConfig,
} from './config-validator.js'

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
 * Driver loading options
 */
export interface LoadDriverOptions {
  /**
   * Explicit driver package name
   * e.g., 'ya-modbus-driver-xymd1' or '@org/driver-pkg'
   */
  driverPackage?: string
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
      throw new Error(
        'Current package is not a ya-modbus driver. ' +
          'Add "ya-modbus-driver" to keywords in package.json'
      )
    }

    const name = packageJson.name
    if (!name) {
      throw new Error('package.json must have a "name" field')
    }

    return name
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        'package.json not found in current directory. ' +
          'Run this command from a driver package directory or specify --driver'
      )
    }
    if (error instanceof SyntaxError) {
      throw new Error('Failed to parse package.json: invalid JSON')
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

  throw new Error(
    `Failed to import module from any path. Tried: ${paths.join(', ')}\nLast error: ${errors[errors.length - 1]?.message}`
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
  const { driverPackage } = options

  try {
    let driverModule: unknown

    if (driverPackage) {
      try {
        driverModule = await deps.importModule(driverPackage)
      } catch {
        throw new Error(
          `Driver package not found: ${driverPackage}\nInstall it with: npm install ${driverPackage}`
        )
      }
    } else {
      const packageName = await detectLocalPackage(deps)
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
      throw new Error('Driver package must export a createDriver function')
    }

    const { createDriver, DEVICES, DEFAULT_CONFIG, SUPPORTED_CONFIG } = driverModule as {
      createDriver?: unknown
      DEVICES?: unknown
      DEFAULT_CONFIG?: unknown
      SUPPORTED_CONFIG?: unknown
    }

    if (!createDriver) {
      throw new Error('Driver package must export a createDriver function')
    }

    if (typeof createDriver !== 'function') {
      throw new Error('Driver package must export a createDriver function')
    }

    const result: LoadedDriver = {
      createDriver: createDriver as CreateDriverFunction,
    }

    if (DEVICES !== null && DEVICES !== undefined) {
      result.devices = validateDevices(DEVICES)
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
        console.warn('\nWarning: Driver DEFAULT_CONFIG has inconsistencies:')
        for (const warning of warnings) {
          console.warn(`  - ${warning}`)
        }
        console.warn('  This may indicate a driver authoring error\n')
        console.warn('Run: ya-modbus show-defaults --driver <package> to inspect configuration\n')
      }
    }

    return result
  } catch (error) {
    if (error instanceof Error) {
      const isCustomError =
        error.message.startsWith('Driver package') ||
        error.message.includes('ya-modbus driver') ||
        error.message.includes('package.json') ||
        error.message.includes('createDriver')

      if (isCustomError) {
        throw error
      }

      throw new Error(`Failed to load driver: ${error.message}`)
    }

    throw new Error('Failed to load driver: Unknown error')
  }
}

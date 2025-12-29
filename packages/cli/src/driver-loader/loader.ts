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

  /**
   * Load from current working directory (for development)
   * Auto-detects driver from package.json
   */
  localPackage?: boolean
}

/**
 * Auto-detect local driver package from package.json
 *
 * @returns Package name if valid driver package
 * @throws Error if not a valid driver package
 */
async function detectLocalPackage(): Promise<string> {
  try {
    const packageJsonPath = join(process.cwd(), 'package.json')
    const packageJsonContent = await readFile(packageJsonPath, 'utf-8')
    const packageJson = JSON.parse(packageJsonContent) as {
      name?: string
      keywords?: string[]
    }

    // Check if package has ya-modbus-driver keyword
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
    throw error
  }
}

/**
 * Try to import a module with multiple path attempts
 *
 * @param paths - Array of module paths to try
 * @returns Imported module
 * @throws Error if all paths fail
 */
async function tryImport(paths: string[]): Promise<unknown> {
  const errors: Error[] = []

  for (const path of paths) {
    try {
      return await import(path)
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
 * // Auto-detect from current directory (preferred for CLI commands)
 * const driver = await loadDriver({})
 *
 * // Load explicit package
 * const driver = await loadDriver({ driverPackage: 'ya-modbus-driver-xymd1' })
 *
 * @param options - Loading options (defaults to local package detection)
 * @returns Loaded driver with createDriver function and optional configuration metadata
 * @throws Error if driver cannot be loaded or is invalid
 */
export async function loadDriver(options: LoadDriverOptions = {}): Promise<LoadedDriver> {
  const { driverPackage, localPackage } = options

  // Validate that at most one option is provided
  if (driverPackage && localPackage) {
    throw new Error('Cannot specify both localPackage and driverPackage')
  }

  // Default to local package detection when nothing specified
  const useLocalPackage = !driverPackage && (localPackage ?? true)

  try {
    let driverModule: unknown

    if (useLocalPackage) {
      // Auto-detect and load local package
      const packageName = await detectLocalPackage()

      // Try multiple import paths for local development
      const importPaths = [
        join(process.cwd(), 'src', 'index.js'), // TypeScript compiled
        join(process.cwd(), 'src', 'index.ts'), // TypeScript source
        join(process.cwd(), 'dist', 'index.js'), // Built output
        packageName, // Fallback to package name (if symlinked)
      ]

      driverModule = await tryImport(importPaths)
    } else {
      // Load explicit package (driverPackage is guaranteed to be defined here)
      const pkg = driverPackage as string
      try {
        driverModule = await import(pkg)
      } catch {
        throw new Error(`Driver package not found: ${pkg}\nInstall it with: npm install ${pkg}`)
      }
    }

    // Validate that module exports createDriver
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
      throw new Error('createDriver must be a function')
    }

    if (createDriver.length !== 1) {
      throw new Error(
        `Invalid createDriver signature: expected 1 parameter, got ${createDriver.length}.\n` +
          'Fix: export const createDriver = (config: DriverConfig) => Promise<DeviceDriver>\n' +
          'See: CreateDriverFunction type in @ya-modbus/driver-types'
      )
    }

    // Build result object conditionally to satisfy exactOptionalPropertyTypes
    const result: LoadedDriver = {
      createDriver: createDriver as CreateDriverFunction,
    }

    // Validate and add DEVICES if present
    if (DEVICES !== null && DEVICES !== undefined) {
      result.devices = validateDevices(DEVICES)
    }

    // Validate and add DEFAULT_CONFIG if present
    if (DEFAULT_CONFIG !== null && DEFAULT_CONFIG !== undefined) {
      result.defaultConfig = validateDefaultConfig(DEFAULT_CONFIG)
    }

    // Validate and add SUPPORTED_CONFIG if present
    if (SUPPORTED_CONFIG !== null && SUPPORTED_CONFIG !== undefined) {
      result.supportedConfig = validateSupportedConfig(SUPPORTED_CONFIG)
    }

    // Cross-validate DEFAULT_CONFIG against SUPPORTED_CONFIG if both are present
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
    // Re-throw our custom errors (they already have helpful messages)
    if (error instanceof Error) {
      const isCustomError =
        error.message.startsWith('Driver package') ||
        error.message.includes('ya-modbus driver') ||
        error.message.includes('package.json') ||
        error.message.includes('createDriver')

      if (isCustomError) {
        throw error
      }

      // Wrap unexpected errors
      throw new Error(`Failed to load driver: ${error.message}`)
    }

    throw new Error('Failed to load driver: Unknown error')
  }
}

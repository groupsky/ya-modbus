import { readFile } from 'fs/promises'
import { join } from 'path'

import type { CreateDriverFunction, DefaultConfig, SupportedConfig } from '@ya-modbus/driver-types'

/**
 * Loaded driver module with configuration metadata
 */
export interface LoadedDriver {
  /** Driver factory function */
  createDriver: CreateDriverFunction

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
  let lastError: Error | undefined

  for (const path of paths) {
    try {
      return await import(path)
    } catch (error) {
      lastError = error as Error
    }
  }

  throw lastError ?? new Error('Failed to import module from any path')
}

/**
 * Load a driver package dynamically
 *
 * Supports two modes:
 * 1. Explicit package name: `loadDriver({ driverPackage: 'ya-modbus-driver-xymd1' })`
 * 2. Auto-detect local: `loadDriver({ localPackage: true })` - reads from cwd package.json
 *
 * @param options - Loading options
 * @returns Loaded driver with createDriver function and optional configuration metadata
 * @throws Error if driver cannot be loaded or is invalid
 */
export async function loadDriver(options: LoadDriverOptions): Promise<LoadedDriver> {
  const { driverPackage, localPackage } = options

  // Validate that exactly one option is provided
  if (!driverPackage && !localPackage) {
    throw new Error('Either localPackage or driverPackage must be specified')
  }

  if (driverPackage && localPackage) {
    throw new Error('Cannot specify both localPackage and driverPackage')
  }

  try {
    let driverModule: unknown

    if (localPackage) {
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
    } else if (driverPackage) {
      // Load explicit package
      try {
        driverModule = await import(driverPackage)
      } catch {
        throw new Error(
          `Driver package not found: ${driverPackage}\n` +
            `Install it with: npm install ${driverPackage}`
        )
      }
    }

    // Validate that module exports createDriver
    if (!driverModule || typeof driverModule !== 'object') {
      throw new Error('Driver package must export a createDriver function')
    }

    const { createDriver, DEFAULT_CONFIG, SUPPORTED_CONFIG } = driverModule as {
      createDriver?: unknown
      DEFAULT_CONFIG?: unknown
      SUPPORTED_CONFIG?: unknown
    }

    if (!createDriver) {
      throw new Error('Driver package must export a createDriver function')
    }

    if (typeof createDriver !== 'function') {
      throw new Error('createDriver must be a function')
    }

    // Build result object conditionally to satisfy exactOptionalPropertyTypes
    const result: LoadedDriver = {
      createDriver: createDriver as CreateDriverFunction,
    }

    // Validate and add DEFAULT_CONFIG if present
    if (
      DEFAULT_CONFIG !== null &&
      DEFAULT_CONFIG !== undefined &&
      typeof DEFAULT_CONFIG === 'object'
    ) {
      // Runtime validation for third-party drivers
      const config = DEFAULT_CONFIG as Record<string, unknown>

      // Check if it's a serial config (has baudRate)
      if ('baudRate' in config) {
        if (typeof config['baudRate'] !== 'number') {
          throw new Error(
            `Invalid DEFAULT_CONFIG: baudRate must be a number, got ${typeof config['baudRate']}.\n` +
              'Fix: export const DEFAULT_CONFIG = { baudRate: 9600, ... } // number, not string'
          )
        }
        if ('parity' in config && typeof config['parity'] !== 'string') {
          throw new Error(
            `Invalid DEFAULT_CONFIG: parity must be a string, got ${typeof config['parity']}.\n` +
              'Fix: export const DEFAULT_CONFIG = { parity: "even", ... } // string: "none", "even", or "odd"'
          )
        }
        if ('dataBits' in config && typeof config['dataBits'] !== 'number') {
          throw new Error(
            `Invalid DEFAULT_CONFIG: dataBits must be a number, got ${typeof config['dataBits']}.\n` +
              'Fix: export const DEFAULT_CONFIG = { dataBits: 8, ... } // number: 7 or 8'
          )
        }
        if ('stopBits' in config && typeof config['stopBits'] !== 'number') {
          throw new Error(
            `Invalid DEFAULT_CONFIG: stopBits must be a number, got ${typeof config['stopBits']}.\n` +
              'Fix: export const DEFAULT_CONFIG = { stopBits: 1, ... } // number: 1 or 2'
          )
        }
        if ('defaultAddress' in config && typeof config['defaultAddress'] !== 'number') {
          throw new Error(
            `Invalid DEFAULT_CONFIG: defaultAddress must be a number, got ${typeof config['defaultAddress']}.\n` +
              'Fix: export const DEFAULT_CONFIG = { defaultAddress: 1, ... } // number: 1-247'
          )
        }
      }
      // Check if it's a TCP config (has defaultPort but not baudRate)
      else if ('defaultPort' in config) {
        if (typeof config['defaultPort'] !== 'number') {
          throw new Error(
            `Invalid DEFAULT_CONFIG: defaultPort must be a number, got ${typeof config['defaultPort']}.\n` +
              'Fix: export const DEFAULT_CONFIG = { defaultPort: 502, ... } // number'
          )
        }
        if ('defaultAddress' in config && typeof config['defaultAddress'] !== 'number') {
          throw new Error(
            `Invalid DEFAULT_CONFIG: defaultAddress must be a number, got ${typeof config['defaultAddress']}.\n` +
              'Fix: export const DEFAULT_CONFIG = { defaultAddress: 1, ... } // number: 1-247'
          )
        }
      }

      result.defaultConfig = DEFAULT_CONFIG as DefaultConfig
    }

    // Validate and add SUPPORTED_CONFIG if present
    if (
      SUPPORTED_CONFIG !== null &&
      SUPPORTED_CONFIG !== undefined &&
      typeof SUPPORTED_CONFIG === 'object'
    ) {
      // Runtime validation for third-party drivers
      const config = SUPPORTED_CONFIG as Record<string, unknown>

      if ('validBaudRates' in config && !Array.isArray(config['validBaudRates'])) {
        throw new Error(
          `Invalid SUPPORTED_CONFIG: validBaudRates must be an array, got ${typeof config['validBaudRates']}.\n` +
            'Fix: export const SUPPORTED_CONFIG = { validBaudRates: [9600, 19200], ... }'
        )
      }
      if ('validParity' in config && !Array.isArray(config['validParity'])) {
        throw new Error(
          `Invalid SUPPORTED_CONFIG: validParity must be an array, got ${typeof config['validParity']}.\n` +
            'Fix: export const SUPPORTED_CONFIG = { validParity: ["none", "even", "odd"], ... }'
        )
      }
      if ('validDataBits' in config && !Array.isArray(config['validDataBits'])) {
        throw new Error(
          `Invalid SUPPORTED_CONFIG: validDataBits must be an array, got ${typeof config['validDataBits']}.\n` +
            'Fix: export const SUPPORTED_CONFIG = { validDataBits: [7, 8], ... }'
        )
      }
      if ('validStopBits' in config && !Array.isArray(config['validStopBits'])) {
        throw new Error(
          `Invalid SUPPORTED_CONFIG: validStopBits must be an array, got ${typeof config['validStopBits']}.\n` +
            'Fix: export const SUPPORTED_CONFIG = { validStopBits: [1, 2], ... }'
        )
      }
      if ('validAddressRange' in config && !Array.isArray(config['validAddressRange'])) {
        throw new Error(
          `Invalid SUPPORTED_CONFIG: validAddressRange must be an array, got ${typeof config['validAddressRange']}.\n` +
            'Fix: export const SUPPORTED_CONFIG = { validAddressRange: [1, 247], ... }'
        )
      }

      result.supportedConfig = SUPPORTED_CONFIG as SupportedConfig
    }

    return result
  } catch (error) {
    // Re-throw our custom errors
    if (error instanceof Error && error.message.startsWith('Driver package')) {
      throw error
    }
    if (error instanceof Error && error.message.includes('ya-modbus driver')) {
      throw error
    }
    if (error instanceof Error && error.message.includes('package.json')) {
      throw error
    }
    if (error instanceof Error && error.message.includes('createDriver')) {
      throw error
    }

    // Wrap unexpected errors
    throw new Error(`Failed to load driver: ${(error as Error).message}`)
  }
}

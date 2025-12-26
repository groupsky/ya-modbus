import { readFile } from 'fs/promises'
import { join } from 'path'

import type { CreateDriverFunction, DefaultConfig, SupportedConfig } from '@ya-modbus/driver-types'

import { validateDefaultConfig, validateSupportedConfig } from './config-validator.js'

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
    if (DEFAULT_CONFIG !== null && DEFAULT_CONFIG !== undefined) {
      result.defaultConfig = validateDefaultConfig(DEFAULT_CONFIG)
    }

    // Validate and add SUPPORTED_CONFIG if present
    if (SUPPORTED_CONFIG !== null && SUPPORTED_CONFIG !== undefined) {
      result.supportedConfig = validateSupportedConfig(SUPPORTED_CONFIG)
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

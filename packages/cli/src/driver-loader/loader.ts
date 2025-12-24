import type { CreateDriverFunction } from '@ya-modbus/driver-types'
import { readFile } from 'fs/promises'
import { join } from 'path'

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
    const packageJson = JSON.parse(packageJsonContent)

    // Check if package has ya-modbus-driver keyword
    const keywords = packageJson.keywords || []
    if (!keywords.includes('ya-modbus-driver')) {
      throw new Error(
        'Current package is not a ya-modbus driver. ' +
          'Add "ya-modbus-driver" to keywords in package.json'
      )
    }

    return packageJson.name
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

  throw lastError
}

/**
 * Load a driver package dynamically
 *
 * Supports two modes:
 * 1. Explicit package name: `loadDriver({ driverPackage: 'ya-modbus-driver-xymd1' })`
 * 2. Auto-detect local: `loadDriver({ localPackage: true })` - reads from cwd package.json
 *
 * @param options - Loading options
 * @returns CreateDriver function from the driver package
 * @throws Error if driver cannot be loaded or is invalid
 */
export async function loadDriver(options: LoadDriverOptions): Promise<CreateDriverFunction> {
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
      } catch (error) {
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

    const { createDriver } = driverModule as { createDriver?: unknown }

    if (!createDriver) {
      throw new Error('Driver package must export a createDriver function')
    }

    if (typeof createDriver !== 'function') {
      throw new Error('createDriver must be a function')
    }

    return createDriver as CreateDriverFunction
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

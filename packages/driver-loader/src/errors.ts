/**
 * Custom error classes for driver-loader
 *
 * These error classes provide better error handling and type safety
 * compared to string-based error detection.
 */

/**
 * Error thrown when driver configuration validation fails
 *
 * @example
 * ```typescript
 * import { loadDriver, ValidationError } from '@ya-modbus/driver-loader'
 *
 * try {
 *   await loadDriver({ driverPackage: 'my-driver' })
 * } catch (error) {
 *   if (error instanceof ValidationError) {
 *     console.error(`Validation failed for field: ${error.field}`)
 *     console.error(`Message: ${error.message}`)
 *   }
 * }
 * ```
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message)
    this.name = 'ValidationError'
    Object.setPrototypeOf(this, ValidationError.prototype)
  }
}

/**
 * Error thrown when a driver package cannot be found or loaded
 *
 * @example
 * ```typescript
 * import { loadDriver, DriverNotFoundError } from '@ya-modbus/driver-loader'
 *
 * try {
 *   await loadDriver({ driverPackage: 'missing-driver' })
 * } catch (error) {
 *   if (error instanceof DriverNotFoundError) {
 *     console.error(`Package not found: ${error.packageName}`)
 *     console.error(`Install with: npm install ${error.packageName}`)
 *   }
 * }
 * ```
 */
export class DriverNotFoundError extends Error {
  constructor(
    message: string,
    public readonly packageName: string
  ) {
    super(message)
    this.name = 'DriverNotFoundError'
    Object.setPrototypeOf(this, DriverNotFoundError.prototype)
  }
}

/**
 * Error thrown when package.json is not found or invalid
 *
 * @example
 * ```typescript
 * import { loadDriver, PackageJsonError } from '@ya-modbus/driver-loader'
 *
 * try {
 *   await loadDriver({}) // Auto-detect from current directory
 * } catch (error) {
 *   if (error instanceof PackageJsonError) {
 *     console.error('package.json issue:', error.message)
 *     // Examples: missing file, invalid JSON, missing keywords
 *   }
 * }
 * ```
 */
export class PackageJsonError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PackageJsonError'
    Object.setPrototypeOf(this, PackageJsonError.prototype)
  }
}

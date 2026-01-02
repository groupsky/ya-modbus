/**
 * Custom error classes for driver-loader
 *
 * These error classes provide better error handling and type safety
 * compared to string-based error detection.
 */

/**
 * Error thrown when driver configuration validation fails
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
 */
export class PackageJsonError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PackageJsonError'
    Object.setPrototypeOf(this, PackageJsonError.prototype)
  }
}

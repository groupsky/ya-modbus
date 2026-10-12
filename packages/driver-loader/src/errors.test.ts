import {
  DriverNotBuiltError,
  DriverNotFoundError,
  PackageJsonError,
  ValidationError,
} from './errors.js'

describe('ValidationError', () => {
  test('should create ValidationError with message only', () => {
    const error = new ValidationError('Invalid configuration')

    expect(error).toBeInstanceOf(ValidationError)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Invalid configuration')
    expect(error.name).toBe('ValidationError')
    expect(error.field).toBeUndefined()
  })

  test('should create ValidationError with field', () => {
    const error = new ValidationError('baudRate must be a number', 'baudRate')

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.message).toBe('baudRate must be a number')
    expect(error.field).toBe('baudRate')
  })
})

describe('DriverNotFoundError', () => {
  test('should create DriverNotFoundError with package name', () => {
    const error = new DriverNotFoundError(
      'Driver package not found: ya-modbus-driver-test',
      'ya-modbus-driver-test'
    )

    expect(error).toBeInstanceOf(DriverNotFoundError)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Driver package not found: ya-modbus-driver-test')
    expect(error.name).toBe('DriverNotFoundError')
    expect(error.packageName).toBe('ya-modbus-driver-test')
  })

  test('should keep the error that caused it', () => {
    const cause = new Error('Unexpected token')
    const error = new DriverNotFoundError(
      'Failed to load driver package',
      'ya-modbus-driver-test',
      {
        cause,
      }
    )

    expect(error.cause).toBe(cause)
  })
})

describe('DriverNotBuiltError', () => {
  test('should create DriverNotBuiltError with package name and cause', () => {
    const cause = new Error("Cannot find module '/proj/dist/index.js'")
    const error = new DriverNotBuiltError('Cannot load driver', 'ya-modbus-driver-test', { cause })

    expect(error).toBeInstanceOf(DriverNotBuiltError)
    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(DriverNotFoundError)
    expect(error.message).toBe('Cannot load driver')
    expect(error.name).toBe('DriverNotBuiltError')
    expect(error.packageName).toBe('ya-modbus-driver-test')
    expect(error.cause).toBe(cause)
  })
})

describe('PackageJsonError', () => {
  test('should create PackageJsonError', () => {
    const error = new PackageJsonError('package.json not found')

    expect(error).toBeInstanceOf(PackageJsonError)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('package.json not found')
    expect(error.name).toBe('PackageJsonError')
  })
})

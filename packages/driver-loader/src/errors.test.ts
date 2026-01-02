import { DriverNotFoundError, PackageJsonError, ValidationError } from './errors.js'

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

import { isMissingPackageError } from './module-errors.js'

function nodeError(message: string, code?: string): Error {
  return Object.assign(new Error(message), code === undefined ? {} : { code })
}

describe('isMissingPackageError', () => {
  test.each([
    [
      'ESM',
      nodeError(
        "Cannot find package 'ya-modbus-driver-foo' imported from /app/x.js",
        'ERR_MODULE_NOT_FOUND'
      ),
    ],
    [
      'CommonJS',
      nodeError(
        "Cannot find module 'ya-modbus-driver-foo'\nRequire stack:\n- /app/x.js",
        'MODULE_NOT_FOUND'
      ),
    ],
  ])('detects a package that is not installed (%s)', (_style, error) => {
    expect(isMissingPackageError(error, 'ya-modbus-driver-foo')).toBe(true)
  })

  test.each([
    [
      'a missing dependency of the package',
      nodeError(
        "Cannot find package 'modbus-serial' imported from /app/foo.js",
        'ERR_MODULE_NOT_FOUND'
      ),
    ],
    ['a failure that is not about a missing module', nodeError("Unexpected token '<'")],
    [
      'an error code that is not about a missing module',
      nodeError("Cannot find package 'ya-modbus-driver-foo'", 'ERR_OTHER'),
    ],
    ['a thrown string', 'ya-modbus-driver-foo'],
    ['a thrown null', null],
  ])('does not detect %s', (_description, error) => {
    expect(isMissingPackageError(error, 'ya-modbus-driver-foo')).toBe(false)
  })
})

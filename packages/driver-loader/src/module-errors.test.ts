import { getNotBuiltCause, isMissingPackageError } from './module-errors.js'

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

describe('getNotBuiltCause', () => {
  test.each([
    [
      'a missing file of an ESM package',
      nodeError(
        "Cannot find module '/proj/node_modules/foo/dist/index.js' imported from /app/loader.js",
        'ERR_MODULE_NOT_FOUND'
      ),
      'missing-file',
    ],
    [
      'a missing main of an ESM package',
      nodeError(
        "Cannot find package '/proj/node_modules/foo/dist/index.js' imported from /app/loader.js",
        'ERR_MODULE_NOT_FOUND'
      ),
      'missing-file',
    ],
    [
      'a missing file of a CommonJS package',
      nodeError(
        'Cannot find module \'/proj/node_modules/foo/dist/index.js\'. Please verify that the package.json has a valid "main" entry',
        'MODULE_NOT_FOUND'
      ),
      'missing-file',
    ],
    [
      'a missing file on Windows',
      nodeError(
        "Cannot find module 'C:\\proj\\dist\\index.js' imported from C:\\app\\loader.js",
        'ERR_MODULE_NOT_FOUND'
      ),
      'missing-file',
    ],
    [
      'TypeScript that Node cannot load',
      nodeError(
        'Unknown file extension ".ts" for /proj/src/index.ts',
        'ERR_UNKNOWN_FILE_EXTENSION'
      ),
      'typescript',
    ],
    [
      'TypeScript with syntax that cannot be stripped',
      nodeError(
        'TypeScript enum is not supported in strip-only mode',
        'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX'
      ),
      'typescript-unsupported',
    ],
    [
      'TypeScript source that imports a file that is only there as .ts',
      nodeError(
        "Cannot find module '/proj/src/device.js' imported from /proj/src/index.ts",
        'ERR_MODULE_NOT_FOUND'
      ),
      'typescript-unsupported',
    ],
    [
      'TypeScript that Node cannot load, under node_modules',
      nodeError(
        'Unknown file extension ".ts" for /proj/node_modules/foo/src/index.ts',
        'ERR_UNKNOWN_FILE_EXTENSION'
      ),
      'typescript-in-node-modules',
    ],
    [
      'TypeScript under node_modules',
      nodeError(
        'Stripping types is currently unsupported for files under node_modules',
        'ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING'
      ),
      'typescript-in-node-modules',
    ],
  ])('detects %s', (_description, error, expected) => {
    expect(getNotBuiltCause(error)).toBe(expected)
  })

  test.each([
    [
      'a package that is not installed (ESM)',
      nodeError("Cannot find package 'foo' imported from /app/loader.js", 'ERR_MODULE_NOT_FOUND'),
    ],
    [
      'a package that is not installed (CommonJS)',
      nodeError("Cannot find module 'foo'\nRequire stack:\n- /app/loader.js", 'MODULE_NOT_FOUND'),
    ],
    [
      'a scoped package that is not installed',
      nodeError(
        "Cannot find package '@ya-modbus/driver-foo' imported from /app/loader.js",
        'ERR_MODULE_NOT_FOUND'
      ),
    ],
    [
      'a missing dependency of the driver',
      nodeError(
        "Cannot find package 'modbus-serial' imported from /proj/dist/index.js",
        'ERR_MODULE_NOT_FOUND'
      ),
    ],
    [
      'a missing module without a name in the message',
      nodeError('Missing', 'ERR_MODULE_NOT_FOUND'),
    ],
    ['an error without a message', { code: 'ERR_MODULE_NOT_FOUND' }],
    [
      'a file type that is not TypeScript',
      nodeError(
        'Unknown file extension ".tsx" for /proj/src/index.tsx',
        'ERR_UNKNOWN_FILE_EXTENSION'
      ),
    ],
    ['an unrelated error code', nodeError("Cannot find module '/proj/dist/index.js'", 'ERR_OTHER')],
    ['an error without a code', nodeError("Unexpected token '<'")],
    ['a thrown string', '/proj/dist/index.js'],
    ['a thrown null', null],
  ])('does not detect %s', (_description, error) => {
    expect(getNotBuiltCause(error)).toBeUndefined()
  })

  describe('for a local driver with a known entry file', () => {
    const entry = '/proj/dist/index.js'

    test('detects the missing entry file', () => {
      const error = nodeError(
        `Cannot find module '${entry}' imported from /app/loader.js`,
        'ERR_MODULE_NOT_FOUND'
      )

      expect(getNotBuiltCause(error, entry)).toBe('missing-file')
    })

    test('does not detect another missing file of a built driver', () => {
      const error = nodeError(
        "Cannot find module '/proj/dist/utils' imported from /proj/dist/index.js",
        'ERR_MODULE_NOT_FOUND'
      )

      expect(getNotBuiltCause(error, entry)).toBeUndefined()
    })

    test('detects TypeScript source that imports a missing file', () => {
      const error = nodeError(
        "Cannot find module '/proj/src/device.js' imported from /proj/src/index.ts",
        'ERR_MODULE_NOT_FOUND'
      )

      expect(getNotBuiltCause(error, '/proj/src/index.ts')).toBe('typescript-unsupported')
    })
  })
})

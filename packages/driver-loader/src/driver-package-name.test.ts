import {
  DRIVER_PACKAGE_NAME_RULE,
  assertValidDriverPackageName,
  isValidDriverPackageName,
} from './driver-package-name.js'
import { ValidationError } from './errors.js'

describe('isValidDriverPackageName', () => {
  test.each([
    ['monorepo driver', '@ya-modbus/driver-xymd1'],
    ['unscoped third-party driver', 'ya-modbus-driver-solar'],
    ['scoped third-party driver', '@org/ya-modbus-driver-solar'],
    ['scope with hyphens', '@my-org/ya-modbus-driver-solar'],
    ['scope starting with a digit', '@3d-org/ya-modbus-driver-solar'],
    ['name with digits and hyphens', 'ya-modbus-driver-sungrow-sh5k-20'],
    ['scoped name with digits and hyphens', '@org/ya-modbus-driver-sungrow-sh5k-20'],
    ['one character name', '@ya-modbus/driver-x'],
  ])('accepts %s (%s)', (_description, name) => {
    expect(isValidDriverPackageName(name)).toBe(true)
  })

  test.each([
    ['empty string', ''],
    ['unrelated package', 'lodash'],
    ['plain name', 'my-driver'],
    ['scoped package without the driver prefix', '@org/not-a-driver'],
    ['scoped package with a driver-like name only', '@org/driver-solar'],
    ['monorepo scope with empty name', '@ya-modbus/driver-'],
    ['unscoped with empty name', 'ya-modbus-driver-'],
    ['third-party scope with empty name', '@org/ya-modbus-driver-'],
    ['empty scope', '@/ya-modbus-driver-solar'],
    ['scope without a package', '@org'],
    ['scope with a trailing slash', '@org/'],
    ['missing at sign in scope', 'org/ya-modbus-driver-solar'],
    ['scope starting with a hyphen', '@-org/ya-modbus-driver-solar'],
    ['uppercase in name', 'ya-modbus-driver-Solar'],
    ['uppercase in scope', '@Org/ya-modbus-driver-solar'],
    ['underscore in name', 'ya-modbus-driver-so_lar'],
    ['dot in name', 'ya-modbus-driver-so.lar'],
    ['dot in scope', '@or.g/ya-modbus-driver-solar'],
    ['sub path of unscoped driver', 'ya-modbus-driver-solar/evil'],
    ['sub path of scoped driver', '@org/ya-modbus-driver-solar/evil'],
    ['extra scope segment', '@org/team/ya-modbus-driver-solar'],
    ['parent directory', '../x'],
    ['parent directories', '../../malicious-code'],
    ['relative path', './ya-modbus-driver-solar'],
    ['absolute path', '/opt/ya-modbus-driver-solar'],
    ['traversal after the unscoped prefix', 'ya-modbus-driver-../evil'],
    ['traversal in the middle', 'ya-modbus-driver-test/../../hack'],
    ['traversal after the monorepo prefix', '@ya-modbus/driver-../evil'],
    ['traversal as scope', '@../ya-modbus-driver-solar'],
    ['traversal between scope and name', '@org/../ya-modbus-driver-solar'],
    ['backslash traversal', 'ya-modbus-driver-test\\..\\evil'],
    ['backslash in scoped name', '@org\\ya-modbus-driver-solar'],
    ['windows path', 'C:\\drivers\\ya-modbus-driver-solar'],
    ['file URL', 'file:///opt/ya-modbus-driver-solar'],
    ['percent encoded traversal', 'ya-modbus-driver-%2e%2e'],
    ['leading space', ' ya-modbus-driver-solar'],
    ['trailing space', 'ya-modbus-driver-solar '],
    ['trailing newline', 'ya-modbus-driver-solar\n'],
    ['null character', 'ya-modbus-driver-so\u0000lar'],
  ])('rejects %s (%j)', (_description, name) => {
    expect(isValidDriverPackageName(name)).toBe(false)
  })

  test.each([
    ['undefined', undefined],
    ['null', null],
    ['number', 42],
    ['object', {}],
    ['array', ['ya-modbus-driver-solar']],
  ])('rejects a value that is not a string: %s', (_description, value) => {
    expect(isValidDriverPackageName(value)).toBe(false)
  })
})

describe('assertValidDriverPackageName', () => {
  test.each(['@ya-modbus/driver-xymd1', 'ya-modbus-driver-solar', '@org/ya-modbus-driver-solar'])(
    'does not throw for %s',
    (name) => {
      expect(() => assertValidDriverPackageName(name)).not.toThrow()
    }
  )

  test('throws a ValidationError for the driverPackage field', () => {
    const thrown = (() => {
      try {
        assertValidDriverPackageName('../x')
      } catch (error) {
        return error
      }
      return undefined
    })()

    expect(thrown).toBeInstanceOf(ValidationError)
    expect((thrown as ValidationError).field).toBe('driverPackage')
  })

  test('message shows the rejected name and lists every allowed form', () => {
    expect(() => assertValidDriverPackageName('@org/not-a-driver')).toThrow(
      'Invalid driver package name "@org/not-a-driver": ' + DRIVER_PACKAGE_NAME_RULE
    )
    expect(DRIVER_PACKAGE_NAME_RULE).toContain('@ya-modbus/driver-<name>')
    expect(DRIVER_PACKAGE_NAME_RULE).toContain('ya-modbus-driver-<name>')
    expect(DRIVER_PACKAGE_NAME_RULE).toContain('@<scope>/ya-modbus-driver-<name>')
    expect(DRIVER_PACKAGE_NAME_RULE).toContain('lowercase letters, numbers and hyphens')
  })

  test('message escapes control characters in the rejected name', () => {
    expect(() => assertValidDriverPackageName('ya-modbus-driver-\u001b[31mred')).toThrow(
      'Invalid driver package name "ya-modbus-driver-\\u001b[31mred"'
    )
  })
})

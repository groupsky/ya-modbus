import { getDriverPackageCandidates } from './driver-name.js'

describe('getDriverPackageCandidates', () => {
  test.each([
    ['xymd1', ['@ya-modbus/driver-xymd1', 'ya-modbus-driver-xymd1', 'xymd1']],
    ['ex9em', ['@ya-modbus/driver-ex9em', 'ya-modbus-driver-ex9em', 'ex9em']],
    ['or-we-516', ['@ya-modbus/driver-or-we-516', 'ya-modbus-driver-or-we-516', 'or-we-516']],
    [
      'my_driver.v2',
      ['@ya-modbus/driver-my_driver.v2', 'ya-modbus-driver-my_driver.v2', 'my_driver.v2'],
    ],
  ])('expands short name %s to the scoped, unscoped and literal package', (name, expected) => {
    expect(getDriverPackageCandidates(name)).toEqual(expected)
  })

  test.each([
    '@ya-modbus/driver-xymd1',
    '@org/ya-modbus-driver-foo',
    '@org/driver-pkg',
    'ya-modbus-driver-xymd1',
    './local/driver',
    '../driver',
    '/abs/path/to/driver',
    'file:///abs/path/to/driver/index.js',
    'C:\\drivers\\foo',
    'scope/not-a-scope',
    'Upper-Case',
    '',
  ])('keeps %p unchanged', (name) => {
    expect(getDriverPackageCandidates(name)).toEqual([name])
  })
})

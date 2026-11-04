import { describe, it, expect } from '@jest/globals'

import { getDriverPackageCandidates } from './driver-name.js'

describe('getDriverPackageCandidates', () => {
  it('should try only the two prefixed forms for a short name', () => {
    expect(getDriverPackageCandidates('xymd1')).toEqual([
      '@ya-modbus/driver-xymd1',
      'ya-modbus-driver-xymd1',
    ])
  })

  it.each(['@ya-modbus/driver-xymd1', 'ya-modbus-driver-test', '@org/ya-modbus-driver-test'])(
    'should use the full package name %s as given',
    (name) => {
      expect(getDriverPackageCandidates(name)).toEqual([name])
    }
  )

  it.each(['../x', 'file:../x', 'file:x', './x', '/x', 'x.y', 'X', '-x', '', 'lodash/x'])(
    'should give no packages for %p',
    (name) => {
      expect(getDriverPackageCandidates(name)).toEqual([])
    }
  )
})

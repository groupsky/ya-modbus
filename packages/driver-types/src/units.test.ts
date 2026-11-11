/**
 * Type-level tests for the Unit type
 */

import type { Unit } from './units.js'

describe('Unit', () => {
  it('should accept time units from milliseconds to hours', () => {
    const units = ['ms', 's', 'min', 'h'] as const satisfies readonly Unit[]

    expect(units).toEqual(['ms', 's', 'min', 'h'])
  })

  it('should accept resistance units in ohms and megaohms', () => {
    const units = ['Ω', 'MΩ'] as const satisfies readonly Unit[]

    expect(units).toEqual(['Ω', 'MΩ'])
  })

  it('should reject a unit that is not in the list', () => {
    // @ts-expect-error -- 'msec' is not a standard unit
    const unit: Unit = 'msec'

    expect(unit).toBe('msec')
  })
})

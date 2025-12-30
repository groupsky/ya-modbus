/**
 * Tests for driver-sdk public API exports
 */

import * as driverSdk from './index'

describe('driver-sdk exports', () => {
  it('should export codec utilities', () => {
    expect(driverSdk.readScaledUInt16BE).toBeDefined()
    expect(driverSdk.readScaledInt16BE).toBeDefined()
    expect(driverSdk.readScaledUInt32BE).toBeDefined()
    expect(driverSdk.writeScaledUInt16BE).toBeDefined()
    expect(driverSdk.writeScaledInt16BE).toBeDefined()
  })

  it('should export validator utilities', () => {
    expect(driverSdk.createEnumValidator).toBeDefined()
    expect(driverSdk.createRangeValidator).toBeDefined()
    expect(driverSdk.validateInteger).toBeDefined()
  })

  it('should export error formatting utilities', () => {
    expect(driverSdk.formatRangeError).toBeDefined()
    expect(driverSdk.formatEnumError).toBeDefined()
  })
})

/**
 * Tests for buffer encoding/decoding utilities
 */

import {
  readScaledUInt16BE,
  readScaledInt16BE,
  readScaledUInt32BE,
  writeScaledUInt16BE,
  writeScaledInt16BE,
} from './codec'

describe('readScaledUInt16BE', () => {
  it('should read and scale uint16 with scale 10', () => {
    const buffer = Buffer.from([0x00, 0x64]) // 100
    const value = readScaledUInt16BE(buffer, 0, 10)
    expect(value).toBe(10.0)
  })

  it('should read and scale uint16 with scale 100', () => {
    const buffer = Buffer.from([0x27, 0x10]) // 10000
    const value = readScaledUInt16BE(buffer, 0, 100)
    expect(value).toBe(100.0)
  })

  it('should read and scale uint16 with scale 1000', () => {
    const buffer = Buffer.from([0x03, 0xe8]) // 1000
    const value = readScaledUInt16BE(buffer, 0, 1000)
    expect(value).toBe(1.0)
  })

  it('should handle offset reading', () => {
    const buffer = Buffer.from([0xff, 0xff, 0x00, 0x64, 0xff, 0xff])
    const value = readScaledUInt16BE(buffer, 2, 10)
    expect(value).toBe(10.0)
  })

  it('should handle zero value', () => {
    const buffer = Buffer.from([0x00, 0x00])
    const value = readScaledUInt16BE(buffer, 0, 10)
    expect(value).toBe(0.0)
  })

  it('should handle max uint16 value', () => {
    const buffer = Buffer.from([0xff, 0xff]) // 65535
    const value = readScaledUInt16BE(buffer, 0, 10)
    expect(value).toBe(6553.5)
  })
})

describe('readScaledInt16BE', () => {
  it('should read and scale positive int16', () => {
    const buffer = Buffer.from([0x00, 0x64]) // 100
    const value = readScaledInt16BE(buffer, 0, 10)
    expect(value).toBe(10.0)
  })

  it('should read and scale negative int16', () => {
    const buffer = Buffer.from([0xff, 0x9c]) // -100
    const value = readScaledInt16BE(buffer, 0, 10)
    expect(value).toBe(-10.0)
  })

  it('should handle zero value', () => {
    const buffer = Buffer.from([0x00, 0x00])
    const value = readScaledInt16BE(buffer, 0, 10)
    expect(value).toBe(0.0)
  })

  it('should handle offset reading', () => {
    const buffer = Buffer.from([0xff, 0xff, 0xff, 0x9c, 0xff, 0xff])
    const value = readScaledInt16BE(buffer, 2, 10)
    expect(value).toBe(-10.0)
  })

  it('should handle max positive int16', () => {
    const buffer = Buffer.from([0x7f, 0xff]) // 32767
    const value = readScaledInt16BE(buffer, 0, 10)
    expect(value).toBe(3276.7)
  })

  it('should handle max negative int16', () => {
    const buffer = Buffer.from([0x80, 0x00]) // -32768
    const value = readScaledInt16BE(buffer, 0, 10)
    expect(value).toBe(-3276.8)
  })
})

describe('readScaledUInt32BE', () => {
  it('should read and scale uint32 with scale 100', () => {
    const buffer = Buffer.from([0x00, 0x00, 0x27, 0x10]) // 10000
    const value = readScaledUInt32BE(buffer, 0, 100)
    expect(value).toBe(100.0)
  })

  it('should read and scale large uint32', () => {
    const buffer = Buffer.from([0x00, 0x98, 0x96, 0x80]) // 10000000
    const value = readScaledUInt32BE(buffer, 0, 100)
    expect(value).toBe(100000.0)
  })

  it('should handle offset reading', () => {
    const buffer = Buffer.from([0xff, 0xff, 0x00, 0x00, 0x27, 0x10, 0xff, 0xff])
    const value = readScaledUInt32BE(buffer, 2, 100)
    expect(value).toBe(100.0)
  })

  it('should handle zero value', () => {
    const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00])
    const value = readScaledUInt32BE(buffer, 0, 100)
    expect(value).toBe(0.0)
  })

  it('should handle max uint32 value', () => {
    const buffer = Buffer.from([0xff, 0xff, 0xff, 0xff]) // 4294967295
    const value = readScaledUInt32BE(buffer, 0, 100)
    expect(value).toBe(42949672.95)
  })
})

describe('writeScaledUInt16BE', () => {
  it('should encode and scale uint16 with scale 10', () => {
    const buffer = writeScaledUInt16BE(10.0, 10)
    expect(buffer.readUInt16BE(0)).toBe(100)
  })

  it('should encode and scale uint16 with scale 100', () => {
    const buffer = writeScaledUInt16BE(100.0, 100)
    expect(buffer.readUInt16BE(0)).toBe(10000)
  })

  it('should truncate fractional parts', () => {
    const buffer = writeScaledUInt16BE(10.7, 10)
    expect(buffer.readUInt16BE(0)).toBe(107)
  })

  it('should handle zero value', () => {
    const buffer = writeScaledUInt16BE(0, 10)
    expect(buffer.readUInt16BE(0)).toBe(0)
  })

  it('should handle decimal values correctly', () => {
    const buffer = writeScaledUInt16BE(23.5, 10)
    expect(buffer.readUInt16BE(0)).toBe(235)
  })
})

describe('writeScaledInt16BE', () => {
  it('should encode and scale positive int16', () => {
    const buffer = writeScaledInt16BE(10.0, 10)
    expect(buffer.readInt16BE(0)).toBe(100)
  })

  it('should encode and scale negative int16', () => {
    const buffer = writeScaledInt16BE(-10.0, 10)
    expect(buffer.readInt16BE(0)).toBe(-100)
  })

  it('should truncate fractional parts', () => {
    const buffer = writeScaledInt16BE(10.7, 10)
    expect(buffer.readInt16BE(0)).toBe(107)
  })

  it('should truncate negative fractional parts', () => {
    const buffer = writeScaledInt16BE(-10.7, 10)
    expect(buffer.readInt16BE(0)).toBe(-107)
  })

  it('should handle zero value', () => {
    const buffer = writeScaledInt16BE(0, 10)
    expect(buffer.readInt16BE(0)).toBe(0)
  })

  it('should use Math.trunc for rounding toward zero', () => {
    // Positive: 10.9 * 10 = 109 (not 110)
    const buffer1 = writeScaledInt16BE(10.9, 10)
    expect(buffer1.readInt16BE(0)).toBe(109)

    // Negative: -10.9 * 10 = -109 (not -110)
    const buffer2 = writeScaledInt16BE(-10.9, 10)
    expect(buffer2.readInt16BE(0)).toBe(-109)
  })
})

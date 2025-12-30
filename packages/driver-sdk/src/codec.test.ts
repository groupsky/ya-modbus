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

describe('Edge case validation', () => {
  describe('readScaledUInt16BE validation', () => {
    it('should throw on division by zero (scale=0)', () => {
      const buffer = Buffer.from([0x00, 0x64])
      expect(() => readScaledUInt16BE(buffer, 0, 0)).toThrow(
        'Invalid scale: must be greater than 0'
      )
    })

    it('should throw on negative scale', () => {
      const buffer = Buffer.from([0x00, 0x64])
      expect(() => readScaledUInt16BE(buffer, 0, -10)).toThrow(
        'Invalid scale: must be greater than 0'
      )
    })

    it('should throw on NaN scale', () => {
      const buffer = Buffer.from([0x00, 0x64])
      expect(() => readScaledUInt16BE(buffer, 0, NaN)).toThrow(
        'Invalid scale: must be a finite number'
      )
    })

    it('should throw on Infinity scale', () => {
      const buffer = Buffer.from([0x00, 0x64])
      expect(() => readScaledUInt16BE(buffer, 0, Infinity)).toThrow(
        'Invalid scale: must be a finite number'
      )
    })

    it('should throw on -Infinity scale', () => {
      const buffer = Buffer.from([0x00, 0x64])
      expect(() => readScaledUInt16BE(buffer, 0, -Infinity)).toThrow(
        'Invalid scale: must be a finite number'
      )
    })
  })

  describe('readScaledInt16BE validation', () => {
    it('should throw on division by zero (scale=0)', () => {
      const buffer = Buffer.from([0x00, 0x64])
      expect(() => readScaledInt16BE(buffer, 0, 0)).toThrow('Invalid scale: must be greater than 0')
    })

    it('should throw on negative scale', () => {
      const buffer = Buffer.from([0x00, 0x64])
      expect(() => readScaledInt16BE(buffer, 0, -10)).toThrow(
        'Invalid scale: must be greater than 0'
      )
    })

    it('should throw on NaN scale', () => {
      const buffer = Buffer.from([0x00, 0x64])
      expect(() => readScaledInt16BE(buffer, 0, NaN)).toThrow(
        'Invalid scale: must be a finite number'
      )
    })

    it('should throw on Infinity scale', () => {
      const buffer = Buffer.from([0x00, 0x64])
      expect(() => readScaledInt16BE(buffer, 0, Infinity)).toThrow(
        'Invalid scale: must be a finite number'
      )
    })
  })

  describe('readScaledUInt32BE validation', () => {
    it('should throw on division by zero (scale=0)', () => {
      const buffer = Buffer.from([0x00, 0x00, 0x27, 0x10])
      expect(() => readScaledUInt32BE(buffer, 0, 0)).toThrow(
        'Invalid scale: must be greater than 0'
      )
    })

    it('should throw on negative scale', () => {
      const buffer = Buffer.from([0x00, 0x00, 0x27, 0x10])
      expect(() => readScaledUInt32BE(buffer, 0, -100)).toThrow(
        'Invalid scale: must be greater than 0'
      )
    })

    it('should throw on NaN scale', () => {
      const buffer = Buffer.from([0x00, 0x00, 0x27, 0x10])
      expect(() => readScaledUInt32BE(buffer, 0, NaN)).toThrow(
        'Invalid scale: must be a finite number'
      )
    })
  })

  describe('writeScaledUInt16BE validation', () => {
    it('should throw on NaN value', () => {
      expect(() => writeScaledUInt16BE(NaN, 10)).toThrow('Invalid value: must be a finite number')
    })

    it('should throw on Infinity value', () => {
      expect(() => writeScaledUInt16BE(Infinity, 10)).toThrow(
        'Invalid value: must be a finite number'
      )
    })

    it('should throw on -Infinity value', () => {
      expect(() => writeScaledUInt16BE(-Infinity, 10)).toThrow(
        'Invalid value: must be a finite number'
      )
    })

    it('should throw on negative scale', () => {
      expect(() => writeScaledUInt16BE(10, -10)).toThrow('Invalid scale: must be greater than 0')
    })

    it('should throw on scale=0', () => {
      expect(() => writeScaledUInt16BE(10, 0)).toThrow('Invalid scale: must be greater than 0')
    })

    it('should throw on NaN scale', () => {
      expect(() => writeScaledUInt16BE(10, NaN)).toThrow('Invalid scale: must be a finite number')
    })

    it('should throw when scaled value exceeds max uint16', () => {
      expect(() => writeScaledUInt16BE(6553.6, 10)).toThrow(
        'Invalid scaled value: 65536 is outside uint16 range (0 to 65535)'
      )
    })

    it('should throw when value is negative', () => {
      expect(() => writeScaledUInt16BE(-1, 10)).toThrow(
        'Invalid scaled value: -10 is outside uint16 range (0 to 65535)'
      )
    })

    it('should allow max valid value', () => {
      const buffer = writeScaledUInt16BE(6553.5, 10)
      expect(buffer.readUInt16BE(0)).toBe(65535)
    })
  })

  describe('writeScaledInt16BE validation', () => {
    it('should throw on NaN value', () => {
      expect(() => writeScaledInt16BE(NaN, 10)).toThrow('Invalid value: must be a finite number')
    })

    it('should throw on Infinity value', () => {
      expect(() => writeScaledInt16BE(Infinity, 10)).toThrow(
        'Invalid value: must be a finite number'
      )
    })

    it('should throw on -Infinity value', () => {
      expect(() => writeScaledInt16BE(-Infinity, 10)).toThrow(
        'Invalid value: must be a finite number'
      )
    })

    it('should throw on negative scale', () => {
      expect(() => writeScaledInt16BE(10, -10)).toThrow('Invalid scale: must be greater than 0')
    })

    it('should throw on scale=0', () => {
      expect(() => writeScaledInt16BE(10, 0)).toThrow('Invalid scale: must be greater than 0')
    })

    it('should throw on NaN scale', () => {
      expect(() => writeScaledInt16BE(10, NaN)).toThrow('Invalid scale: must be a finite number')
    })

    it('should throw when scaled value exceeds max int16', () => {
      expect(() => writeScaledInt16BE(3276.8, 10)).toThrow(
        'Invalid scaled value: 32768 is outside int16 range (-32768 to 32767)'
      )
    })

    it('should throw when scaled value exceeds min int16', () => {
      expect(() => writeScaledInt16BE(-3276.9, 10)).toThrow(
        'Invalid scaled value: -32769 is outside int16 range (-32768 to 32767)'
      )
    })

    it('should allow max valid positive value', () => {
      const buffer = writeScaledInt16BE(3276.7, 10)
      expect(buffer.readInt16BE(0)).toBe(32767)
    })

    it('should allow max valid negative value', () => {
      const buffer = writeScaledInt16BE(-3276.8, 10)
      expect(buffer.readInt16BE(0)).toBe(-32768)
    })
  })
})

/**
 * Tests for buffer encoding/decoding utilities
 */

import {
  readScaledUInt16BE,
  readScaledInt16BE,
  readScaledUInt32BE,
  writeScaledUInt16BE,
  writeScaledInt16BE,
  readFloatBE,
  writeFloatBE,
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
    it.each([
      {
        scale: 0,
        expected: 'Invalid scale: must be greater than 0',
        desc: 'division by zero (scale=0)',
      },
      { scale: -10, expected: 'Invalid scale: must be greater than 0', desc: 'negative scale' },
      { scale: NaN, expected: 'Invalid scale: must be a finite number', desc: 'NaN scale' },
      {
        scale: Infinity,
        expected: 'Invalid scale: must be a finite number',
        desc: 'Infinity scale',
      },
      {
        scale: -Infinity,
        expected: 'Invalid scale: must be a finite number',
        desc: '-Infinity scale',
      },
    ])('should throw on $desc', ({ scale, expected }) => {
      const buffer = Buffer.from([0x00, 0x64])
      expect(() => readScaledUInt16BE(buffer, 0, scale)).toThrow(expected)
    })

    it('should throw when buffer is too small', () => {
      const buffer = Buffer.from([0x00]) // Only 1 byte, need 2
      expect(() => readScaledUInt16BE(buffer, 0, 10)).toThrow(
        'Insufficient buffer size for uint16: need 2 bytes at offset 0, but only 1 bytes available (buffer length: 1)'
      )
    })

    it('should throw when offset leaves insufficient bytes', () => {
      const buffer = Buffer.from([0x00, 0x64, 0x00]) // 3 bytes
      expect(() => readScaledUInt16BE(buffer, 2, 10)).toThrow(
        'Insufficient buffer size for uint16: need 2 bytes at offset 2, but only 1 bytes available (buffer length: 3)'
      )
    })

    it('should throw when buffer is empty', () => {
      const buffer = Buffer.from([])
      expect(() => readScaledUInt16BE(buffer, 0, 10)).toThrow(
        'Insufficient buffer size for uint16: need 2 bytes at offset 0, but only 0 bytes available (buffer length: 0)'
      )
    })
  })

  describe('readScaledInt16BE validation', () => {
    it.each([
      {
        scale: 0,
        expected: 'Invalid scale: must be greater than 0',
        desc: 'division by zero (scale=0)',
      },
      { scale: -10, expected: 'Invalid scale: must be greater than 0', desc: 'negative scale' },
      { scale: NaN, expected: 'Invalid scale: must be a finite number', desc: 'NaN scale' },
      {
        scale: Infinity,
        expected: 'Invalid scale: must be a finite number',
        desc: 'Infinity scale',
      },
    ])('should throw on $desc', ({ scale, expected }) => {
      const buffer = Buffer.from([0x00, 0x64])
      expect(() => readScaledInt16BE(buffer, 0, scale)).toThrow(expected)
    })

    it('should throw when buffer is too small', () => {
      const buffer = Buffer.from([0x00]) // Only 1 byte, need 2
      expect(() => readScaledInt16BE(buffer, 0, 10)).toThrow(
        'Insufficient buffer size for int16: need 2 bytes at offset 0, but only 1 bytes available (buffer length: 1)'
      )
    })

    it('should throw when offset leaves insufficient bytes', () => {
      const buffer = Buffer.from([0xff, 0x9c, 0x00]) // 3 bytes
      expect(() => readScaledInt16BE(buffer, 2, 10)).toThrow(
        'Insufficient buffer size for int16: need 2 bytes at offset 2, but only 1 bytes available (buffer length: 3)'
      )
    })

    it('should throw when buffer is empty', () => {
      const buffer = Buffer.from([])
      expect(() => readScaledInt16BE(buffer, 0, 10)).toThrow(
        'Insufficient buffer size for int16: need 2 bytes at offset 0, but only 0 bytes available (buffer length: 0)'
      )
    })
  })

  describe('readScaledUInt32BE validation', () => {
    it.each([
      {
        scale: 0,
        expected: 'Invalid scale: must be greater than 0',
        desc: 'division by zero (scale=0)',
      },
      { scale: -100, expected: 'Invalid scale: must be greater than 0', desc: 'negative scale' },
      { scale: NaN, expected: 'Invalid scale: must be a finite number', desc: 'NaN scale' },
    ])('should throw on $desc', ({ scale, expected }) => {
      const buffer = Buffer.from([0x00, 0x00, 0x27, 0x10])
      expect(() => readScaledUInt32BE(buffer, 0, scale)).toThrow(expected)
    })

    it('should throw when buffer is too small', () => {
      const buffer = Buffer.from([0x00, 0x00, 0x27]) // Only 3 bytes, need 4
      expect(() => readScaledUInt32BE(buffer, 0, 100)).toThrow(
        'Insufficient buffer size for uint32: need 4 bytes at offset 0, but only 3 bytes available (buffer length: 3)'
      )
    })

    it('should throw when offset leaves insufficient bytes', () => {
      const buffer = Buffer.from([0x00, 0x00, 0x27, 0x10, 0x00, 0x00]) // 6 bytes
      expect(() => readScaledUInt32BE(buffer, 3, 100)).toThrow(
        'Insufficient buffer size for uint32: need 4 bytes at offset 3, but only 3 bytes available (buffer length: 6)'
      )
    })

    it('should throw when buffer is empty', () => {
      const buffer = Buffer.from([])
      expect(() => readScaledUInt32BE(buffer, 0, 100)).toThrow(
        'Insufficient buffer size for uint32: need 4 bytes at offset 0, but only 0 bytes available (buffer length: 0)'
      )
    })
  })

  describe('writeScaledUInt16BE validation', () => {
    it.each([
      {
        value: NaN,
        scale: 10,
        expected: 'Invalid value: must be a finite number',
        desc: 'NaN value',
      },
      {
        value: Infinity,
        scale: 10,
        expected: 'Invalid value: must be a finite number',
        desc: 'Infinity value',
      },
      {
        value: -Infinity,
        scale: 10,
        expected: 'Invalid value: must be a finite number',
        desc: '-Infinity value',
      },
    ])('should throw on $desc', ({ value, scale, expected }) => {
      expect(() => writeScaledUInt16BE(value, scale)).toThrow(expected)
    })

    it.each([
      { scale: -10, expected: 'Invalid scale: must be greater than 0', desc: 'negative scale' },
      { scale: 0, expected: 'Invalid scale: must be greater than 0', desc: 'scale=0' },
      { scale: NaN, expected: 'Invalid scale: must be a finite number', desc: 'NaN scale' },
    ])('should throw on $desc', ({ scale, expected }) => {
      expect(() => writeScaledUInt16BE(10, scale)).toThrow(expected)
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
    it.each([
      {
        value: NaN,
        scale: 10,
        expected: 'Invalid value: must be a finite number',
        desc: 'NaN value',
      },
      {
        value: Infinity,
        scale: 10,
        expected: 'Invalid value: must be a finite number',
        desc: 'Infinity value',
      },
      {
        value: -Infinity,
        scale: 10,
        expected: 'Invalid value: must be a finite number',
        desc: '-Infinity value',
      },
    ])('should throw on $desc', ({ value, scale, expected }) => {
      expect(() => writeScaledInt16BE(value, scale)).toThrow(expected)
    })

    it.each([
      { scale: -10, expected: 'Invalid scale: must be greater than 0', desc: 'negative scale' },
      { scale: 0, expected: 'Invalid scale: must be greater than 0', desc: 'scale=0' },
      { scale: NaN, expected: 'Invalid scale: must be a finite number', desc: 'NaN scale' },
    ])('should throw on $desc', ({ scale, expected }) => {
      expect(() => writeScaledInt16BE(10, scale)).toThrow(expected)
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

describe('readFloatBE', () => {
  it('should read IEEE 754 float', () => {
    // 230.5 as IEEE 754 float: 0x4366_8000
    const buffer = Buffer.alloc(4)
    buffer.writeFloatBE(230.5, 0)
    const value = readFloatBE(buffer, 0)
    expect(value).toBeCloseTo(230.5, 5)
  })

  it('should read negative float', () => {
    const buffer = Buffer.alloc(4)
    buffer.writeFloatBE(-123.456, 0)
    const value = readFloatBE(buffer, 0)
    expect(value).toBeCloseTo(-123.456, 3)
  })

  it('should read zero', () => {
    const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00])
    const value = readFloatBE(buffer, 0)
    expect(value).toBe(0)
  })

  it('should handle offset reading', () => {
    const buffer = Buffer.alloc(8)
    buffer.writeFloatBE(999.999, 4)
    const value = readFloatBE(buffer, 4)
    expect(value).toBeCloseTo(999.999, 3)
  })

  it('should throw when buffer is too small', () => {
    const buffer = Buffer.from([0x00, 0x00, 0x00]) // Only 3 bytes, need 4
    expect(() => readFloatBE(buffer, 0)).toThrow(
      'Insufficient buffer size for float32: need 4 bytes at offset 0, but only 3 bytes available (buffer length: 3)'
    )
  })

  it('should throw when offset leaves insufficient bytes', () => {
    const buffer = Buffer.alloc(6) // 6 bytes
    expect(() => readFloatBE(buffer, 3)).toThrow(
      'Insufficient buffer size for float32: need 4 bytes at offset 3, but only 3 bytes available (buffer length: 6)'
    )
  })

  it('should throw when buffer is empty', () => {
    const buffer = Buffer.from([])
    expect(() => readFloatBE(buffer, 0)).toThrow(
      'Insufficient buffer size for float32: need 4 bytes at offset 0, but only 0 bytes available (buffer length: 0)'
    )
  })
})

describe('writeFloatBE', () => {
  it('should encode IEEE 754 float', () => {
    const buffer = writeFloatBE(230.5)
    expect(buffer.length).toBe(4)
    expect(buffer.readFloatBE(0)).toBeCloseTo(230.5, 5)
  })

  it('should encode negative float', () => {
    const buffer = writeFloatBE(-123.456)
    expect(buffer.readFloatBE(0)).toBeCloseTo(-123.456, 3)
  })

  it('should encode zero', () => {
    const buffer = writeFloatBE(0)
    expect(buffer.readFloatBE(0)).toBe(0)
  })

  it('should encode small values', () => {
    const buffer = writeFloatBE(0.001)
    expect(buffer.readFloatBE(0)).toBeCloseTo(0.001, 5)
  })

  it('should encode large values', () => {
    const buffer = writeFloatBE(1000000.0)
    expect(buffer.readFloatBE(0)).toBeCloseTo(1000000.0, 0)
  })

  it.each([
    { value: NaN, desc: 'NaN value' },
    { value: Infinity, desc: 'Infinity value' },
    { value: -Infinity, desc: '-Infinity value' },
  ])('should throw on $desc', ({ value }) => {
    expect(() => writeFloatBE(value)).toThrow('Invalid value: must be a finite number')
  })
})

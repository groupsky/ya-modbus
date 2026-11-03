import { decodeClock, decodeWeekDay, encodeClock, parseClock } from './clock'

/** Clock registers for Tue 2026-10-20 14:28:12, low byte of 1027 = 0x5a */
const CLOCK = Buffer.from([0x12, 0x28, 0x14, 0x03, 0x20, 0x10, 0x26, 0x5a])

describe('decodeClock', () => {
  it('should decode the BCD fields to a local date-time', () => {
    expect(decodeClock(CLOCK)).toBe('2026-10-20T14:28:12')
  })

  it('should pad single digits', () => {
    expect(decodeClock(Buffer.from([0x05, 0x04, 0x03, 0x01, 0x02, 0x01, 0x07, 0x00]))).toBe(
      '2007-01-02T03:04:05'
    )
  })
})

describe('decodeWeekDay', () => {
  it.each([
    [1, 0],
    [3, 2],
    [7, 6],
  ])('should map device week day %i to %i', (device, weekDay) => {
    const buffer = Buffer.from(CLOCK)
    buffer[3] = device
    expect(decodeWeekDay(buffer)).toBe(weekDay)
  })
})

describe('encodeClock', () => {
  it('should encode the fields in BCD and keep the low byte of 1027', () => {
    expect(encodeClock(parseClock('2026-10-20T14:28:12'), 0x995a)).toEqual([
      0x1228, 0x1403, 0x2010, 0x265a,
    ])
  })

  it.each([
    ['2026-10-25T03:00:05', 1],
    ['2026-10-31T00:00:00', 7],
    ['2000-01-01T00:00:00', 7],
    ['2099-12-31T23:59:59', 5],
  ])('should set the week day of %s to %i', (value, weekDay) => {
    expect((encodeClock(parseClock(value), 0)[1] as number) & 0xff).toBe(weekDay)
  })

  it('should round-trip through decodeClock', () => {
    const registers = encodeClock(parseClock('2031-02-28T09:07:30'), 0)
    const buffer = Buffer.alloc(8)
    registers.forEach((register, i) => buffer.writeUInt16BE(register, i * 2))
    expect(decodeClock(buffer)).toBe('2031-02-28T09:07:30')
    expect(decodeWeekDay(buffer)).toBe(5)
  })
})

describe('parseClock', () => {
  it('should return the fields', () => {
    expect(parseClock('2026-10-20T14:28:12')).toEqual({
      year: 2026,
      month: 10,
      day: 20,
      hours: 14,
      minutes: 28,
      seconds: 12,
    })
  })

  it.each([
    [1700000000000],
    [null],
    ['2026-10-20 14:28:12'],
    ['2026-10-20T14:28'],
    ['2026-10-20T14:28:12Z'],
    ['2026-10-20T14:28:12+03:00'],
  ])('should reject %p as the wrong form', (value) => {
    expect(() => parseClock(value)).toThrow('Expected a local date-time YYYY-MM-DDTHH:MM:SS')
  })

  it.each([
    '1999-12-31T23:59:59',
    '2100-01-01T00:00:00',
    '2026-02-29T00:00:00',
    '2026-13-01T00:00:00',
    '2026-00-01T00:00:00',
    '2026-04-31T00:00:00',
    '2026-10-20T24:00:00',
    '2026-10-20T14:60:00',
    '2026-10-20T14:28:60',
  ])('should reject %s as not a real date-time in range', (value) => {
    expect(() => parseClock(value)).toThrow('Expected a real date-time with year 2000-2099')
  })

  it('should take 29 February in a leap year', () => {
    expect(parseClock('2028-02-29T00:00:00').day).toBe(29)
  })
})

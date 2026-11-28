/**
 * The SR04 clock: holding registers 1024-1027, one BCD byte per field.
 *
 * - 1024: seconds (high byte), minutes (low byte)
 * - 1025: hours (high byte), week day 1-7 with 1 = Sunday (low byte, not BCD)
 * - 1026: day (high byte), month (low byte)
 * - 1027: year 00-99 (high byte), low byte not documented
 *
 * The clock has no time zone. It is shown as a local date-time without an offset,
 * for example `2026-10-20T14:28:12`.
 */

export const CLOCK_ADDRESS = 1024
export const CLOCK_REGISTERS = 4

const CLOCK_FORMAT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/

const bcdToNumber = (byte: number): number => (byte >> 4) * 10 + (byte & 0x0f)

const numberToBcd = (value: number): number => Math.floor(value / 10) * 16 + (value % 10)

const pad = (value: number): string => String(value).padStart(2, '0')

/** The clock as `YYYY-MM-DDTHH:MM:SS` from the 4 clock registers */
export function decodeClock(buffer: Buffer): string {
  const year = 2000 + bcdToNumber(buffer[6] as number)
  const month = bcdToNumber(buffer[5] as number)
  const day = bcdToNumber(buffer[4] as number)
  const hours = bcdToNumber(buffer[2] as number)
  const minutes = bcdToNumber(buffer[1] as number)
  const seconds = bcdToNumber(buffer[0] as number)
  return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

/** Week day of the clock, 0 = Sunday to 6 = Saturday */
export function decodeWeekDay(buffer: Buffer): number {
  return (buffer[3] as number) - 1
}

/**
 * Register values for a clock write, in write order (1024 first).
 *
 * @param clock - the clock, checked by `parseClock`
 * @param yearRegister - current value of register 1027; its low byte is kept
 */
export function encodeClock(clock: ClockFields, yearRegister: number): number[] {
  const { year, month, day, hours, minutes, seconds } = clock
  // Week day from the date, 1 = Sunday as the device counts
  const weekDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 1
  return [
    (numberToBcd(seconds) << 8) | numberToBcd(minutes),
    (numberToBcd(hours) << 8) | weekDay,
    (numberToBcd(day) << 8) | numberToBcd(month),
    (numberToBcd(year - 2000) << 8) | (yearRegister & 0xff),
  ]
}

export interface ClockFields {
  year: number
  month: number
  day: number
  hours: number
  minutes: number
  seconds: number
}

/**
 * Check a clock value before anything is written
 *
 * @throws Error if the value is not `YYYY-MM-DDTHH:MM:SS` with year 2000-2099 and a real date
 */
export function parseClock(value: unknown): ClockFields {
  const match = typeof value === 'string' ? CLOCK_FORMAT.exec(value) : null
  if (!match) {
    throw new Error(
      `Invalid clock: ${JSON.stringify(value)}. Expected a local date-time YYYY-MM-DDTHH:MM:SS`
    )
  }
  const [year, month, day, hours, minutes, seconds] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ]
  const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds))
  const valid =
    year >= 2000 &&
    year <= 2099 &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hours &&
    date.getUTCMinutes() === minutes &&
    date.getUTCSeconds() === seconds
  if (!valid) {
    throw new Error(
      `Invalid clock: ${JSON.stringify(value)}. Expected a real date-time with year 2000-2099`
    )
  }
  return { year, month, day, hours, minutes, seconds }
}

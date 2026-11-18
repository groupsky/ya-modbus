import { InvalidArgumentError } from 'commander'

/**
 * Commander option parser for flags that take a whole number (0 or more).
 * Rejects values like "abc", "1.5" or "100ms" instead of silently turning
 * them into NaN or keeping the leading digits as parseInt does.
 *
 * @param value - Raw option value from the command line
 * @returns Parsed whole number
 * @throws InvalidArgumentError when the value is not a whole number
 */
export function parseWholeNumberOption(value: string): number {
  if (!/^\d+$/.test(value.trim())) {
    throw new InvalidArgumentError('Expected a whole number (0, 1, 2, ...).')
  }
  return Number(value)
}

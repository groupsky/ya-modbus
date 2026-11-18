import { isValidDriverPackageName } from '@ya-modbus/driver-loader'

/** A driver name without a prefix, such as `xymd1` */
const SHORT_DRIVER_NAME = /^[a-z0-9][a-z0-9-]*$/

/**
 * Describes the allowed driver names, for error messages.
 * Written to follow "name must be ...".
 */
export const DRIVER_NAME_RULE =
  'a short name such as xymd1, or @ya-modbus/driver-<name>, ya-modbus-driver-<name> or ' +
  '@<scope>/ya-modbus-driver-<name>, where <name> and <scope> use only lowercase letters, ' +
  'numbers and hyphens'

/**
 * Packages to try, in order, for a driver name from the config
 *
 * A full driver package name is used as given. A short name such as `xymd1` stands for
 * `@ya-modbus/driver-xymd1`, then `ya-modbus-driver-xymd1`. Unlike the CLI, the bare name is
 * never tried: it would let a config load any npm package. Any other name gives no packages.
 */
export function getDriverPackageCandidates(name: string): string[] {
  if (isValidDriverPackageName(name)) return [name]
  if (!SHORT_DRIVER_NAME.test(name)) return []
  return [`@ya-modbus/driver-${name}`, `ya-modbus-driver-${name}`]
}

/**
 * Check a driver name from the config
 *
 * @returns true if the name is a full driver package name or a short name
 */
export function isValidDriverName(name: string): boolean {
  return getDriverPackageCandidates(name).length > 0
}

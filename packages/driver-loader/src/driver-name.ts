const SCOPED_PREFIX = '@ya-modbus/driver-'
const UNSCOPED_PREFIX = 'ya-modbus-driver-'

/** An unscoped npm package name that is not already a full driver package name */
const SHORT_NAME = /^[a-z0-9][a-z0-9._-]*$/

/** Package names to try, in order; never empty */
export type DriverPackageCandidates = [string, ...string[]]

/**
 * Packages to try, in order, for a driver name given by the user
 *
 * A short name such as `xymd1` stands for `@ya-modbus/driver-xymd1`, then
 * `ya-modbus-driver-xymd1`, then a package called `xymd1`. Anything else is a full
 * package name or a path and is used as given.
 */
export function getDriverPackageCandidates(name: string): DriverPackageCandidates {
  if (!SHORT_NAME.test(name) || name.startsWith(UNSCOPED_PREFIX)) {
    return [name]
  }

  return [`${SCOPED_PREFIX}${name}`, `${UNSCOPED_PREFIX}${name}`, name]
}

import { ValidationError } from './errors.js'

/**
 * Describes the allowed driver package names, for error messages.
 * Written to follow "name must be ...", so callers can put their own words in front.
 */
export const DRIVER_PACKAGE_NAME_RULE =
  'must be @ya-modbus/driver-<name>, ya-modbus-driver-<name> or @<scope>/ya-modbus-driver-<name>, ' +
  'where <name> and <scope> use only lowercase letters, numbers and hyphens'

/**
 * The three allowed forms. Only lowercase letters, numbers and hyphens can follow the prefix,
 * so a name can never contain a path separator, a dot, a backslash or a whitespace.
 */
const DRIVER_PACKAGE_NAME_PATTERN =
  /^(?:@ya-modbus\/driver-|(?:@[a-z0-9][a-z0-9-]*\/)?ya-modbus-driver-)[a-z0-9-]+$/

/**
 * Check a driver package name against the shared naming rule for drivers that are loaded
 * from a configured name, such as in the MQTT bridge.
 *
 * Allowed forms: `@ya-modbus/driver-<name>`, `ya-modbus-driver-<name>` and
 * `@<scope>/ya-modbus-driver-<name>`.
 *
 * @param name - Value to check
 * @returns true if the value is an allowed driver package name
 */
export function isValidDriverPackageName(name: unknown): boolean {
  return typeof name === 'string' && DRIVER_PACKAGE_NAME_PATTERN.test(name)
}

/**
 * Throw if a driver package name does not follow the naming rule.
 *
 * @param name - Driver package name to check
 * @throws ValidationError (field `driverPackage`) listing the allowed forms
 */
export function assertValidDriverPackageName(name: string): void {
  if (!isValidDriverPackageName(name)) {
    throw new ValidationError(
      `Invalid driver package name ${JSON.stringify(name)}: ${DRIVER_PACKAGE_NAME_RULE}`,
      'driverPackage'
    )
  }
}

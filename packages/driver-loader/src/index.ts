export { loadDriver, clearDriverCache, getDriverCacheStats } from './loader.js'
export type {
  LoadedDriver,
  LoadDriverOptions,
  SystemDependencies,
  DriverCacheStats,
  Logger,
} from './loader.js'
export {
  validateDefaultConfig,
  validateSupportedConfig,
  validateDevices,
  crossValidateConfigs,
} from './config-validator.js'
export { applyDriverDefaults, getEffectiveDriverMetadata } from './driver-defaults.js'
export type { SerialOptions } from './driver-defaults.js'
export { validateSerialOptions } from './serial-validation.js'
export {
  DRIVER_PACKAGE_NAME_RULE,
  assertValidDriverPackageName,
  isValidDriverPackageName,
} from './driver-package-name.js'
export {
  ValidationError,
  DriverNotFoundError,
  DriverNotBuiltError,
  PackageJsonError,
} from './errors.js'
export { getCallerPackageInfo } from './package-info.js'
export type { PackageInfo } from './package-info.js'

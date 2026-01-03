/**
 * @ya-modbus/device-profiler - Device profiler for discovering Modbus register maps
 */

export { classifyError, ErrorType } from './error-classifier.js'
export { formatProgress, formatSummary } from './console-formatter.js'
export { testRead, RegisterType, type ReadTestResult } from './read-tester.js'
export { scanRegisters, type ScanOptions, type ScanResult } from './register-scanner.js'
export {
  BYTES_PER_REGISTER,
  DEFAULT_BATCH_SIZE,
  MAX_PORT,
  MAX_SLAVE_ID,
  MIN_PORT,
  MIN_SLAVE_ID,
  PROGRESS_UPDATE_INTERVAL_MS,
} from './constants.js'

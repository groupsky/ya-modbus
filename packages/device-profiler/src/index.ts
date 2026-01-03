/**
 * @ya-modbus/device-profiler - Device profiler for discovering Modbus register maps
 */

export { classifyError, ErrorType } from './error-classifier.js'
export { testRead, RegisterType, type ReadTestResult } from './read-tester.js'
export { scanRegisters, type ScanOptions, type ScanResult } from './register-scanner.js'
export { formatProgress, formatSummary } from './console-formatter.js'

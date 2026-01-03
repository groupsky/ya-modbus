# Device Profiler Package

Scans Modbus devices to discover readable registers and create register maps.

## Purpose

Automates discovery of device register layouts through systematic scanning with batch optimization and error handling.

## Key Concepts

- **Error Classification**: Distinguishes between timeout, CRC, and Modbus exceptions
- **Read Testing**: Tests FC03 (holding) and FC04 (input) registers with timing measurement
- **Batch Scanning**: Attempts batch reads with automatic fallback to individual reads
- **Progress Tracking**: Real-time console feedback during scanning operations

## Architecture

- `src/error-classifier.ts` - Categorizes Modbus errors
- `src/read-tester.ts` - Tests register reads with timing
- `src/register-scanner.ts` - Core scanning logic with batch fallback
- `src/console-formatter.ts` - Progress display and summary tables
- `bin/profile.js` - CLI entry point

## Testing

- Mock transport for controlled error injection
- Test each error type classification
- Verify batch fallback behavior
- Test progress callbacks

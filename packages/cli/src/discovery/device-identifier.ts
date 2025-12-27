import type ModbusRTU from 'modbus-serial'

import type { LoadedDriver } from '../driver-loader/loader.js'
import { createModbusTransport } from '../transport/create-modbus-transport.js'

/**
 * Device identification result from discovery attempt
 * Provides comprehensive information about device presence and capabilities
 */
export interface DeviceIdentificationResult {
  /** Whether a Modbus device is present at this address/configuration */
  present: boolean

  /** Response time in milliseconds */
  responseTimeMs: number

  // Device identification data (from FC43)
  /** Vendor/manufacturer name (from FC43) */
  vendorName?: string

  /** Product code/identifier (from FC43) */
  productCode?: string

  /** Model name (from FC43) */
  modelName?: string

  /** Firmware/hardware revision (from FC43) */
  revision?: string

  // Function code support detection
  /** Whether device supports FC43 (Read Device Identification) */
  supportsFC43?: boolean

  /** Whether device supports FC03 (Read Holding Registers) */
  supportsFC03?: boolean

  /** Whether device supports FC04 (Read Input Registers) */
  supportsFC04?: boolean

  // Error classification
  /** Device present but returned Modbus exception code */
  exceptionCode?: number

  /** Request timed out (no response) */
  timeout?: boolean

  /** CRC check failed (wrong serial parameters) */
  crcError?: boolean
}

/**
 * Check if error is a Modbus exception (device present but unsupported function/address)
 */
function isModbusException(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'modbusCode' in error) {
    return error.modbusCode as number
  }
  return undefined
}

/**
 * Check if error is a timeout (device not responding)
 */
function isTimeout(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const err = error as { message?: string; errno?: string; code?: string }

  return Boolean(
    (err.message?.toLowerCase().includes('timeout') ?? false) ||
    err.errno === 'ETIMEDOUT' ||
    err.code === 'ETIMEDOUT'
  )
}

/**
 * Check if error is a CRC error (wrong serial parameters)
 */
function isCRCError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const err = error as { message?: string; errno?: string }

  return Boolean((err.message?.toLowerCase().includes('crc') ?? false) || err.errno === 'CRC')
}

/**
 * Try to identify device using FC43 (Read Device Identification)
 *
 * FC43/14 is the standard MEI (Modbus Encapsulated Interface) for device identification.
 * Not all devices or modbus-serial versions support this.
 */
async function tryFC43(client: ModbusRTU): Promise<Partial<DeviceIdentificationResult>> {
  // Check if client supports readDeviceIdentification
  if (
    typeof (client as { readDeviceIdentification?: unknown }).readDeviceIdentification !==
    'function'
  ) {
    return {}
  }

  try {
    const response = await client.readDeviceIdentification(1, 0) // Read basic identification, start from object 0

    // Build result object conditionally
    const result: Partial<DeviceIdentificationResult> = {
      present: true,
      supportsFC43: true,
    }

    // modbus-serial returns { data: { 0: "vendor", 1: "product", 2: "revision" }, conformityLevel }
    // where keys are object IDs: 0=VendorName, 1=ProductCode, 2=MajorMinorRevision
    if (response.data && typeof response.data === 'object') {
      const data = response.data as unknown as Record<number, string>

      // Object ID 0 = VendorName
      if (data[0]) {
        result.vendorName = data[0]
      }
      // Object ID 1 = ProductCode
      if (data[1]) {
        result.productCode = data[1]
      }
      // Object ID 2 = MajorMinorRevision
      if (data[2]) {
        result.revision = data[2]
      }
      // Note: modelName (object ID 7) requires a separate request with objectId=7
    }

    return result
  } catch (error) {
    const exceptionCode = isModbusException(error)
    if (exceptionCode !== undefined) {
      // Exception means device is present but doesn't support FC43
      return {
        present: true,
        supportsFC43: false,
        exceptionCode,
      }
    }

    // Other errors (timeout, CRC) will be handled by fallback
    throw error
  }
}

/**
 * Try to identify device using driver data points
 *
 * When a driver is available, we can use its data point definitions
 * to read actual device data, which is more reliable than generic probing.
 */
async function tryDriverDataPoint(
  client: ModbusRTU,
  driverMetadata: LoadedDriver,
  slaveId: number
): Promise<Partial<DeviceIdentificationResult>> {
  try {
    // Create transport wrapper around the ModbusRTU client
    // Use maxRetries=1 for discovery (no retries) to avoid 200ms retry delays
    const transport = createModbusTransport(client, 1)

    // Create driver instance
    const driver = await driverMetadata.createDriver({ transport, slaveId })

    // Find first readable data point (prefer input registers for sensors)
    const readableDataPoint = driver.dataPoints.find(
      (dp) => dp.access === 'r' || dp.access === 'rw'
    )

    if (!readableDataPoint) {
      // Driver has no readable data points, can't test
      return {}
    }

    // Try to read the data point
    await driver.readDataPoint(readableDataPoint.id)

    // Success! Device is present and driver works
    return {
      present: true,
    }
  } catch (error) {
    const exceptionCode = isModbusException(error)
    if (exceptionCode !== undefined) {
      // Exception means device is present (responded with error code)
      return {
        present: true,
        exceptionCode,
      }
    }

    // Timeout or CRC error - device not present with these parameters
    throw error
  }
}

/**
 * Try to identify device using FC04 (Read Input Registers)
 *
 * FC04 reads input registers (read-only data, typically sensor values).
 * Many sensor devices have input registers starting at 0 or 1.
 * Tries both addresses to maximize detection.
 */
async function tryFC04(client: ModbusRTU): Promise<Partial<DeviceIdentificationResult>> {
  // Try reading input register 1 first (common for sensors like XYMD1)
  try {
    await client.readInputRegisters(1, 1)

    return {
      present: true,
      supportsFC04: true,
    }
  } catch (error) {
    const exceptionCode = isModbusException(error)
    if (exceptionCode !== undefined) {
      // Exception from register 1, try register 0
      try {
        await client.readInputRegisters(0, 1)

        return {
          present: true,
          supportsFC04: true,
        }
      } catch (error2) {
        const exceptionCode2 = isModbusException(error2)
        if (exceptionCode2 !== undefined) {
          // Device present but no input registers at 0 or 1
          return {
            present: true,
            supportsFC04: false,
            exceptionCode: exceptionCode2,
          }
        }

        // Timeout or CRC error on second attempt
        throw error2
      }
    }

    // Timeout or CRC error - device not present with these parameters
    throw error
  }
}

/**
 * Try to identify device using FC03 (Read Holding Registers)
 *
 * FC03 reads holding registers (read-write data, typically configuration).
 * Attempts to read register 0, which most devices support.
 */
async function tryFC03(client: ModbusRTU): Promise<Partial<DeviceIdentificationResult>> {
  try {
    await client.readHoldingRegisters(0, 1)

    return {
      present: true,
      supportsFC03: true,
    }
  } catch (error) {
    const exceptionCode = isModbusException(error)
    if (exceptionCode !== undefined) {
      // Exception means device is present but register 0 not available
      return {
        present: true,
        supportsFC03: false,
        exceptionCode,
      }
    }

    // Timeout or CRC error - device not present with these parameters
    throw error
  }
}

/**
 * Attempt to identify a Modbus device at the current client configuration
 *
 * Tries multiple detection methods in priority order:
 * 1. Driver data points (if driver provided) - uses driver's register knowledge
 * 2. FC43 (Read Device Identification) - provides vendor/model info
 * 3. FC04 (Read Input Registers) - common for sensors
 * 4. FC03 (Read Holding Registers) - universal fallback
 *
 * @param client - Configured ModbusRTU client (address and serial params already set)
 * @param timeout - Response timeout in milliseconds
 * @param slaveId - Modbus slave ID currently being tested
 * @param driverMetadata - Optional loaded driver for driver-based detection
 * @returns Device identification result
 *
 * @example
 * ```typescript
 * const client = new ModbusRTU()
 * await client.connectRTUBuffered('/dev/ttyUSB0', { baudRate: 9600 })
 * client.setID(1)
 *
 * const result = await identifyDevice(client, 1000)
 * if (result.present) {
 *   console.log(`Found device: ${result.vendorName ?? 'Unknown'}`)
 * }
 * ```
 */
export async function identifyDevice(
  client: ModbusRTU,
  timeout: number,
  slaveId: number,
  driverMetadata?: LoadedDriver
): Promise<DeviceIdentificationResult> {
  const startTime = performance.now()

  // Set timeout on client (if method exists)
  if (typeof client.setTimeout === 'function') {
    client.setTimeout(timeout)
  }

  // Try driver-based detection first if driver is available
  if (driverMetadata) {
    try {
      const driverResult = await tryDriverDataPoint(client, driverMetadata, slaveId)

      if (driverResult.present) {
        const responseTime = Math.round((performance.now() - startTime) * 100) / 100

        const result: DeviceIdentificationResult = {
          present: driverResult.present,
          responseTimeMs: responseTime,
        }

        if (driverResult.exceptionCode !== undefined) {
          result.exceptionCode = driverResult.exceptionCode
        }

        return result
      }
    } catch (error) {
      // Driver-based detection failed, fall through to generic methods
      if (isTimeout(error)) {
        return {
          present: false,
          timeout: true,
          responseTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
        }
      }

      if (isCRCError(error)) {
        return {
          present: false,
          crcError: true,
          responseTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
        }
      }

      // Other error, fall through to generic detection
    }
  }

  try {
    // Try FC43 (provides device identification)
    const fc43Result = await tryFC43(client)

    // If FC43 succeeded (device present), return result
    if (fc43Result.present) {
      const responseTime = Math.round((performance.now() - startTime) * 100) / 100

      // Build complete result with all required properties
      const result: DeviceIdentificationResult = {
        present: fc43Result.present,
        responseTimeMs: responseTime,
      }

      // Add optional properties only if they exist
      if (fc43Result.supportsFC43 !== undefined) {
        result.supportsFC43 = fc43Result.supportsFC43
      }
      if (fc43Result.vendorName) {
        result.vendorName = fc43Result.vendorName
      }
      if (fc43Result.productCode) {
        result.productCode = fc43Result.productCode
      }
      if (fc43Result.modelName) {
        result.modelName = fc43Result.modelName
      }
      if (fc43Result.revision) {
        result.revision = fc43Result.revision
      }
      if (fc43Result.exceptionCode !== undefined) {
        result.exceptionCode = fc43Result.exceptionCode
      }

      return result
    }

    // FC43 not available or not supported, fall through to FC03
  } catch (error) {
    // FC43 failed with error, check error type
    if (isTimeout(error)) {
      return {
        present: false,
        timeout: true,
        responseTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
      }
    }

    if (isCRCError(error)) {
      return {
        present: false,
        crcError: true,
        responseTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
      }
    }

    // FC43 threw other error, fall through to FC04
  }

  // Try FC04 (input registers - common for sensors)
  try {
    const fc04Result = await tryFC04(client)
    const responseTime = Math.round((performance.now() - startTime) * 100) / 100

    const result: DeviceIdentificationResult = {
      present: fc04Result.present ?? false,
      responseTimeMs: responseTime,
    }

    if (fc04Result.supportsFC04 !== undefined) {
      result.supportsFC04 = fc04Result.supportsFC04
    }
    if (fc04Result.exceptionCode !== undefined) {
      result.exceptionCode = fc04Result.exceptionCode
    }

    return result
  } catch (fc04Error) {
    // FC04 failed, check error type
    if (isTimeout(fc04Error)) {
      return {
        present: false,
        timeout: true,
        responseTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
      }
    }

    if (isCRCError(fc04Error)) {
      return {
        present: false,
        crcError: true,
        responseTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
      }
    }

    // FC04 threw other error, fall through to FC03
  }

  // Try FC03 as final fallback
  try {
    const fc03Result = await tryFC03(client)
    const responseTime = Math.round((performance.now() - startTime) * 100) / 100

    // Build complete result with all required properties
    const result: DeviceIdentificationResult = {
      present: fc03Result.present ?? false,
      responseTimeMs: responseTime,
    }

    if (fc03Result.supportsFC03 !== undefined) {
      result.supportsFC03 = fc03Result.supportsFC03
    }
    if (fc03Result.exceptionCode !== undefined) {
      result.exceptionCode = fc03Result.exceptionCode
    }

    return result
  } catch (fc03Error) {
    // FC03 also failed, classify error
    const responseTime = Math.round((performance.now() - startTime) * 100) / 100

    if (isTimeout(fc03Error)) {
      return {
        present: false,
        timeout: true,
        responseTimeMs: responseTime,
      }
    }

    if (isCRCError(fc03Error)) {
      return {
        present: false,
        crcError: true,
        responseTimeMs: responseTime,
      }
    }

    // Other error (network, etc.) - treat as not present
    return {
      present: false,
      responseTimeMs: responseTime,
    }
  }
}

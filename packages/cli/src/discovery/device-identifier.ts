import type ModbusRTU from 'modbus-serial'

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
    const deviceId = await (
      client as ModbusRTU & {
        readDeviceIdentification: (readDeviceIdCode: number) => Promise<{
          vendorName?: string
          productCode?: string
          modelName?: string
          revision?: string
        }>
      }
    ).readDeviceIdentification(1) // Read basic identification

    // Build result object conditionally
    const result: Partial<DeviceIdentificationResult> = {
      present: true,
      supportsFC43: true,
    }

    if (deviceId.vendorName) {
      result.vendorName = deviceId.vendorName
    }
    if (deviceId.productCode) {
      result.productCode = deviceId.productCode
    }
    if (deviceId.modelName) {
      result.modelName = deviceId.modelName
    }
    if (deviceId.revision) {
      result.revision = deviceId.revision
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
 * Try to identify device using FC03 (Read Holding Registers)
 *
 * FC03 is the most widely supported Modbus function code.
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
 * 1. FC43 (Read Device Identification) - provides vendor/model info
 * 2. FC03 (Read Holding Registers) - universal fallback
 *
 * @param client - Configured ModbusRTU client (address and serial params already set)
 * @param timeout - Response timeout in milliseconds
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
  timeout: number
): Promise<DeviceIdentificationResult> {
  const startTime = performance.now()

  // Set timeout on client (if method exists)
  if (typeof client.setTimeout === 'function') {
    client.setTimeout(timeout)
  }

  try {
    // Try FC43 first (provides device identification)
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

    // FC43 threw other error, fall through to FC03
  }

  // Try FC03 as fallback
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

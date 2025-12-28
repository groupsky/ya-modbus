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
 * Not all devices support this - device-level support is handled via exception codes.
 *
 * Any Modbus response (including exceptions) indicates a device is present.
 * Throws for timeout/CRC errors which indicate no device with these parameters.
 *
 * @param client - Configured ModbusRTU client
 * @param startTime - Start time for response time calculation
 * @throws Error for timeout, CRC, or other communication failures
 * @returns DeviceIdentificationResult with present: true guaranteed
 */
async function tryFC43(client: ModbusRTU, startTime: number): Promise<DeviceIdentificationResult> {
  try {
    const response = await client.readDeviceIdentification(1, 0) // Read basic identification, start from object 0

    // Build result object with response time
    const result: DeviceIdentificationResult = {
      present: true,
      responseTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
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
    const responseTime = Math.round((performance.now() - startTime) * 100) / 100
    const exceptionCode = isModbusException(error)

    if (exceptionCode !== undefined) {
      // Exception means device is present but doesn't support FC43 or the specific registers
      // This is still a successful device detection - we found a device, just don't know what it is
      return {
        present: true,
        responseTimeMs: responseTime,
        supportsFC43: false,
        exceptionCode,
      }
    }

    // Timeout, CRC, or other communication error - let caller handle it
    throw error
  }
}

/**
 * Attempt to identify a Modbus device at the current client configuration
 *
 * Uses FC43 (Read Device Identification) to probe for device presence.
 * Any Modbus response (including exceptions) indicates a device is present.
 * Only timeouts and CRC errors mean no device with these parameters.
 *
 * @param client - Configured ModbusRTU client (address, serial params, and timeout already set)
 * @returns Device identification result
 *
 * @example
 * ```typescript
 * const client = new ModbusRTU()
 * await client.connectRTUBuffered('/dev/ttyUSB0', { baudRate: 9600 })
 * client.setID(1)
 * client.setTimeout(1000)
 *
 * const result = await identifyDevice(client)
 * if (result.present) {
 *   console.log(`Found device: ${result.vendorName ?? 'Unknown'}`)
 * }
 * ```
 */
export async function identifyDevice(client: ModbusRTU): Promise<DeviceIdentificationResult> {
  const startTime = performance.now()

  try {
    // Try FC43 (provides device identification)
    return await tryFC43(client, startTime)
  } catch (error) {
    // Communication error - classify and return appropriate result
    const responseTime = Math.round((performance.now() - startTime) * 100) / 100

    if (isTimeout(error)) {
      return {
        present: false,
        timeout: true,
        responseTimeMs: responseTime,
      }
    }

    if (isCRCError(error)) {
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

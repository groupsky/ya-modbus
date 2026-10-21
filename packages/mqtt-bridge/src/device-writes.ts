import type { DataPoint } from '@ya-modbus/driver-types'

import type { DeviceConfig } from './types.js'

/**
 * Values of a write message: a JSON object of data point IDs and values, with at least one point
 */
export function parseWriteValues(payload: Buffer): Record<string, unknown> {
  let values: unknown
  try {
    values = JSON.parse(payload.toString())
  } catch {
    throw new Error('The message is not valid JSON')
  }

  if (
    typeof values !== 'object' ||
    values === null ||
    Array.isArray(values) ||
    Object.keys(values).length === 0
  ) {
    throw new Error('The message must be a JSON object of data point IDs and values')
  }
  return values as Record<string, unknown>
}

/**
 * Check that the device takes writes and that each point exists and is writable. The error names
 * the first point that is not.
 */
export function checkWrites(
  config: DeviceConfig,
  dataPoints: readonly DataPoint[],
  values: Record<string, unknown>
): void {
  if (config.allowWrites !== true) {
    throw new Error(`Device ${config.deviceId} does not allow writes (allowWrites is not true)`)
  }

  for (const id of Object.keys(values)) {
    const dataPoint = dataPoints.find((dp) => dp.id === id)
    if (!dataPoint) {
      throw new Error(`Data point ${id} does not exist`)
    }
    // A data point without access is read-only
    if (!(dataPoint.access ?? 'r').includes('w')) {
      throw new Error(`Data point ${id} is read-only`)
    }
  }
}

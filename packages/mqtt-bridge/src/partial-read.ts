import type { DeviceDriver } from '@ya-modbus/driver-types'

export interface PartialReadResult {
  data: Record<string, unknown>
  /** Points the device refused with Modbus exception 1, 2 or 3 */
  failed: string[]
  /** The refusal of the last failed call, when one failed */
  error?: unknown
}

// Modbus exceptions that refuse the request itself: 1 illegal function, 2 illegal data address,
// 3 illegal data value. Others (4 device failure, 6 busy, ...) say nothing about the points.
const REFUSALS = [1, 2, 3]

const isRefusal = (error: unknown): boolean =>
  REFUSALS.includes((error as { modbusCode?: unknown } | null)?.modbusCode as number)

/**
 * Read data points, and keep the points that work when the device refuses some of them.
 *
 * Without `failed` all points are read in one call. When the device refuses it with Modbus
 * exception 1, 2 or 3, every point is read on its own once, to find the points that fail. With `failed`
 * the other points are read in one call, and the failed points in a second call. When the second
 * call works, the points are back.
 *
 * Any other error (a timeout, a closed port, another Modbus exception) is thrown.
 */
export async function readPartial(
  driver: DeviceDriver,
  ids: string[],
  failed: string[]
): Promise<PartialReadResult> {
  try {
    if (failed.length === 0) {
      return { data: await driver.readDataPoints(ids), failed: [] }
    }
    const good = ids.filter((id) => !failed.includes(id))
    const data = good.length > 0 ? await driver.readDataPoints(good) : {}
    try {
      return { data: { ...data, ...(await driver.readDataPoints(failed)) }, failed: [] }
    } catch (error) {
      if (!isRefusal(error)) throw error
      return { data, failed, error }
    }
  } catch (error) {
    if (!isRefusal(error)) throw error
    return scan(driver, ids, error)
  }
}

async function scan(
  driver: DeviceDriver,
  ids: string[],
  firstError: unknown
): Promise<PartialReadResult> {
  const result: PartialReadResult = { data: {}, failed: [], error: firstError }
  for (const id of ids) {
    try {
      Object.assign(result.data, await driver.readDataPoints([id]))
    } catch (error) {
      if (!isRefusal(error)) throw error
      result.failed.push(id)
    }
  }
  return result
}

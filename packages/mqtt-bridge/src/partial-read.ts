import type { DeviceDriver } from '@ya-modbus/driver-types'

export interface PartialReadResult {
  data: Record<string, unknown>
  /** Points the device refused with a Modbus exception */
  failed: string[]
}

// The device answered, but refused the request (for example 2 = illegal data address)
const isModbusException = (error: unknown): boolean =>
  typeof (error as { modbusCode?: unknown } | null)?.modbusCode === 'number'

/**
 * Read data points, and keep the points that work when the device refuses some of them.
 *
 * Without `failed` all points are read in one call. When the device answers it with a Modbus
 * exception, every point is read on its own once, to find the points that fail. With `failed`
 * the other points are read in one call, and the failed points in a second call. When the second
 * call works, the points are back.
 *
 * Any other error (a timeout, a closed port) is thrown, and so is the exception when no point
 * can be read.
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
      if (!isModbusException(error)) throw error
      return { data, failed }
    }
  } catch (error) {
    if (!isModbusException(error)) throw error
    return scan(driver, ids, error)
  }
}

async function scan(
  driver: DeviceDriver,
  ids: string[],
  firstError: unknown
): Promise<PartialReadResult> {
  const result: PartialReadResult = { data: {}, failed: [] }
  for (const id of ids) {
    try {
      Object.assign(result.data, await driver.readDataPoints([id]))
    } catch (error) {
      if (!isModbusException(error)) throw error
      result.failed.push(id)
    }
  }
  if (result.failed.length === ids.length) throw firstError
  return result
}

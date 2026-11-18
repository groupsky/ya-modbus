import type { DeviceConfig, DeviceConnection } from './types.js'

/**
 * The line of a connection: the serial port, or the TCP host and port. Devices on one line are
 * polled one at a time. Other serial settings do not make another line.
 */
export const connectionKey = (connection: DeviceConnection): string =>
  connection.type === 'rtu'
    ? `rtu:${connection.port}`
    : `tcp:${connection.host}:${connection.port ?? 502}`

/** The devices of each line, in the order given */
export const devicesByLine = (devices: readonly DeviceConfig[]): Map<string, DeviceConfig[]> => {
  const lines = new Map<string, DeviceConfig[]>()
  for (const device of devices) {
    const key = connectionKey(device.connection)
    lines.set(key, [...(lines.get(key) ?? []), device])
  }
  return lines
}

/** The error when the devices on one line do not have the same `connection.pollOrder` */
export const pollOrderConflict = (
  line: string,
  devices: readonly DeviceConfig[]
): string | undefined => {
  const orders = new Set(devices.map((device) => device.connection.pollOrder ?? 'arrival'))
  if (orders.size < 2) return undefined
  const values = devices.map(
    ({ deviceId, connection: { pollOrder } }) =>
      `${deviceId} has ${pollOrder ? `'${pollOrder}'` : "'arrival' (not set)"}`
  )
  return `The devices on ${line} must have the same connection.pollOrder: ${values.join(', ')}`
}

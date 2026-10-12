/**
 * List the serial ports of this machine. The list can be empty (CI runners have
 * no USB adapters), so only the shape of the result is checked.
 */

import { readdir } from 'node:fs/promises'

import { listSerialPorts, type SerialPortInfo } from './serial-ports.js'

/** Matcher for a port with the documented fields and formats */
function portShape(port: SerialPortInfo): unknown {
  return {
    path: expect.stringMatching(/^\/dev\//),
    locations: port.locations.map(() => expect.any(String)),
    ...(port.vendorId === undefined ? {} : { vendorId: expect.stringMatching(/^[0-9a-f]{4}$/) }),
    ...(port.productId === undefined ? {} : { productId: expect.stringMatching(/^[0-9a-f]{4}$/) }),
    ...(port.serialNumber === undefined ? {} : { serialNumber: expect.any(String) }),
    ...(port.manufacturer === undefined ? {} : { manufacturer: expect.any(String) }),
  }
}

test('lists the serial ports of this machine', async () => {
  const ports = await listSerialPorts()

  for (const port of ports) expect(port).toStrictEqual(portShape(port))
})

// On Linux the serialport list runs udevadm, so this test needs it
test('lists the serial ports with serialport when sysfs does not exist', async () => {
  const readdirOrMissingSysfs = (path: string): Promise<string[]> =>
    path === '/sys/class/tty'
      ? Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      : readdir(path)

  const ports = await listSerialPorts({ readdir: readdirOrMissingSysfs })

  for (const port of ports) expect(port).toStrictEqual(portShape(port))
})

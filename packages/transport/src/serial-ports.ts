/**
 * List serial ports with their USB identity and physical USB port, and select
 * ports by these values
 *
 * USB serial adapters get a new device name when they are plugged in again
 * (`/dev/ttyUSB0` becomes `/dev/ttyUSB1`). The USB vendor ID, product ID and
 * serial number identify an adapter. Identical adapters without a serial number
 * differ only in the physical USB port, which is the name of their link in
 * `/dev/serial/by-path` (the location).
 */

import { readdir, readFile, realpath } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import ModbusRTU from 'modbus-serial'

/** A serial port with its USB identity */
export interface SerialPortInfo {
  /** Device path, for example `/dev/ttyUSB0` */
  path: string
  /** USB vendor ID as 4 lowercase hex digits, for example `1a86` */
  vendorId?: string
  /** USB product ID as 4 lowercase hex digits, for example `7523` */
  productId?: string
  /** USB serial number, when the adapter has one */
  serialNumber?: string
  /** Manufacturer name, when the adapter has one */
  manufacturer?: string
  /**
   * Names of the links in `/dev/serial/by-path` to this port, for example
   * `pci-0000:00:1a.0-usb-0:1.3:1.0-port0`. Newer systemd versions add a
   * second link (`...-usbv2-...`) for the same USB port. Empty when the port
   * has no such link (not a USB adapter, or not Linux).
   */
  locations: string[]
}

/** Values to select ports by. Leave out `serialNumber` or `location` to match any. */
export interface SerialPortMatch {
  /** USB vendor ID in hex, for example `1a86` or `0x1A86` */
  vendorId: string
  /** USB product ID in hex, for example `7523` */
  productId: string
  /** USB serial number (case-sensitive) */
  serialNumber?: string
  /** Name of a link in `/dev/serial/by-path`, or the full path of the link */
  location?: string
}

/** A port as serialport's list or sysfs reports it */
export interface ListedSerialPort {
  path: string
  vendorId?: string | undefined
  productId?: string | undefined
  serialNumber?: string | undefined
  manufacturer?: string | undefined
}

/** System access of {@link listSerialPorts}, replaced in tests */
export interface SerialPortsDeps {
  list: () => Promise<ListedSerialPort[]>
  readdir: (path: string) => Promise<string[]>
  realpath: (path: string) => Promise<string>
  readFile: (path: string) => Promise<string>
}

const BY_PATH_DIR = '/dev/serial/by-path'
const SYS_TTY_DIR = '/sys/class/tty'

const systemDeps: SerialPortsDeps = {
  // Loads the optional serialport package only when called
  list: () => ModbusRTU.getPorts(),
  readdir: (path) => readdir(path),
  realpath: (path) => realpath(path),
  readFile: (path) => readFile(path, 'utf8'),
}

/**
 * List the serial ports with their USB identity and locations
 *
 * On Linux the ports are read from sysfs (`/sys/class/tty`). This starts no
 * other program, so it works in a hardened service. Without sysfs (other
 * systems), the port list of serialport is used (through modbus-serial).
 *
 * @param deps - Replacements for the system access, for tests
 */
export async function listSerialPorts(
  deps: Partial<SerialPortsDeps> = {}
): Promise<SerialPortInfo[]> {
  const system = { ...systemDeps, ...deps }
  const [ports, locations] = await Promise.all([listPorts(system), readLocations(system)])
  return ports.map((port) => toPortInfo(port, locations.get(port.path) ?? []))
}

/**
 * Select the ports that match all given values
 *
 * Returns every match, so the caller can tell a unique match from an
 * ambiguous one. Ports without a USB vendor or product ID never match.
 */
export function matchSerialPorts(
  ports: readonly SerialPortInfo[],
  match: SerialPortMatch
): SerialPortInfo[] {
  const vendorId = normalizeUsbId(match.vendorId)
  const productId = normalizeUsbId(match.productId)
  const location = match.location?.startsWith(`${BY_PATH_DIR}/`)
    ? match.location.slice(BY_PATH_DIR.length + 1)
    : match.location
  return ports.filter(
    (port) =>
      vendorId !== undefined &&
      port.vendorId === vendorId &&
      productId !== undefined &&
      port.productId === productId &&
      (match.serialNumber === undefined || port.serialNumber === match.serialNumber) &&
      (location === undefined || port.locations.includes(location))
  )
}

/** `1A86`, `0x1a86` and `1a86` become `1a86`; `403` becomes `0403` */
function normalizeUsbId(id: string | undefined): string | undefined {
  const hex = id?.match(/^(?:0x)?([0-9a-f]{1,4})$/i)?.[1]
  return hex?.toLowerCase().padStart(4, '0')
}

function toPortInfo(port: ListedSerialPort, locations: string[]): SerialPortInfo {
  const vendorId = normalizeUsbId(port.vendorId)
  const productId = normalizeUsbId(port.productId)
  return {
    path: port.path,
    ...(vendorId ? { vendorId } : {}),
    ...(productId ? { productId } : {}),
    ...(port.serialNumber ? { serialNumber: port.serialNumber } : {}),
    ...(port.manufacturer ? { manufacturer: port.manufacturer } : {}),
    locations,
  }
}

async function listPorts(system: SerialPortsDeps): Promise<ListedSerialPort[]> {
  try {
    return await listSysfsPorts(system)
  } catch (error) {
    if (!isNotFound(error)) throw error
    return system.list()
  }
}

function isNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

/** Map each device path to the names of its links in /dev/serial/by-path */
async function readLocations(system: SerialPortsDeps): Promise<Map<string, string[]>> {
  const locations = new Map<string, string[]>()
  let names: string[]
  try {
    names = await system.readdir(BY_PATH_DIR)
  } catch (error) {
    // udev creates the directory only while a USB serial adapter is plugged in
    if (isNotFound(error)) return locations
    throw error
  }
  const sorted = [...names].sort()
  const targets = await Promise.all(
    sorted.map((name) =>
      // A link points nowhere when its adapter is unplugged while listing
      system.realpath(join(BY_PATH_DIR, name)).catch(() => undefined)
    )
  )
  sorted.forEach((name, index) => {
    const target = targets[index]
    if (target !== undefined) locations.set(target, [...(locations.get(target) ?? []), name])
  })
  return locations
}

/**
 * List the ports in /sys/class/tty that belong to a device, and read the USB
 * identity of the USB device above each one
 */
async function listSysfsPorts(system: SerialPortsDeps): Promise<ListedSerialPort[]> {
  const names = await system.readdir(SYS_TTY_DIR)
  const ports = await Promise.all(
    names.map(async (name) => {
      // Virtual terminals (tty0, console, ptmx) have no device
      const device = await system.realpath(join(SYS_TTY_DIR, name, 'device')).catch(() => undefined)
      return device === undefined
        ? undefined
        : { path: join('/dev', name), ...(await readUsbIdentity(system, device)) }
    })
  )
  return ports.filter((port) => port !== undefined)
}

/** Walk up from a tty device to the USB device, which has the idVendor file */
async function readUsbIdentity(
  system: SerialPortsDeps,
  device: string
): Promise<Omit<ListedSerialPort, 'path'>> {
  for (let dir = device; dir !== dirname(dir); dir = dirname(dir)) {
    const vendorId = await readAttribute(system, dir, 'idVendor')
    if (vendorId === undefined) continue
    return {
      vendorId,
      productId: await readAttribute(system, dir, 'idProduct'),
      serialNumber: await readAttribute(system, dir, 'serial'),
      manufacturer: await readAttribute(system, dir, 'manufacturer'),
    }
  }
  return {}
}

/**
 * Read a sysfs attribute without the newline that sysfs adds, or undefined
 * when the device does not have it
 */
function readAttribute(
  system: SerialPortsDeps,
  dir: string,
  name: string
): Promise<string | undefined> {
  return system.readFile(join(dir, name)).then(
    (value) => value.replace(/\n$/, ''),
    () => undefined
  )
}

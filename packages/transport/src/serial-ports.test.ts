import {
  listSerialPorts,
  matchSerialPorts,
  type ListedSerialPort,
  type SerialPortInfo,
  type SerialPortsDeps,
} from './serial-ports.js'

function fsError(code: string, path: string): Error {
  return Object.assign(new Error(`${code}: ${path}`), { code })
}

type Tree = {
  dirs?: Record<string, string[]>
  files?: Record<string, string>
  links?: Record<string, string>
}

/**
 * In-memory file system made of trees: directory entries, file contents and
 * the resolved path of each symbolic link. Anything else does not exist.
 */
function fakeFs(...trees: Tree[]): Omit<SerialPortsDeps, 'list'> {
  const dirs = Object.assign({}, ...trees.map((tree) => tree.dirs)) as Record<string, string[]>
  const files = Object.assign({}, ...trees.map((tree) => tree.files)) as Record<string, string>
  const links = Object.assign({}, ...trees.map((tree) => tree.links)) as Record<string, string>
  return {
    readdir: (path: string) =>
      dirs[path] ? Promise.resolve([...dirs[path]]) : Promise.reject(fsError('ENOENT', path)),
    realpath: (path: string) =>
      links[path] ? Promise.resolve(links[path]) : Promise.reject(fsError('ENOENT', path)),
    readFile: (path: string) =>
      files[path] === undefined
        ? Promise.reject(fsError('ENOENT', path))
        : Promise.resolve(files[path]),
  }
}

const SYS_TTY = '/sys/class/tty'
const BY_PATH = '/dev/serial/by-path'

// Two identical CH340 adapters without serial numbers behind a hub (the tty
// device is below the USB interface), a CDC ACM device with a serial number
// (the tty device is the USB interface), a built-in UART and a virtual terminal
const ch340a = '/sys/devices/pci0000:00/0000:00:1a.0/usb1/1-1/1-1.3'
const ch340b = '/sys/devices/pci0000:00/0000:00:1a.0/usb1/1-1/1-1.4'
const acm = '/sys/devices/pci0000:00/0000:00:14.0/usb3/3-2'
const sysfs: Tree = {
  dirs: { [SYS_TTY]: ['tty0', 'ttyS0', 'ttyUSB0', 'ttyUSB1', 'ttyACM0'] },
  links: {
    [`${SYS_TTY}/ttyS0/device`]: '/sys/devices/platform/serial8250/serial8250:0',
    [`${SYS_TTY}/ttyUSB0/device`]: `${ch340a}/1-1.3:1.0/ttyUSB0`,
    [`${SYS_TTY}/ttyUSB1/device`]: `${ch340b}/1-1.4:1.0/ttyUSB1`,
    [`${SYS_TTY}/ttyACM0/device`]: `${acm}/3-2:1.0`,
  },
  files: {
    [`${ch340a}/idVendor`]: '1a86\n',
    [`${ch340a}/idProduct`]: '7523\n',
    [`${ch340b}/idVendor`]: '1a86\n',
    [`${ch340b}/idProduct`]: '7523\n',
    [`${acm}/idVendor`]: '2341\n',
    [`${acm}/idProduct`]: '0043\n',
    [`${acm}/serial`]: '75735353038351F0E1A1\n',
    [`${acm}/manufacturer`]: 'Arduino (www.arduino.cc)\n',
  },
}

// Only the by-path links tell the CH340 adapters apart. Newer systemd adds a
// "usbv2" link for the same USB port.
const byPath: Tree = {
  dirs: {
    [BY_PATH]: [
      'pci-0000:00:1a.0-usbv2-0:1.3:1.0-port0',
      'pci-0000:00:1a.0-usb-0:1.4:1.0-port0',
      'pci-0000:00:1a.0-usb-0:1.3:1.0-port0',
    ],
  },
  links: {
    [`${BY_PATH}/pci-0000:00:1a.0-usb-0:1.3:1.0-port0`]: '/dev/ttyUSB0',
    [`${BY_PATH}/pci-0000:00:1a.0-usbv2-0:1.3:1.0-port0`]: '/dev/ttyUSB0',
    [`${BY_PATH}/pci-0000:00:1a.0-usb-0:1.4:1.0-port0`]: '/dev/ttyUSB1',
  },
}

// On Linux the serialport list runs udevadm, which a hardened service can block
const noList = (): Promise<ListedSerialPort[]> =>
  Promise.reject(new Error('the serialport list must not be used'))

describe('listSerialPorts', () => {
  test('reads the ports from sysfs and adds their by-path names as locations', async () => {
    const ports = await listSerialPorts({ list: noList, ...fakeFs(sysfs, byPath) })

    expect(ports).toStrictEqual([
      { path: '/dev/ttyS0', locations: [] },
      {
        path: '/dev/ttyUSB0',
        vendorId: '1a86',
        productId: '7523',
        locations: [
          'pci-0000:00:1a.0-usb-0:1.3:1.0-port0',
          'pci-0000:00:1a.0-usbv2-0:1.3:1.0-port0',
        ],
      },
      {
        path: '/dev/ttyUSB1',
        vendorId: '1a86',
        productId: '7523',
        locations: ['pci-0000:00:1a.0-usb-0:1.4:1.0-port0'],
      },
      {
        path: '/dev/ttyACM0',
        vendorId: '2341',
        productId: '0043',
        serialNumber: '75735353038351F0E1A1',
        manufacturer: 'Arduino (www.arduino.cc)',
        locations: [],
      },
    ])
  })

  test('gives empty locations when /dev/serial/by-path does not exist', async () => {
    // udev creates the directory only while a USB serial adapter is plugged in
    const ports = await listSerialPorts({ list: noList, ...fakeFs(sysfs) })

    expect(ports.map((port) => port.locations)).toEqual([[], [], [], []])
  })

  test('skips a by-path link that points nowhere', async () => {
    // The adapter was unplugged while the links were read
    const stale: Tree = {
      dirs: { [BY_PATH]: ['pci-0000:00:1a.0-usb-0:1.4:1.0-port0', 'stale-port0'] },
      links: { [`${BY_PATH}/pci-0000:00:1a.0-usb-0:1.4:1.0-port0`]: '/dev/ttyUSB1' },
    }

    const ports = await listSerialPorts({ list: noList, ...fakeFs(sysfs, stale) })

    expect(ports.map((port) => port.locations)).toEqual([
      [],
      [],
      ['pci-0000:00:1a.0-usb-0:1.4:1.0-port0'],
      [],
    ])
  })

  test.each([SYS_TTY, BY_PATH])('rejects when %s cannot be read', async (dir) => {
    const fs = fakeFs(sysfs, byPath)
    const readdir = (path: string): Promise<string[]> =>
      path === dir ? Promise.reject(fsError('EACCES', path)) : fs.readdir(path)

    await expect(listSerialPorts({ list: noList, ...fs, readdir })).rejects.toThrow(
      `EACCES: ${dir}`
    )
  })

  test('uses the serialport list when /sys/class/tty does not exist', async () => {
    // As on Windows
    const ftdi = {
      path: 'COM3',
      vendorId: '0403',
      productId: '6001',
      serialNumber: 'A10K5ZGT',
      manufacturer: 'FTDI',
    }
    const list = (): Promise<ListedSerialPort[]> => Promise.resolve([ftdi, { path: 'COM1' }])

    const ports = await listSerialPorts({ list, ...fakeFs() })

    expect(ports).toStrictEqual([
      { ...ftdi, locations: [] },
      { path: 'COM1', locations: [] },
    ])
  })

  test('leaves out values that serialport reports as undefined or empty', async () => {
    const port = {
      path: 'COM4',
      vendorId: undefined,
      productId: undefined,
      serialNumber: '',
      manufacturer: undefined,
    }

    const ports = await listSerialPorts({ list: () => Promise.resolve([port]), ...fakeFs() })

    expect(ports).toStrictEqual([{ path: 'COM4', locations: [] }])
  })

  test.each([
    { reported: '1A86', expected: '1a86' },
    { reported: '0x1a86', expected: '1a86' },
    { reported: '403', expected: '0403' },
  ])('reports USB id $reported as $expected', async ({ reported, expected }) => {
    const port = { path: 'COM3', vendorId: reported, productId: reported }

    const [result] = await listSerialPorts({ list: () => Promise.resolve([port]), ...fakeFs() })

    expect(result).toMatchObject({ vendorId: expected, productId: expected })
  })

  test('leaves out a USB id that is not a hex number', async () => {
    const port = { path: 'COM3', vendorId: 'n/a', productId: '12345' }

    const ports = await listSerialPorts({ list: () => Promise.resolve([port]), ...fakeFs() })

    expect(ports).toStrictEqual([{ path: 'COM3', locations: [] }])
  })
})

describe('matchSerialPorts', () => {
  const ports: SerialPortInfo[] = [
    {
      path: '/dev/ttyUSB0',
      vendorId: '1a86',
      productId: '7523',
      locations: ['pci-0000:00:1a.0-usb-0:1.3:1.0-port0', 'pci-0000:00:1a.0-usbv2-0:1.3:1.0-port0'],
    },
    {
      path: '/dev/ttyUSB1',
      vendorId: '1a86',
      productId: '7523',
      locations: ['pci-0000:00:1a.0-usb-0:1.4:1.0-port0'],
    },
    {
      path: '/dev/ttyUSB2',
      vendorId: '0403',
      productId: '6001',
      serialNumber: 'A10K5ZGT',
      locations: ['pci-0000:00:1a.0-usb-0:1.5:1.0-port0'],
    },
    {
      path: '/dev/ttyUSB3',
      vendorId: '0403',
      productId: '6001',
      serialNumber: 'B20K5ZGT',
      locations: ['pci-0000:00:1a.0-usb-0:1.6:1.0-port0'],
    },
    { path: '/dev/ttyS0', locations: [] },
  ]

  test.each([
    {
      label: 'vendor and product',
      match: { vendorId: '1a86', productId: '7523' },
      expected: ['/dev/ttyUSB0', '/dev/ttyUSB1'],
    },
    {
      label: 'ids in another notation',
      match: { vendorId: '0x1A86', productId: '7523' },
      expected: ['/dev/ttyUSB0', '/dev/ttyUSB1'],
    },
    {
      label: 'serial number',
      match: { vendorId: '0403', productId: '6001', serialNumber: 'B20K5ZGT' },
      expected: ['/dev/ttyUSB3'],
    },
    {
      label: 'location name',
      match: {
        vendorId: '1a86',
        productId: '7523',
        location: 'pci-0000:00:1a.0-usb-0:1.4:1.0-port0',
      },
      expected: ['/dev/ttyUSB1'],
    },
    {
      label: 'location path',
      match: {
        vendorId: '1a86',
        productId: '7523',
        location: '/dev/serial/by-path/pci-0000:00:1a.0-usb-0:1.3:1.0-port0',
      },
      expected: ['/dev/ttyUSB0'],
    },
    {
      label: 'second location of a port',
      match: {
        vendorId: '1a86',
        productId: '7523',
        location: 'pci-0000:00:1a.0-usbv2-0:1.3:1.0-port0',
      },
      expected: ['/dev/ttyUSB0'],
    },
  ])('selects ports by $label', ({ match, expected }) => {
    expect(matchSerialPorts(ports, match).map((port) => port.path)).toEqual(expected)
  })

  test.each([
    { label: 'another product', match: { vendorId: '1a86', productId: '5523' } },
    {
      label: 'an unknown serial number',
      match: { vendorId: '0403', productId: '6001', serialNumber: 'a10k5zgt' },
    },
    {
      label: 'the location of another adapter type',
      match: {
        vendorId: '1a86',
        productId: '7523',
        location: 'pci-0000:00:1a.0-usb-0:1.5:1.0-port0',
      },
    },
    {
      label: 'a by-id path as location',
      match: {
        vendorId: '1a86',
        productId: '7523',
        location: '/dev/serial/by-id/usb-1a86_USB_Serial-if00-port0',
      },
    },
    { label: 'ids that are not hex numbers', match: { vendorId: 'n/a', productId: 'n/a' } },
  ])('selects nothing for $label', ({ match }) => {
    expect(matchSerialPorts(ports, match)).toEqual([])
  })
})

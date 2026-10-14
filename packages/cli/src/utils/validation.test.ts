import { ValidationError } from '@ya-modbus/driver-loader'

import { validateConnectionOptions } from './validation.js'

describe('validateConnectionOptions', () => {
  test.each([
    ['no connection options', {}],
    ['only a serial port', { port: '/dev/ttyUSB0' }],
    ['only a TCP host', { host: '192.168.1.100' }],
    ['a TCP host with a numeric TCP port', { host: '192.168.1.100', port: 5020 }],
  ])('should accept %s', (_name, options) => {
    expect(() => {
      validateConnectionOptions(options)
    }).not.toThrow()
  })

  test('should reject a serial port together with a TCP host', () => {
    const options = { port: '/dev/ttyUSB0', host: '192.168.1.100' }

    expect(() => {
      validateConnectionOptions(options)
    }).toThrow(ValidationError)
    expect(() => {
      validateConnectionOptions(options)
    }).toThrow('Use either --port (RTU) or --host (TCP), not both')
  })
})

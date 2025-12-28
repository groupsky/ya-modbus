import { showDefaultsCommand, type ShowDefaultsOptions } from './show-defaults.js'

describe('showDefaultsCommand', () => {
  let consoleLogSpy: jest.SpyInstance

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  test('should display deprecation message', () => {
    const options: ShowDefaultsOptions = {
      driver: 'ya-modbus-driver-xymd1',
    }

    showDefaultsCommand(options)

    const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(output).toContain('show-defaults command is deprecated')
    expect(output).toContain('DEVICE_METADATA')
  })

  test('should display deprecation message regardless of options', () => {
    const options: ShowDefaultsOptions = {
      local: true,
      format: 'json',
    }

    showDefaultsCommand(options)

    const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(output).toContain('show-defaults command is deprecated')
  })
})

import { completionCommand, type CompletionOptions } from './completion.js'

describe('completionCommand', () => {
  let consoleLogSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  test('should generate bash completion by default', () => {
    const options: CompletionOptions = {}

    completionCommand(options)

    const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(output).toContain('# ya-modbus bash completion')
    expect(output).toContain('_ya_modbus_completion')
    expect(output).toContain('complete -F _ya_modbus_completion ya-modbus')
    expect(output).toContain('read write show-defaults completion')

    // Verify installation instructions printed to stderr
    const errors = consoleErrorSpy.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(errors).toContain('Installation instructions for bash')
    expect(errors).toContain('~/.bashrc')
  })

  test('should generate bash completion when explicitly specified', () => {
    const options: CompletionOptions = { shell: 'bash' }

    completionCommand(options)

    const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(output).toContain('# ya-modbus bash completion')
    expect(output).toContain('_ya_modbus_completion')
  })

  test('should generate zsh completion', () => {
    const options: CompletionOptions = { shell: 'zsh' }

    completionCommand(options)

    const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(output).toContain('#compdef ya-modbus')
    expect(output).toContain('_ya_modbus')
    expect(output).toContain('read:Read data points from device')
    expect(output).toContain('write:Write data point to device')

    const errors = consoleErrorSpy.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(errors).toContain('Installation instructions for zsh')
    expect(errors).toContain('~/.zshrc')
  })

  test('should generate fish completion', () => {
    const options: CompletionOptions = { shell: 'fish' }

    completionCommand(options)

    const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(output).toContain('# ya-modbus fish completion')
    expect(output).toContain('complete -c ya-modbus')
    expect(output).toContain('__fish_seen_subcommand_from read write')

    const errors = consoleErrorSpy.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(errors).toContain('Installation instructions for fish')
    expect(errors).toContain('~/.config/fish/completions')
  })

  test('should throw error for unsupported shell', () => {
    const options: CompletionOptions = { shell: 'powershell' }

    expect(() => completionCommand(options)).toThrow(
      'Unsupported shell: powershell. Supported: bash, zsh, fish'
    )
  })

  describe('completion script content', () => {
    test('bash completion should include all commands and options', () => {
      completionCommand({ shell: 'bash' })

      const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')

      // Commands
      expect(output).toContain('read write show-defaults completion')

      // Connection options
      expect(output).toContain('--driver --port --host --tcp-port --slave-id')
      expect(output).toContain('--baud-rate --parity --data-bits --stop-bits')

      // Parity values
      expect(output).toContain('none even odd')

      // Data/stop bits values
      expect(output).toContain('7 8')
      expect(output).toContain('1 2')

      // Format options
      expect(output).toContain('table json')
    })

    test('zsh completion should include command descriptions', () => {
      completionCommand({ shell: 'zsh' })

      const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')

      expect(output).toContain('read:Read data points from device')
      expect(output).toContain('write:Write data point to device')
      expect(output).toContain('show-defaults:Show driver DEFAULT_CONFIG and SUPPORTED_CONFIG')
    })

    test('fish completion should include option descriptions', () => {
      completionCommand({ shell: 'fish' })

      const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')

      expect(output).toContain("'Read data points from device'")
      expect(output).toContain("'Write data point to device'")
      expect(output).toContain('Driver package name')
      expect(output).toContain('Baud rate (uses driver default)')
    })
  })
})

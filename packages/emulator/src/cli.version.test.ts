import packageJson from '../package.json'

describe('ya-modbus-emulator --version', () => {
  const originalArgv = process.argv

  afterEach(() => {
    process.argv = originalArgv
    jest.restoreAllMocks()
  })

  test('prints the version from package.json', async () => {
    process.argv = ['node', 'ya-modbus-emulator', '--version']
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
    // Commander exits after printing the version. Throw to stop the import there.
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })

    await expect(import('./cli.js')).rejects.toThrow('process.exit called')

    expect(stdoutSpy).toHaveBeenCalledWith(`${packageJson.version}\n`)
    expect(exitSpy).toHaveBeenCalledWith(0)
  })
})

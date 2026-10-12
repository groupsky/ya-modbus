/**
 * The bin file imports cli.ts and calls main(). Importing cli.ts must not start the
 * emulator by itself, otherwise it starts twice and prints the startup banner twice.
 */
const originalArgv = process.argv
const startBanner = '[INFO] Starting Modbus emulator...'
let logSpy: jest.SpyInstance
let signalListenersBefore: Record<'SIGINT' | 'SIGTERM', NodeJS.SignalsListener[]>

const countBanners = (): number => logSpy.mock.calls.filter(([line]) => line === startBanner).length
const flushPendingWork = async (): Promise<void> => {
  await new Promise((resolve) => setImmediate(resolve))
}

beforeEach(() => {
  jest.resetModules()
  process.argv = ['node', 'ya-modbus-emulator', '--transport', 'memory', '--slave-id', '1']
  logSpy = jest.spyOn(console, 'log').mockImplementation()
  jest.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit called')
  })
  signalListenersBefore = {
    SIGINT: process.listeners('SIGINT'),
    SIGTERM: process.listeners('SIGTERM'),
  }
})

afterEach(() => {
  process.argv = originalArgv
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    for (const listener of process.listeners(signal)) {
      if (!signalListenersBefore[signal].includes(listener)) {
        process.removeListener(signal, listener)
      }
    }
  }
  jest.restoreAllMocks()
})

test('importing the CLI module does not start the emulator', async () => {
  await import('./cli.js')
  await flushPendingWork()

  expect(countBanners()).toBe(0)
})

test('calling main() after importing the CLI module starts the emulator once', async () => {
  const { main } = await import('./cli.js')
  await main()
  await flushPendingWork()

  expect(countBanners()).toBe(1)
})

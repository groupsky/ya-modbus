import mqtt from 'mqtt'

import { createTestBridgeConfig, startTestBroker, type TestBroker } from './utils/test-utils.js'

import { createBridge } from './index.js'

/** Read the retained message of a topic, as a new subscriber sees it */
async function readRetained(url: string, topic: string): Promise<string | undefined> {
  const reader = await mqtt.connectAsync(url)
  try {
    const message = new Promise<string>((resolve) => {
      reader.on('message', (_topic, payload, packet) => {
        if (packet.retain) resolve(payload.toString())
      })
    })
    await reader.subscribeAsync(topic)
    // A topic without a retained message sends nothing
    return await Promise.race([
      message,
      new Promise<undefined>((resolve) => setTimeout(resolve, 300)),
    ])
  } finally {
    await reader.endAsync()
  }
}

describe('Bridge availability', () => {
  let broker: TestBroker

  beforeEach(async () => {
    broker = await startTestBroker()
  })

  afterEach(async () => {
    await broker.close()
  })

  test('the retained bridge status is online while running and offline after a stop', async () => {
    const config = createTestBridgeConfig(broker)

    // A restart: the status follows every start and stop
    for (let run = 0; run < 2; run++) {
      const bridge = createBridge(config)
      await bridge.start()
      expect(await readRetained(broker.url, 'modbus/bridge/status')).toBe('online')

      await bridge.stop()
      expect(await readRetained(broker.url, 'modbus/bridge/status')).toBe('offline')
    }
  })

  test('the last-will sets the retained bridge status to offline when the connection is lost', async () => {
    const config = createTestBridgeConfig(broker, { mqtt: { url: broker.url, reconnectPeriod: 0 } })
    const bridge = createBridge(config)
    await bridge.start()
    try {
      expect(await readRetained(broker.url, 'modbus/bridge/status')).toBe('online')

      // Close the connection of the bridge on the broker side, without a clean disconnect
      for (const client of Object.values(broker.broker.clients)) client.conn.destroy()

      expect(await readRetained(broker.url, 'modbus/bridge/status')).toBe('offline')
    } finally {
      await bridge.stop()
    }
  })
})

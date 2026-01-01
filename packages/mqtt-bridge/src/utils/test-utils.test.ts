import { jest } from '@jest/globals'

import {
  createMessageCollector,
  createTestBridgeConfig,
  startTestBroker,
  waitForAllClientsToDisconnect,
  waitForClientDisconnect,
  waitForClientReady,
  waitForPublish,
  waitForSubscribe,
  waitForUnsubscribe,
  withTimeout,
  type TestBroker,
} from './test-utils.js'

describe('Test Utilities', () => {
  describe('withTimeout', () => {
    test('should resolve when promise resolves before timeout', async () => {
      const promise = Promise.resolve('success')
      const result = await withTimeout(promise, 1000, 'Timeout error')
      expect(result).toBe('success')
    })

    test('should reject when promise rejects before timeout', async () => {
      const promise = Promise.reject(new Error('Promise error'))
      await expect(withTimeout(promise, 1000, 'Timeout error')).rejects.toThrow('Promise error')
    })

    test('should reject with timeout error when promise takes too long', async () => {
      const promise = new Promise((resolve) => setTimeout(resolve, 2000))
      await expect(withTimeout(promise, 100, 'Timeout occurred')).rejects.toThrow(
        'Timeout occurred'
      )
    })

    test('should call error message function when timeout occurs', async () => {
      const promise = new Promise((resolve) => setTimeout(resolve, 2000))
      const errorMessage = jest.fn(() => 'Dynamic error message')

      await expect(withTimeout(promise, 100, errorMessage)).rejects.toThrow('Dynamic error message')
      expect(errorMessage).toHaveBeenCalledTimes(1)
    })

    test('should cleanup timer when promise resolves', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
      const promise = Promise.resolve('success')

      await withTimeout(promise, 1000, 'Timeout error')

      expect(clearTimeoutSpy).toHaveBeenCalled()
      clearTimeoutSpy.mockRestore()
    })

    test('should cleanup timer when promise rejects', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
      const promise = Promise.reject(new Error('Error'))

      await expect(withTimeout(promise, 1000, 'Timeout error')).rejects.toThrow('Error')

      expect(clearTimeoutSpy).toHaveBeenCalled()
      clearTimeoutSpy.mockRestore()
    })

    test('should cleanup timer when timeout occurs', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
      const promise = new Promise((resolve) => setTimeout(resolve, 2000))

      await expect(withTimeout(promise, 100, 'Timeout error')).rejects.toThrow('Timeout error')

      expect(clearTimeoutSpy).toHaveBeenCalled()
      clearTimeoutSpy.mockRestore()
    })
  })

  describe('createMessageCollector', () => {
    test('should collect messages', () => {
      const collector = createMessageCollector()

      collector.handler({
        topic: 'test/topic',
        payload: Buffer.from('Message 1'),
        qos: 0,
      })
      collector.handler({
        topic: 'test/topic',
        payload: Buffer.from('Message 2'),
        qos: 1,
      })

      expect(collector.messages).toEqual(['Message 1', 'Message 2'])
    })

    test('should convert buffer payloads to strings', () => {
      const collector = createMessageCollector()

      collector.handler({
        topic: 'test/topic',
        payload: Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]), // "Hello"
        qos: 0,
      })

      expect(collector.messages).toEqual(['Hello'])
    })

    test('should clear messages', () => {
      const collector = createMessageCollector()

      collector.handler({
        topic: 'test/topic',
        payload: Buffer.from('Message 1'),
        qos: 0,
      })

      expect(collector.messages).toHaveLength(1)

      collector.clear()

      expect(collector.messages).toHaveLength(0)
    })
  })

  describe('createTestBridgeConfig', () => {
    let broker: TestBroker

    beforeEach(async () => {
      broker = await startTestBroker()
    })

    afterEach(async () => {
      await broker.close()
    })

    test('should create config with broker URL', () => {
      const config = createTestBridgeConfig(broker)

      expect(config.mqtt.url).toBe(broker.url)
    })

    test('should merge overrides', () => {
      const config = createTestBridgeConfig(broker, {
        topicPrefix: 'custom',
      })

      expect(config.mqtt.url).toBe(broker.url)
      expect(config.topicPrefix).toBe('custom')
    })

    test('should merge mqtt overrides', () => {
      const config = createTestBridgeConfig(broker, {
        mqtt: {
          clientId: 'test-client',
        },
      })

      expect(config.mqtt.url).toBe(broker.url)
      expect(config.mqtt.clientId).toBe('test-client')
    })
  })

  describe('broker event helpers', () => {
    let broker: TestBroker

    beforeEach(async () => {
      broker = await startTestBroker()
    })

    afterEach(async () => {
      await broker.close()
    })

    describe('waitForClientReady', () => {
      test('should resolve when client ready event is emitted', async () => {
        const promise = waitForClientReady(broker, 1000)

        // Simulate client ready event
        setImmediate(() => broker.broker.emit('clientReady'))

        await expect(promise).resolves.toBeUndefined()
      })

      test('should timeout if client ready event is not emitted', async () => {
        await expect(waitForClientReady(broker, 100)).rejects.toThrow(
          /Timeout waiting for client to be ready/
        )
      })

      test('should include connection count in timeout error', async () => {
        await expect(waitForClientReady(broker, 100)).rejects.toThrow(/connected: 0/)
      })
    })

    describe('waitForClientDisconnect', () => {
      test('should resolve when client disconnect event is emitted', async () => {
        const promise = waitForClientDisconnect(broker, 1000)

        // Simulate client disconnect event
        setImmediate(() => broker.broker.emit('clientDisconnect'))

        await expect(promise).resolves.toBeUndefined()
      })

      test('should timeout if client disconnect event is not emitted', async () => {
        await expect(waitForClientDisconnect(broker, 100)).rejects.toThrow(
          /Timeout waiting for client to disconnect/
        )
      })

      test('should include connection count in timeout error', async () => {
        await expect(waitForClientDisconnect(broker, 100)).rejects.toThrow(/connected: 0/)
      })
    })

    describe('waitForAllClientsToDisconnect', () => {
      test('should resolve immediately if no clients connected', async () => {
        await expect(waitForAllClientsToDisconnect(broker, 1000)).resolves.toBeUndefined()
      })

      test('should include connection count in timeout error', async () => {
        // Manually set connected clients to simulate active connections
        broker.broker.connectedClients = 2

        await expect(waitForAllClientsToDisconnect(broker, 100)).rejects.toThrow(
          /Still connected: 2/
        )

        // Reset for cleanup
        broker.broker.connectedClients = 0
      })

      test('should cleanup event listener on timeout', async () => {
        const removeListenerSpy = jest.spyOn(broker.broker, 'off')

        broker.broker.connectedClients = 1

        await expect(waitForAllClientsToDisconnect(broker, 100)).rejects.toThrow(/Still connected/)

        expect(removeListenerSpy).toHaveBeenCalledWith('clientDisconnect', expect.any(Function))

        broker.broker.connectedClients = 0
        removeListenerSpy.mockRestore()
      })

      test('should cleanup event listener on success', async () => {
        const removeListenerSpy = jest.spyOn(broker.broker, 'off')

        broker.broker.connectedClients = 1

        const promise = waitForAllClientsToDisconnect(broker, 1000)

        setImmediate(() => {
          broker.broker.connectedClients = 0
          broker.broker.emit('clientDisconnect')
        })

        await promise

        expect(removeListenerSpy).toHaveBeenCalledWith('clientDisconnect', expect.any(Function))

        removeListenerSpy.mockRestore()
      })
    })

    describe('waitForPublish', () => {
      test('should resolve when publish event is emitted', async () => {
        const promise = waitForPublish(broker)

        setImmediate(() => {
          broker.broker.emit('publish', {
            topic: 'test/topic',
            payload: Buffer.from('message'),
          })
        })

        const result = await promise
        expect(result.topic).toBe('test/topic')
        expect(result.payload.toString()).toBe('message')
      })

      test('should filter by topic pattern', async () => {
        const promise = waitForPublish(broker, 'test/specific')

        setImmediate(() => {
          // Wrong topic
          broker.broker.emit('publish', {
            topic: 'test/other',
            payload: Buffer.from('wrong'),
          })

          // Correct topic
          broker.broker.emit('publish', {
            topic: 'test/specific',
            payload: Buffer.from('correct'),
          })
        })

        const result = await promise
        expect(result.topic).toBe('test/specific')
        expect(result.payload.toString()).toBe('correct')
      })

      test('should timeout if publish event is not emitted', async () => {
        await expect(waitForPublish(broker, 'test/topic', 100)).rejects.toThrow(
          /Timeout waiting for publish on topic test\/topic/
        )
      })

      test('should cleanup event listener on success', async () => {
        const removeListenerSpy = jest.spyOn(broker.broker, 'off')

        const promise = waitForPublish(broker)

        setImmediate(() => {
          broker.broker.emit('publish', {
            topic: 'test/topic',
            payload: Buffer.from('message'),
          })
        })

        await promise

        expect(removeListenerSpy).toHaveBeenCalledWith('publish', expect.any(Function))

        removeListenerSpy.mockRestore()
      })
    })

    describe('waitForSubscribe', () => {
      test('should resolve when subscribe event is emitted', async () => {
        const promise = waitForSubscribe(broker)

        setImmediate(() => {
          broker.broker.emit('subscribe', [{ topic: 'test/topic' }])
        })

        const result = await promise
        expect(result).toEqual([{ topic: 'test/topic' }])
      })

      test('should filter by topic pattern', async () => {
        const promise = waitForSubscribe(broker, 'test/specific')

        setImmediate(() => {
          // Wrong topic
          broker.broker.emit('subscribe', [{ topic: 'test/other' }])

          // Correct topic
          broker.broker.emit('subscribe', [{ topic: 'test/specific' }])
        })

        const result = await promise
        expect(result).toEqual([{ topic: 'test/specific' }])
      })

      test('should timeout if subscribe event is not emitted', async () => {
        await expect(waitForSubscribe(broker, 'test/topic', 100)).rejects.toThrow(
          /Timeout waiting for subscribe on topic test\/topic/
        )
      })

      test('should cleanup event listener on success', async () => {
        const removeListenerSpy = jest.spyOn(broker.broker, 'off')

        const promise = waitForSubscribe(broker)

        setImmediate(() => {
          broker.broker.emit('subscribe', [{ topic: 'test/topic' }])
        })

        await promise

        expect(removeListenerSpy).toHaveBeenCalledWith('subscribe', expect.any(Function))

        removeListenerSpy.mockRestore()
      })
    })

    describe('waitForUnsubscribe', () => {
      test('should resolve when unsubscribe event is emitted', async () => {
        const promise = waitForUnsubscribe(broker)

        setImmediate(() => {
          broker.broker.emit('unsubscribe', ['test/topic'])
        })

        const result = await promise
        expect(result).toEqual(['test/topic'])
      })

      test('should filter by topic pattern', async () => {
        const promise = waitForUnsubscribe(broker, 'test/specific')

        setImmediate(() => {
          // Wrong topic
          broker.broker.emit('unsubscribe', ['test/other'])

          // Correct topic
          broker.broker.emit('unsubscribe', ['test/specific'])
        })

        const result = await promise
        expect(result).toEqual(['test/specific'])
      })

      test('should timeout if unsubscribe event is not emitted', async () => {
        await expect(waitForUnsubscribe(broker, 'test/topic', 100)).rejects.toThrow(
          /Timeout waiting for unsubscribe on topic test\/topic/
        )
      })

      test('should cleanup event listener on success', async () => {
        const removeListenerSpy = jest.spyOn(broker.broker, 'off')

        const promise = waitForUnsubscribe(broker)

        setImmediate(() => {
          broker.broker.emit('unsubscribe', ['test/topic'])
        })

        await promise

        expect(removeListenerSpy).toHaveBeenCalledWith('unsubscribe', expect.any(Function))

        removeListenerSpy.mockRestore()
      })
    })
  })

  describe('topic matching (via event helpers)', () => {
    let broker: TestBroker

    beforeEach(async () => {
      broker = await startTestBroker()
    })

    afterEach(async () => {
      await broker.close()
    })

    test('should match exact topics', async () => {
      const promise = waitForPublish(broker, 'exact/topic')

      setImmediate(() => {
        broker.broker.emit('publish', {
          topic: 'exact/topic',
          payload: Buffer.from('message'),
        })
      })

      const result = await promise
      expect(result.topic).toBe('exact/topic')
    })

    test('should match single-level wildcard (+)', async () => {
      const promise = waitForPublish(broker, 'devices/+/data')

      setImmediate(() => {
        // Should not match (wrong level count)
        broker.broker.emit('publish', {
          topic: 'devices/data',
          payload: Buffer.from('wrong1'),
        })

        // Should match
        broker.broker.emit('publish', {
          topic: 'devices/device1/data',
          payload: Buffer.from('correct'),
        })
      })

      const result = await promise
      expect(result.topic).toBe('devices/device1/data')
      expect(result.payload.toString()).toBe('correct')
    })

    test('should match multi-level wildcard (#)', async () => {
      const promise = waitForPublish(broker, 'devices/#')

      setImmediate(() => {
        // Should match (any level under devices/)
        broker.broker.emit('publish', {
          topic: 'devices/device1/data/temperature',
          payload: Buffer.from('correct'),
        })
      })

      const result = await promise
      expect(result.topic).toBe('devices/device1/data/temperature')
      expect(result.payload.toString()).toBe('correct')
    })

    test('should not match when wildcard pattern does not match', async () => {
      const promise = waitForPublish(broker, 'devices/+/data', 100)

      setImmediate(() => {
        // Should not match (different path structure)
        broker.broker.emit('publish', {
          topic: 'sensors/device1/data',
          payload: Buffer.from('wrong'),
        })
      })

      await expect(promise).rejects.toThrow(/Timeout/)
    })
  })
})

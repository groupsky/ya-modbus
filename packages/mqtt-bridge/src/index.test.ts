import { describe, it, expect } from '@jest/globals'

import { createBridge } from './index.js'

describe('createBridge', () => {
  it('should create a bridge instance', () => {
    const bridge = createBridge({
      mqtt: {
        url: 'mqtt://localhost:1883',
      },
    })

    expect(bridge).toBeDefined()
    expect(bridge.start).toBeInstanceOf(Function)
    expect(bridge.stop).toBeInstanceOf(Function)
    expect(bridge.getStatus).toBeInstanceOf(Function)
  })

  it('should have initial status as stopped', () => {
    const bridge = createBridge({
      mqtt: {
        url: 'mqtt://localhost:1883',
      },
    })

    const status = bridge.getStatus()
    expect(status.state).toBe('stopped')
    expect(status.deviceCount).toBe(0)
  })

  it('should transition to running state when started', async () => {
    const bridge = createBridge({
      mqtt: {
        url: 'mqtt://localhost:1883',
      },
    })

    await bridge.start()

    const status = bridge.getStatus()
    expect(status.state).toBe('running')
  })

  it('should transition to stopped state when stopped', async () => {
    const bridge = createBridge({
      mqtt: {
        url: 'mqtt://localhost:1883',
      },
    })

    await bridge.start()
    await bridge.stop()

    const status = bridge.getStatus()
    expect(status.state).toBe('stopped')
  })
})

import { describe, it, expect } from '@jest/globals'

import { createBridge } from './index.js'

describe('createBridge', () => {
  it('should be defined', () => {
    expect(createBridge).toBeDefined()
  })

  it('should throw not implemented error', () => {
    expect(() =>
      createBridge({
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      })
    ).toThrow('Not implemented yet')
  })
})

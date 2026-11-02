import { describe, it, expect, beforeEach } from '@jest/globals'

import { DEFAULT_HEARTBEAT_MS, PublishFilter } from './publish-filter.js'
import type { PublishConfig } from './types.js'

describe('PublishFilter', () => {
  const onChange: PublishConfig = { mode: 'on-change', heartbeat: 60000 }
  let filter: PublishFilter

  beforeEach(() => {
    filter = new PublishFilter()
  })

  it('publishes every poll by default', () => {
    expect(filter.shouldPublish('dev', { a: 1 }, undefined, false, 0)).toBe(true)
    expect(filter.shouldPublish('dev', { a: 1 }, undefined, false, 1)).toBe(true)
    expect(filter.shouldPublish('dev', { a: 1 }, { mode: 'every-poll' }, false, 2)).toBe(true)
  })

  it('publishes the first poll in on-change mode', () => {
    expect(filter.shouldPublish('dev', { a: 1 }, onChange, false, 0)).toBe(true)
  })

  it('does not publish when nothing changed', () => {
    filter.shouldPublish('dev', { a: 1 }, onChange, false, 0)
    expect(filter.shouldPublish('dev', { a: 1 }, onChange, false, 1000)).toBe(false)
  })

  it('publishes when a value changed', () => {
    filter.shouldPublish('dev', { a: 1, b: 2 }, onChange, false, 0)
    expect(filter.shouldPublish('dev', { a: 1, b: 3 }, onChange, false, 1000)).toBe(true)
    expect(filter.shouldPublish('dev', { a: 1, b: 3 }, onChange, false, 2000)).toBe(false)
  })

  it('publishes at the heartbeat when nothing changed', () => {
    filter.shouldPublish('dev', { a: 1 }, onChange, false, 0)
    expect(filter.shouldPublish('dev', { a: 1 }, onChange, false, 59999)).toBe(false)
    expect(filter.shouldPublish('dev', { a: 1 }, onChange, false, 60000)).toBe(true)
    expect(filter.shouldPublish('dev', { a: 1 }, onChange, false, 60001)).toBe(false)
  })

  it('uses a heartbeat of 5 minutes when it is not set', () => {
    const config: PublishConfig = { mode: 'on-change' }
    filter.shouldPublish('dev', { a: 1 }, config, false, 0)
    expect(filter.shouldPublish('dev', { a: 1 }, config, false, DEFAULT_HEARTBEAT_MS - 1)).toBe(
      false
    )
    expect(filter.shouldPublish('dev', { a: 1 }, config, false, DEFAULT_HEARTBEAT_MS)).toBe(true)
  })

  it('publishes a forced read (the read after a write) when nothing changed', () => {
    filter.shouldPublish('dev', { a: 1 }, onChange, false, 0)
    expect(filter.shouldPublish('dev', { a: 1 }, onChange, true, 1000)).toBe(true)
  })

  it('publishes the next poll after forget, for one device or all', () => {
    filter.shouldPublish('one', { a: 1 }, onChange, false, 0)
    filter.shouldPublish('two', { a: 1 }, onChange, false, 0)
    filter.forget('one')
    expect(filter.shouldPublish('one', { a: 1 }, onChange, false, 1)).toBe(true)
    expect(filter.shouldPublish('two', { a: 1 }, onChange, false, 1)).toBe(false)
    filter.forget()
    expect(filter.shouldPublish('two', { a: 1 }, onChange, false, 2)).toBe(true)
  })

  it('keeps the devices apart', () => {
    filter.shouldPublish('one', { a: 1 }, onChange, false, 0)
    expect(filter.shouldPublish('two', { a: 1 }, onChange, false, 1)).toBe(true)
  })
})

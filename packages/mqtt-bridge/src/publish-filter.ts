import type { PublishConfig } from './types.js'

/** Default for `publish.heartbeat` in `on-change` mode: 5 minutes */
export const DEFAULT_HEARTBEAT_MS = 300000

interface LastPublish {
  json: string
  at: number
}

/**
 * Decides if the data of a read is published, following the `publish` option of the device.
 * In `on-change` mode it remembers the last published data of each device.
 */
export class PublishFilter {
  private readonly last = new Map<string, LastPublish>()

  /**
   * True if the data is published. `force` publishes in every mode, for example for the read
   * after a write. A device without a last published data (the first read, or after `forget`)
   * always publishes.
   */
  shouldPublish(
    deviceId: string,
    data: Record<string, unknown>,
    config: PublishConfig | undefined,
    force = false,
    now = Date.now()
  ): boolean {
    if (config?.mode !== 'on-change') return true

    const json = JSON.stringify(data)
    const previous = this.last.get(deviceId)
    const heartbeat = config.heartbeat ?? DEFAULT_HEARTBEAT_MS
    const publish =
      force ||
      previous?.json !== json ||
      now - (previous?.at ?? Number.NEGATIVE_INFINITY) >= heartbeat
    if (publish) this.last.set(deviceId, { json, at: now })
    return publish
  }

  /** The next read of the device (of every device without an id) is published */
  forget(deviceId?: string): void {
    if (deviceId === undefined) this.last.clear()
    else this.last.delete(deviceId)
  }
}

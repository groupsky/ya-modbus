/** What the lines with a fixed poll order need from the polling scheduler */
export interface FixedOrderDevices {
  isRunning(): boolean
  /** When the device may be polled next, or undefined while it has no poll chain */
  dueAt(deviceId: string): number | undefined
  /** Poll the device once; resolves when the poll has ended */
  poll(deviceId: string): Promise<void>
}

interface Line {
  // Device ids in the order they take turns
  order: string[]
  // Index in order of the device whose turn is next, can be past the end
  next: number
  // True while the line polls its devices
  active: boolean
  // Pending timer until the next device is due
  timer?: NodeJS.Timeout | undefined
}

/**
 * The lines with `connection.pollOrder: 'fixed'`. The devices of a line take turns in the order
 * they were added. In its turn a device is polled when it is due; a device that is not due skips
 * its turn. When no device is due, the line waits until the first one is due, and goes on with
 * the device whose turn is next.
 */
export class FixedOrderLines {
  private lines = new Map<string, Line>()

  constructor(private devices: FixedOrderDevices) {}

  /** Add a device at the end of the order of its line */
  add(key: string, deviceId: string): void {
    const line = this.lines.get(key) ?? { order: [], next: 0, active: false }
    line.order.push(deviceId)
    this.lines.set(key, line)
  }

  remove(key: string, deviceId: string): void {
    const line = this.lines.get(key)
    const index = line?.order.indexOf(deviceId) ?? -1
    if (!line || index < 0) return

    line.order.splice(index, 1)
    // The device after the removed one keeps its turn
    if (index < line.next) line.next--
    if (line.order.length === 0) {
      clearTimeout(line.timer)
      this.lines.delete(key)
    }
  }

  /** A device of the line got a new due time */
  wake(key: string): void {
    const line = this.lines.get(key)
    if (!line || line.active) return
    clearTimeout(line.timer)
    line.timer = undefined
    void this.run(key, line)
  }

  /** Clear the timers. A poll in flight ends, and then its line stops. */
  stop(): void {
    for (const line of this.lines.values()) {
      clearTimeout(line.timer)
      line.timer = undefined
    }
  }

  private async run(key: string, line: Line): Promise<void> {
    line.active = true
    try {
      while (this.devices.isRunning() && this.lines.get(key) === line) {
        const now = Date.now()
        let earliest = Infinity
        let due: number | undefined
        for (let i = 0; i < line.order.length; i++) {
          const index = (line.next + i) % line.order.length
          const dueAt = this.devices.dueAt(line.order[index] as string) ?? Infinity
          if (dueAt <= now) {
            due = index
            break
          }
          earliest = Math.min(earliest, dueAt)
        }

        if (due === undefined) {
          // Each due time is at most the longest poll delay ahead, which setTimeout supports
          if (earliest !== Infinity) {
            line.timer = setTimeout(() => {
              line.timer = undefined
              this.wake(key)
            }, earliest - now)
          }
          return
        }

        line.next = due + 1
        await this.devices.poll(line.order[due] as string)
      }
    } finally {
      line.active = false
    }
  }
}

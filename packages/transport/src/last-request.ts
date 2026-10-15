/**
 * Pause between requests to different slaves on one connection
 */

import { sleep } from './retry.js'

/**
 * The last request on a connection: the slave it went to and when it ended.
 *
 * The SlaveTransports on one connection share one LastRequest, so a transport knows when the
 * previous request went to another slave. Some meters do not answer a request that comes too
 * soon after another meter's reply.
 */
export class LastRequest {
  private slaveId: number | undefined
  private endedAt = 0

  /**
   * Wait until `delay` ms have passed since the end of the last request, when it went to
   * another slave. No wait before the first request, or before a request to the same slave.
   *
   * @param slaveId - Slave of the next request
   * @param delay - Pause in milliseconds after a request to another slave
   */
  async waitBefore(slaveId: number, delay: number): Promise<void> {
    if (this.slaveId === undefined || this.slaveId === slaveId) return

    const wait = this.endedAt + delay - performance.now()
    if (wait > 0) await sleep(wait)
  }

  /**
   * Note the end of a request, also of a failed one
   *
   * @param slaveId - Slave of the request
   */
  ended(slaveId: number): void {
    this.slaveId = slaveId
    this.endedAt = performance.now()
  }
}

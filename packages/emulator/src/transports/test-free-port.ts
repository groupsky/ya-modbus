/**
 * Free TCP port for tests that need the real ServerTCP
 */

import { createServer, type AddressInfo } from 'node:net'

/**
 * Finds a free TCP port on 127.0.0.1. ServerTCP treats port 0 as "use 502", so it cannot be
 * given an ephemeral port directly.
 */
export const getFreePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo
      probe.close((err) => (err ? reject(err) : resolve(port)))
    })
  })

import { createServer } from 'node:net'

import Aedes from 'aedes'

/**
 * Get a free port by creating a temporary server and closing it
 */
async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to get free port'))
        return
      }
      const port = address.port
      server.close(() => {
        resolve(port)
      })
    })
    server.on('error', reject)
  })
}

export interface TestBroker {
  port: number
  url: string
  close: () => Promise<void>
}

/**
 * Start an Aedes MQTT broker on a dynamic port for testing
 */
export async function startTestBroker(): Promise<TestBroker> {
  const port = await getFreePort()
  const aedes = new Aedes()
  const server = createServer(aedes.handle)

  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      resolve({
        port,
        url: `mqtt://localhost:${port}`,
        close: () =>
          new Promise<void>((resolveClose, rejectClose) => {
            aedes.close(() => {
              server.close((err) => {
                if (err) {
                  rejectClose(err)
                } else {
                  resolveClose()
                }
              })
            })
          }),
      })
    })
    server.on('error', reject)
  })
}

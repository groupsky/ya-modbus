/**
 * Raw TCP client helpers for tests that need a misbehaving client
 */

import { Socket } from 'node:net'

// Modbus read of one holding register of slave 1, with the MBAP header of Modbus TCP
const READ_REQUEST = Buffer.from([0, 1, 0, 0, 0, 6, 1, 3, 0, 0, 0, 1])

/**
 * Resets the connection of a client (TCP RST). Resolves when the connection is closed.
 *
 * Without `requestReceived`, the client resets right after it connected. With it, the client
 * sends a request first and resets when `requestReceived` resolves, which the test does when
 * the server has handled the request. A reset that arrives together with the request ends the
 * connection without an error on Node 22, so the server reports no socket error.
 */
export async function resetConnection(
  host: string,
  port: number,
  requestReceived?: Promise<void>
): Promise<void> {
  const socket = new Socket()
  await new Promise<void>((resolve) => socket.connect(port, host, resolve))
  const closed = new Promise<void>((resolve) => socket.once('close', () => resolve()))
  if (requestReceived) {
    await new Promise<void>((resolve) => socket.write(READ_REQUEST, () => resolve()))
    await requestReceived
  }
  socket.resetAndDestroy()
  await closed
}

/**
 * Waits until the condition holds. Throws if it does not hold within two seconds.
 */
export async function waitUntil(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (condition()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error('Condition did not hold within 2 s')
}

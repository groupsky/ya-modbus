/**
 * Base transport abstract class
 */

export abstract class BaseTransport {
  abstract start(): Promise<void>
  abstract stop(): Promise<void>
  abstract send(slaveId: number, response: Buffer): Promise<void>
  abstract onRequest(handler: (slaveId: number, request: Buffer) => Promise<Buffer>): void
}

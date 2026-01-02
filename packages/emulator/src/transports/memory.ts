/**
 * In-memory transport for testing
 */

import { BaseTransport } from './base.js'

export class MemoryTransport extends BaseTransport {
  private requestHandler?: (slaveId: number, request: Buffer) => Promise<Buffer>

  async start(): Promise<void> {
    // Nothing to do for memory transport
  }

  async stop(): Promise<void> {
    // Nothing to do for memory transport
  }

  async send(_slaveId: number, _response: Buffer): Promise<void> {
    // In memory transport, send is not used directly
    // Responses are returned from sendRequest
  }

  onRequest(handler: (slaveId: number, request: Buffer) => Promise<Buffer>): void {
    this.requestHandler = handler
  }

  /**
   * Send a request and get response (for testing)
   */
  async sendRequest(slaveId: number, request: Buffer): Promise<Buffer> {
    if (!this.requestHandler) {
      throw new Error('No request handler set')
    }
    return this.requestHandler(slaveId, request)
  }
}

/**
 * Reject an answer with the wrong number of data bytes, so that withRetry
 * sends the request again like after a timeout. The request context is added
 * by withRequestContext.
 */
export function checkLength(buffer: Buffer, expectedBytes: number): Buffer {
  if (buffer.length !== expectedBytes) {
    throw new Error(
      `Wrong answer length: expected ${expectedBytes} data bytes, got ${buffer.length}`
    )
  }
  return buffer
}

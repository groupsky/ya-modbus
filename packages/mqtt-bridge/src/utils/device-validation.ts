import { z } from 'zod'

import { DRIVER_NAME_RULE, isValidDriverName } from '../driver-name.js'

/**
 * Longest duration a device config accepts: 24 hours. setTimeout runs delays above 2^31-1 ms
 * (24.8 days) after 1 ms, so a longer interval, retry backoff or timeout would act as a tight loop.
 */
const MAX_DURATION_MS = 86400000

/** Polling interval in ms when the config has none: no `polling`, or `continuous` mode */
export const DEFAULT_POLLING_INTERVAL = 5000

// MQTT topic segment requirements:
// - Cannot contain null character
// - Cannot contain + or # (MQTT wildcards)
// - Cannot start with $ (reserved for system topics)
// - Cannot contain / (topic level separator)
// eslint-disable-next-line no-control-regex
const mqttTopicSegmentRegex = /^[^+#$/\u0000]+$/

const deviceIdSchema = z
  .string()
  .min(1, 'Device ID must not be empty')
  .regex(mqttTopicSegmentRegex, {
    message: 'Device ID must not contain MQTT special characters (+, #, /, $) or null character',
  })

const driverNameSchema = z
  .string()
  .min(1, 'Driver name must not be empty')
  .refine(isValidDriverName, { message: `Driver name must be ${DRIVER_NAME_RULE}` })

/**
 * One message for every way a connection field can be wrong, so the operator reads the allowed
 * values instead of zod's generic text. A missing required field says "is required".
 */
const fieldError = (
  label: string,
  rule: string
): { error: (issue: { input?: unknown }) => string } => ({
  error: (issue) =>
    issue.input === undefined ? `${label} is required` : `${label} must be ${rule}`,
})

/** A whole number from min to max, with one message for every failure. */
const intInRange = (min: number, max: number, label: string, rule: string): z.ZodNumber => {
  // abort: the message is printed once (a number past 2^53 fails int() and max()), and the
  // checks across fields, such as maxRetryBackoff >= retryBackoff, do not add a second one
  const err = { ...fieldError(label, rule), abort: true }
  return z.number(err).int(err).min(min, err).max(max, err)
}

const serialPortError = fieldError('Serial port', 'a device path, for example /dev/ttyUSB0')
const baudRateError = fieldError('Baud rate', 'a number above 0, for example 9600')
const hostError = fieldError('Host', 'a host name or IP address')

const slaveIdSchema = intInRange(0, 247, 'Slave ID', 'a whole number from 0 to 247')

const timeoutSchema = intInRange(
  1,
  MAX_DURATION_MS,
  'Connection timeout',
  'a whole number of milliseconds from 1 to 86400000 (24 hours)'
).optional()

const attemptsSchema = z
  .number()
  .int()
  .min(1, 'Attempts must be at least 1 (1 sends each request once, with no retry)')
  .max(10, 'Attempts must not exceed 10')
  .optional()

const retryDelaySchema = z
  .number()
  .int()
  .min(0)
  .max(60000, 'Retry delay must not exceed 60 seconds')
  .optional()

const pollOrderSchema = z
  .enum(['arrival', 'fixed'], { message: "Poll order must be 'arrival' or 'fixed'" })
  .optional()

// Serial settings that are not set come from the driver when the device is added
const rtuConnectionSchema = z
  .strictObject({
    type: z.literal('rtu'),
    port: z.string(serialPortError).min(1, serialPortError),
    baudRate: z.number(baudRateError).positive(baudRateError).optional(),
    slaveId: slaveIdSchema,
    parity: z
      .enum(['none', 'even', 'odd'], fieldError('Parity', "'none', 'even' or 'odd'"))
      .optional(),
    dataBits: z.union([z.literal(7), z.literal(8)], fieldError('Data bits', '7 or 8')).optional(),
    stopBits: z.union([z.literal(1), z.literal(2)], fieldError('Stop bits', '1 or 2')).optional(),
    timeout: timeoutSchema,
    interDeviceDelay: intInRange(
      0,
      60000,
      'Inter-device delay',
      'a whole number of milliseconds from 0 to 60000 (60 seconds)'
    ).optional(),
    attempts: attemptsSchema,
    retryDelay: retryDelaySchema,
    pollOrder: pollOrderSchema,
  })
  .transform((data) => {
    const {
      baudRate,
      parity,
      dataBits,
      stopBits,
      timeout,
      interDeviceDelay,
      attempts,
      retryDelay,
      pollOrder,
      ...rest
    } = data
    return {
      ...rest,
      ...(baudRate !== undefined ? { baudRate } : {}),
      ...(parity !== undefined ? { parity } : {}),
      ...(dataBits !== undefined ? { dataBits } : {}),
      ...(stopBits !== undefined ? { stopBits } : {}),
      ...(timeout !== undefined ? { timeout } : {}),
      ...(interDeviceDelay !== undefined ? { interDeviceDelay } : {}),
      ...(attempts !== undefined ? { attempts } : {}),
      ...(retryDelay !== undefined ? { retryDelay } : {}),
      ...(pollOrder !== undefined ? { pollOrder } : {}),
    }
  })

const tcpConnectionSchema = z
  .strictObject({
    type: z.literal('tcp'),
    host: z.string(hostError).min(1, hostError),
    port: intInRange(1, 65535, 'TCP port', 'a whole number from 1 to 65535').optional(),
    slaveId: slaveIdSchema,
    timeout: timeoutSchema,
    attempts: attemptsSchema,
    retryDelay: retryDelaySchema,
    pollOrder: pollOrderSchema,
  })
  .transform((data) => {
    const { port, timeout, attempts, retryDelay, pollOrder, ...rest } = data
    return {
      ...rest,
      ...(port !== undefined ? { port } : {}),
      ...(timeout !== undefined ? { timeout } : {}),
      ...(attempts !== undefined ? { attempts } : {}),
      ...(retryDelay !== undefined ? { retryDelay } : {}),
      ...(pollOrder !== undefined ? { pollOrder } : {}),
    }
  })

/** A whole number of milliseconds from min to 24 hours, with one message for every failure. */
const msUpTo24h = (min: number, label: string): z.ZodNumber =>
  intInRange(
    min,
    MAX_DURATION_MS,
    label,
    `a whole number of milliseconds from ${min} to 86400000 (24 hours)`
  )

const pollingConfigSchema = z
  .strictObject({
    interval: msUpTo24h(100, 'Polling interval').optional(),
    mode: z
      .enum(['interval', 'continuous'], fieldError('Polling mode', "'interval' or 'continuous'"))
      .optional(),
    retryDelay: msUpTo24h(100, 'Retry delay').optional(),
    maxRetries: intInRange(0, 100, 'Max retries', 'a whole number from 0 to 100').optional(),
    retryBackoff: msUpTo24h(1, 'Retry backoff').optional(),
    maxRetryBackoff: msUpTo24h(1, 'Max retry backoff').optional(),
  })
  .refine(({ interval, mode }) => interval !== undefined || mode === 'continuous', {
    message: "Polling interval is required unless mode is 'continuous'",
    path: ['interval'],
  })
  // Same default as the polling scheduler: 2 x retryDelay, which defaults to interval
  .refine(
    ({ interval, retryDelay, retryBackoff, maxRetryBackoff }) =>
      maxRetryBackoff === undefined ||
      maxRetryBackoff >= (retryBackoff ?? (retryDelay ?? interval ?? DEFAULT_POLLING_INTERVAL) * 2),
    {
      message: 'Max retry backoff must not be below the retry backoff (default: 2 x retryDelay)',
      path: ['maxRetryBackoff'],
    }
  )
  .transform((data) => {
    const { interval, mode, retryDelay, maxRetries, retryBackoff, maxRetryBackoff, ...rest } = data
    return {
      ...rest,
      ...(interval !== undefined ? { interval } : {}),
      ...(mode !== undefined ? { mode } : {}),
      ...(retryDelay !== undefined ? { retryDelay } : {}),
      ...(maxRetries !== undefined ? { maxRetries } : {}),
      ...(retryBackoff !== undefined ? { retryBackoff } : {}),
      ...(maxRetryBackoff !== undefined ? { maxRetryBackoff } : {}),
    }
  })
  .optional()

const publishConfigSchema = z
  .strictObject({
    mode: z.enum(
      ['every-poll', 'on-change'],
      fieldError('Publish mode', "'every-poll' or 'on-change'")
    ),
    heartbeat: msUpTo24h(1, 'Heartbeat').optional(),
  })
  .transform((data) => {
    const { heartbeat, ...rest } = data
    return { ...rest, ...(heartbeat !== undefined ? { heartbeat } : {}) }
  })
  .optional()

export const deviceConfigSchema = z
  .strictObject({
    deviceId: deviceIdSchema,
    driver: driverNameSchema,
    device: z.string().min(1, 'Device key must not be empty').optional(),
    connection: z.discriminatedUnion('type', [rtuConnectionSchema, tcpConnectionSchema], {
      error: (issue) =>
        issue.input === undefined
          ? 'Connection is required'
          : "Connection type must be 'rtu' or 'tcp'",
    }),
    enabled: z.boolean().optional(),
    polling: pollingConfigSchema,
    allowWrites: z.boolean().optional(),
    publish: publishConfigSchema,
  })
  .transform((data) => {
    const { device, enabled, polling, allowWrites, publish, ...rest } = data
    return {
      ...rest,
      ...(device !== undefined ? { device } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
      ...(polling !== undefined ? { polling } : {}),
      ...(allowWrites !== undefined ? { allowWrites } : {}),
      ...(publish !== undefined ? { publish } : {}),
    }
  })

export function validateDeviceConfig(config: unknown): void {
  const result = deviceConfigSchema.safeParse(config)

  if (!result.success) {
    const errors = result.error.issues
      .map((e) => (e.path.length ? `${e.path.join('.')}: ${e.message}` : e.message))
      .join(', ')
    throw new Error(`Invalid device configuration: ${errors}`)
  }
}

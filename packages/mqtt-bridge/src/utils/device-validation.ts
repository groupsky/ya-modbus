import { DRIVER_PACKAGE_NAME_RULE, isValidDriverPackageName } from '@ya-modbus/driver-loader'
import { z } from 'zod'

/**
 * Longest duration a device config accepts: 24 hours. setTimeout runs delays above 2^31-1 ms
 * (24.8 days) after 1 ms, so a longer interval, retry backoff or timeout would act as a tight loop.
 */
const MAX_DURATION_MS = 86400000

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
  .refine(isValidDriverPackageName, { message: `Driver package name ${DRIVER_PACKAGE_NAME_RULE}` })

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
  const err = fieldError(label, rule)
  // abort: a number past 2^53 fails int() and max(); the message is printed once
  return z
    .number(err)
    .int({ ...err, abort: true })
    .min(min, err)
    .max(max, err)
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
    pollOrder: pollOrderSchema,
  })
  .transform((data) => {
    const { baudRate, parity, dataBits, stopBits, timeout, interDeviceDelay, pollOrder, ...rest } =
      data
    return {
      ...rest,
      ...(baudRate !== undefined ? { baudRate } : {}),
      ...(parity !== undefined ? { parity } : {}),
      ...(dataBits !== undefined ? { dataBits } : {}),
      ...(stopBits !== undefined ? { stopBits } : {}),
      ...(timeout !== undefined ? { timeout } : {}),
      ...(interDeviceDelay !== undefined ? { interDeviceDelay } : {}),
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
    pollOrder: pollOrderSchema,
  })
  .transform((data) => {
    const { port, timeout, pollOrder, ...rest } = data
    return {
      ...rest,
      ...(port !== undefined ? { port } : {}),
      ...(timeout !== undefined ? { timeout } : {}),
      ...(pollOrder !== undefined ? { pollOrder } : {}),
    }
  })

const pollingConfigSchema = z
  .strictObject({
    interval: z
      .number()
      .int()
      .positive()
      .min(100, 'Polling interval must be at least 100ms')
      .max(MAX_DURATION_MS, 'Polling interval must not exceed 24 hours'),
    mode: z.enum(['interval', 'continuous']).optional(),
    maxRetries: z
      .number()
      .int()
      .nonnegative()
      .max(100, 'Max retries should not exceed 100')
      .optional(),
    retryBackoff: z
      .number()
      .int()
      .positive()
      .max(MAX_DURATION_MS, 'Retry backoff must not exceed 24 hours')
      .optional(),
    maxRetryBackoff: z
      .number()
      .int()
      .positive()
      .max(MAX_DURATION_MS, 'Max retry backoff must not exceed 24 hours')
      .optional(),
  })
  // Same default as the polling scheduler: 2 x interval
  .refine(
    ({ interval, retryBackoff, maxRetryBackoff }) =>
      maxRetryBackoff === undefined || maxRetryBackoff >= (retryBackoff ?? interval * 2),
    {
      message: 'Max retry backoff must not be below the retry backoff (default: 2 x interval)',
      path: ['maxRetryBackoff'],
    }
  )
  .transform((data) => {
    const { mode, maxRetries, retryBackoff, maxRetryBackoff, ...rest } = data
    return {
      ...rest,
      ...(mode !== undefined ? { mode } : {}),
      ...(maxRetries !== undefined ? { maxRetries } : {}),
      ...(retryBackoff !== undefined ? { retryBackoff } : {}),
      ...(maxRetryBackoff !== undefined ? { maxRetryBackoff } : {}),
    }
  })
  .optional()

const publishConfigSchema = z
  .strictObject({
    mode: z.enum(['every-poll', 'on-change']),
    heartbeat: z
      .number()
      .int()
      .positive()
      .max(MAX_DURATION_MS, 'Heartbeat must not exceed 24 hours')
      .optional(),
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
    const { enabled, polling, allowWrites, publish, ...rest } = data
    return {
      ...rest,
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

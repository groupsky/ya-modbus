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

const timeoutSchema = z
  .number()
  .int()
  .positive()
  .max(MAX_DURATION_MS, 'Connection timeout must not exceed 24 hours')
  .optional()

// Serial settings that are not set come from the driver when the device is added
const rtuConnectionSchema = z
  .strictObject({
    type: z.literal('rtu'),
    port: z.string().min(1),
    baudRate: z.number().positive().optional(),
    slaveId: z.number().int().min(0).max(247),
    parity: z.enum(['none', 'even', 'odd']).optional(),
    dataBits: z.union([z.literal(7), z.literal(8)]).optional(),
    stopBits: z.union([z.literal(1), z.literal(2)]).optional(),
    timeout: timeoutSchema,
    interDeviceDelay: z
      .number()
      .int()
      .min(0)
      .max(60000, 'Inter-device delay must not exceed 60 seconds')
      .optional(),
  })
  .transform((data) => {
    const { baudRate, parity, dataBits, stopBits, timeout, interDeviceDelay, ...rest } = data
    return {
      ...rest,
      ...(baudRate !== undefined ? { baudRate } : {}),
      ...(parity !== undefined ? { parity } : {}),
      ...(dataBits !== undefined ? { dataBits } : {}),
      ...(stopBits !== undefined ? { stopBits } : {}),
      ...(timeout !== undefined ? { timeout } : {}),
      ...(interDeviceDelay !== undefined ? { interDeviceDelay } : {}),
    }
  })

const tcpConnectionSchema = z
  .strictObject({
    type: z.literal('tcp'),
    host: z.string().min(1),
    port: z.number().int().positive().max(65535).optional(),
    slaveId: z.number().int().min(0).max(247),
    timeout: timeoutSchema,
  })
  .transform((data) => {
    const { port, timeout, ...rest } = data
    return {
      ...rest,
      ...(port !== undefined ? { port } : {}),
      ...(timeout !== undefined ? { timeout } : {}),
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
  })
  .transform((data) => {
    const { mode, maxRetries, retryBackoff, ...rest } = data
    return {
      ...rest,
      ...(mode !== undefined ? { mode } : {}),
      ...(maxRetries !== undefined ? { maxRetries } : {}),
      ...(retryBackoff !== undefined ? { retryBackoff } : {}),
    }
  })
  .optional()

export const deviceConfigSchema = z
  .strictObject({
    deviceId: deviceIdSchema,
    driver: driverNameSchema,
    connection: z.union([rtuConnectionSchema, tcpConnectionSchema]),
    enabled: z.boolean().optional(),
    polling: pollingConfigSchema,
  })
  .transform((data) => {
    const { enabled, polling, ...rest } = data
    return {
      ...rest,
      ...(enabled !== undefined ? { enabled } : {}),
      ...(polling !== undefined ? { polling } : {}),
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

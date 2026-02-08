import { z } from 'zod'

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
  .regex(/^(@ya-modbus\/driver-[a-z0-9-]+|ya-modbus-driver-[a-z0-9-]+)$/, {
    message:
      'Driver must be @ya-modbus/driver-<name> or ya-modbus-driver-<name> with only lowercase letters, numbers, and hyphens',
  })
  .refine((name) => !name.includes('..') && !name.includes('\\'), {
    message: 'Driver name cannot contain path traversal sequences',
  })

const rtuConnectionSchema = z
  .object({
    type: z.literal('rtu'),
    port: z.string().min(1),
    baudRate: z.number().positive(),
    slaveId: z.number().int().min(0).max(247),
    parity: z.enum(['none', 'even', 'odd']).default('none'),
    dataBits: z.union([z.literal(7), z.literal(8)]).default(8),
    stopBits: z.union([z.literal(1), z.literal(2)]).default(1),
    timeout: z.number().int().positive().optional(),
  })
  .transform((data) => {
    const { timeout, ...rest } = data
    return timeout !== undefined ? { ...rest, timeout } : rest
  })

const tcpConnectionSchema = z
  .object({
    type: z.literal('tcp'),
    host: z.string().min(1),
    port: z.number().int().positive().max(65535).optional(),
    slaveId: z.number().int().min(0).max(247),
    timeout: z.number().int().positive().optional(),
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
  .object({
    interval: z
      .number()
      .int()
      .positive()
      .min(100, 'Polling interval must be at least 100ms')
      .max(86400000, 'Polling interval must not exceed 24 hours'),
    maxRetries: z
      .number()
      .int()
      .nonnegative()
      .max(100, 'Max retries should not exceed 100')
      .optional(),
    retryBackoff: z.number().int().positive().optional(),
  })
  .transform((data) => {
    const { maxRetries, retryBackoff, ...rest } = data
    return {
      ...rest,
      ...(maxRetries !== undefined ? { maxRetries } : {}),
      ...(retryBackoff !== undefined ? { retryBackoff } : {}),
    }
  })
  .optional()

export const deviceConfigSchema = z
  .object({
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
    const errors = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
    throw new Error(`Invalid device configuration: ${errors}`)
  }
}

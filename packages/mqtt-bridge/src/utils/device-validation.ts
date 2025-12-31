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

const rtuConnectionSchema = z.object({
  type: z.literal('rtu'),
  port: z.string().min(1),
  baudRate: z.number().positive(),
  slaveId: z.number().int().min(0).max(247),
  parity: z.enum(['none', 'even', 'odd']).optional(),
  dataBits: z.union([z.literal(7), z.literal(8)]).optional(),
  stopBits: z.union([z.literal(1), z.literal(2)]).optional(),
})

const tcpConnectionSchema = z.object({
  type: z.literal('tcp'),
  host: z.string().min(1),
  port: z.number().int().positive().max(65535),
  slaveId: z.number().int().min(0).max(247),
})

export const deviceConfigSchema = z.object({
  deviceId: deviceIdSchema,
  driver: z.string().min(1, 'Driver name must not be empty'),
  connection: z.union([rtuConnectionSchema, tcpConnectionSchema]),
  enabled: z.boolean().optional(),
})

export function validateDeviceConfig(config: unknown): void {
  const result = deviceConfigSchema.safeParse(config)

  if (!result.success) {
    const errors = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
    throw new Error(`Invalid device configuration: ${errors}`)
  }
}

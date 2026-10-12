import { z } from 'zod'

import { deviceConfigSchema } from './device-validation.js'

export const mqttUrlSchema = z
  .string()
  .url()
  .regex(/^(mqtt|mqtts|ws|wss):\/\//, {
    message: 'URL must start with mqtt://, mqtts://, ws://, or wss://',
  })

// 24 hours. setTimeout runs delays above 2^31-1 ms (24.8 days) after 1 ms, so a longer
// reconnect period would make the MQTT client reconnect in a tight loop.
const MAX_RECONNECT_PERIOD_MS = 86400000

export const mqttConfigSchema = z.object({
  url: mqttUrlSchema,
  clientId: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  reconnectPeriod: z
    .number()
    .int()
    .positive()
    .max(MAX_RECONNECT_PERIOD_MS, 'Reconnect period must not exceed 24 hours')
    .optional(),
})

export const mqttBridgeConfigSchema = z.object({
  mqtt: mqttConfigSchema,
  stateDir: z.string().optional(),
  topicPrefix: z
    .string()
    // eslint-disable-next-line no-control-regex
    .regex(/^[^+#/$\x00]+$/, {
      message:
        'Topic prefix must not contain MQTT special characters (+, #, /, $) or null character',
    })
    .optional(),
  devices: z.array(deviceConfigSchema).optional(),
})

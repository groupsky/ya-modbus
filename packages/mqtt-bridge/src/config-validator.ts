import { z } from 'zod'

import type { MqttBridgeConfig } from './types.js'

const mqttConfigSchema = z.object({
  url: z
    .string()
    .url()
    .regex(/^(mqtt|mqtts|ws|wss):\/\//, {
      message: 'URL must start with mqtt://, mqtts://, ws://, or wss://',
    }),
  clientId: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  reconnectPeriod: z.number().int().positive().optional(),
})

const mqttBridgeConfigSchema = z.object({
  mqtt: mqttConfigSchema,
  stateDir: z.string().optional(),
  topicPrefix: z.string().optional(),
})

export function validateConfig(config: unknown): asserts config is MqttBridgeConfig {
  const result = mqttBridgeConfigSchema.safeParse(config)

  if (!result.success) {
    const errors = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
    throw new Error(`Invalid configuration: ${errors}`)
  }
}

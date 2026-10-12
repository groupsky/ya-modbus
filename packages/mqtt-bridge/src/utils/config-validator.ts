import type { MqttBridgeConfig } from '../types.js'

import { mqttBridgeConfigSchema } from './config-schema.js'

export function validateConfig(config: unknown): asserts config is MqttBridgeConfig {
  const result = mqttBridgeConfigSchema.safeParse(config)

  if (!result.success) {
    const errors = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
    throw new Error(`Invalid configuration: ${errors}`)
  }
}

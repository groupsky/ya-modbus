import type { z } from 'zod'

import type { MqttBridgeConfig } from '../types.js'

import { mqttBridgeConfigSchema } from './config-schema.js'

/** A config that does not match the schema. `errors` has one entry per problem, with its path. */
export class ConfigValidationError extends Error {
  readonly errors: readonly string[]

  constructor(zodError: z.ZodError) {
    const errors = zodError.issues.map((e) =>
      e.path.length ? `${e.path.join('.')}: ${e.message}` : e.message
    )
    super(`Invalid configuration: ${errors.join(', ')}`)
    this.name = 'ConfigValidationError'
    this.errors = errors
  }
}

export function validateConfig(config: unknown): asserts config is MqttBridgeConfig {
  const result = mqttBridgeConfigSchema.safeParse(config)

  if (!result.success) throw new ConfigValidationError(result.error)
}

import { readFile } from 'node:fs/promises'

import { z } from 'zod'

import type { MqttBridgeConfig } from './types.js'

const mqttBridgeConfigSchema = z.object({
  mqtt: z.object({
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
  }),
  stateDir: z.string().optional(),
  topicPrefix: z.string().optional(),
})

export async function loadConfig(configPath: string): Promise<MqttBridgeConfig> {
  const content = await readFile(configPath, 'utf-8')
  const json = JSON.parse(content) as unknown

  const result = mqttBridgeConfigSchema.safeParse(json)

  if (!result.success) {
    const errors = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
    throw new Error(`Invalid configuration: ${errors}`)
  }

  // Convert Zod output (with T | undefined) to MqttBridgeConfig (with T?)
  const config: MqttBridgeConfig = {
    mqtt: {
      url: result.data.mqtt.url,
      ...(result.data.mqtt.clientId !== undefined && { clientId: result.data.mqtt.clientId }),
      ...(result.data.mqtt.username !== undefined && { username: result.data.mqtt.username }),
      ...(result.data.mqtt.password !== undefined && { password: result.data.mqtt.password }),
      ...(result.data.mqtt.reconnectPeriod !== undefined && {
        reconnectPeriod: result.data.mqtt.reconnectPeriod,
      }),
    },
    ...(result.data.stateDir !== undefined && { stateDir: result.data.stateDir }),
    ...(result.data.topicPrefix !== undefined && { topicPrefix: result.data.topicPrefix }),
  }

  return config
}

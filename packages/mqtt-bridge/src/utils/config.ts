import { readFile } from 'node:fs/promises'

import { z } from 'zod'

import type { MqttBridgeConfig } from '../types.js'

const mqttConfigSchema = z.object({
  url: z
    .string()
    .url()
    .regex(/^(mqtt|mqtts|ws|wss):\/\//, {
      message: 'URL must start with mqtt://, mqtts://, ws://, or wss://',
    })
    .default('mqtt://localhost:1883'),
  clientId: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  reconnectPeriod: z.number().int().positive().optional(),
})

const mqttBridgeConfigSchema = z.object({
  mqtt: mqttConfigSchema.default({ url: 'mqtt://localhost:1883' }),
  stateDir: z.string().optional(),
  topicPrefix: z
    .string()
    // eslint-disable-next-line no-control-regex
    .regex(/^[^+#/$\x00]+$/, {
      message:
        'Topic prefix must not contain MQTT special characters (+, #, /, $) or null character',
    })
    .optional(),
})

export async function loadConfig(configPath: string): Promise<MqttBridgeConfig> {
  const content = await readFile(configPath, 'utf-8')
  const json = JSON.parse(content) as unknown

  /* istanbul ignore next - defensive: JSON.parse never returns null */
  const result = mqttBridgeConfigSchema.safeParse(json === null ? {} : json)

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

import { readFile } from 'node:fs/promises'

import type { MqttBridgeConfig } from '../types.js'

import { mqttBridgeConfigSchema, mqttConfigSchema, mqttUrlSchema } from './config-schema.js'

const DEFAULT_MQTT_URL = 'mqtt://localhost:1883'

// A config file can leave out the MQTT section or its URL. Options from the command line are
// merged in afterwards, so only the file gets these defaults.
const configFileSchema = mqttBridgeConfigSchema.extend({
  mqtt: mqttConfigSchema
    .extend({ url: mqttUrlSchema.default(DEFAULT_MQTT_URL) })
    .default({ url: DEFAULT_MQTT_URL }),
})

export async function loadConfig(configPath: string): Promise<MqttBridgeConfig> {
  const content = await readFile(configPath, 'utf-8')
  const json = JSON.parse(content) as unknown

  /* istanbul ignore next - defensive: JSON.parse never returns null */
  const result = configFileSchema.safeParse(json === null ? {} : json)

  if (!result.success) {
    const errors = result.error.issues
      .map((e) => (e.path.length ? `${e.path.join('.')}: ${e.message}` : e.message))
      .join(', ')
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
    ...(result.data.devices !== undefined && { devices: result.data.devices }),
  }

  return config
}

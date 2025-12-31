import { readFile } from 'node:fs/promises'

import type { MqttBridgeConfig } from './types.js'

export async function loadConfig(configPath: string): Promise<MqttBridgeConfig> {
  const content = await readFile(configPath, 'utf-8')
  const config = JSON.parse(content) as MqttBridgeConfig

  if (!config.mqtt?.url) {
    throw new Error('Configuration must include mqtt.url')
  }

  return config
}

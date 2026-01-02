/**
 * Configuration file loader for YAML and JSON formats
 */

import { readFile } from 'fs/promises'

import yaml from 'js-yaml'

import type { DeviceConfig } from '../types/config.js'

export interface ConfigFile {
  transport: {
    type: 'tcp' | 'rtu' | 'memory'
    port?: number | string
    host?: string
    baudRate?: number
    parity?: 'none' | 'even' | 'odd'
    dataBits?: 7 | 8
    stopBits?: 1 | 2
  }
  devices: DeviceConfig[]
}

/**
 * Load configuration from YAML or JSON file
 */
export async function loadConfig(filePath: string): Promise<ConfigFile> {
  // Read file content
  const content = await readFile(filePath, 'utf-8')

  // Parse based on file extension
  let config: unknown

  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
    config = yaml.load(content)
  } else if (filePath.endsWith('.json')) {
    config = JSON.parse(content)
  } else {
    throw new Error('Unsupported config format. Use .yaml, .yml, or .json')
  }

  // Validate configuration
  validateConfig(config)

  return config as ConfigFile
}

/**
 * Validate configuration structure
 */
function validateConfig(config: unknown): void {
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid configuration format')
  }

  const cfg = config as Record<string, unknown>

  // Validate transport
  if (!cfg['transport']) {
    throw new Error('Missing transport configuration')
  }

  if (typeof cfg['transport'] !== 'object' || cfg['transport'] === null) {
    throw new Error('Invalid transport configuration')
  }

  // Validate devices
  if (!cfg['devices']) {
    throw new Error('Missing devices configuration')
  }

  if (!Array.isArray(cfg['devices'])) {
    throw new Error('Devices must be an array')
  }

  if (cfg['devices'].length === 0) {
    throw new Error('At least one device must be configured')
  }
}

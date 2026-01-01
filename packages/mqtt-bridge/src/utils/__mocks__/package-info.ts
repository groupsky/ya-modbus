/**
 * Auto-mock for package info utilities
 * Used in tests via jest.mock('./utils/package-info.js')
 */

export function getPackageInfo(): { version: string; description: string } {
  return {
    version: '0.0.0',
    description:
      'MQTT bridge for ya-modbus - orchestrates device management, polling, and MQTT publishing',
  }
}

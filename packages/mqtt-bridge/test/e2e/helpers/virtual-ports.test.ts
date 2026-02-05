/**
 * Virtual Serial Port Manager Tests
 *
 * Tests for creating and managing virtual serial port pairs using socat
 */

import { existsSync, lstatSync } from 'node:fs'

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'

import { VirtualPortManager } from './virtual-ports.js'

describe('VirtualPortManager', () => {
  let manager: VirtualPortManager

  beforeEach(() => {
    manager = new VirtualPortManager()
  })

  afterEach(async () => {
    await manager.cleanup()
  })

  describe('createPortPair', () => {
    it('should create a pair of virtual serial ports', async () => {
      const pair = await manager.createPortPair('test1')

      expect(pair.masterPort).toMatch(/^\/tmp\/ttyVtest1-\d+-master$/)
      expect(pair.slavePort).toMatch(/^\/tmp\/ttyVtest1-\d+-slave$/)
      expect(pair.socatPid).toBeGreaterThan(0)

      // Verify ports exist as symbolic links
      expect(existsSync(pair.masterPort)).toBe(true)
      expect(existsSync(pair.slavePort)).toBe(true)
      expect(lstatSync(pair.masterPort).isSymbolicLink()).toBe(true)
      expect(lstatSync(pair.slavePort).isSymbolicLink()).toBe(true)
    })

    it('should create ports with unique names for different base names', async () => {
      const pair1 = await manager.createPortPair('test1')
      const pair2 = await manager.createPortPair('test2')

      expect(pair1.masterPort).not.toBe(pair2.masterPort)
      expect(pair1.slavePort).not.toBe(pair2.slavePort)
      expect(pair1.socatPid).not.toBe(pair2.socatPid)
    })

    it('should timeout if ports cannot be created', async () => {
      // Test with very short timeout to simulate failure
      await expect(manager.createPortPair('test-timeout', 100)).rejects.toThrow(/timeout/i)
    }, 5000)

    it('should handle special characters in base name', async () => {
      const pair = await manager.createPortPair('test-port_1')

      expect(pair.masterPort).toContain('test-port_1')
      expect(existsSync(pair.masterPort)).toBe(true)
    })

    it('should create multiple port pairs concurrently', async () => {
      const [pair1, pair2, pair3] = await Promise.all([
        manager.createPortPair('concurrent1'),
        manager.createPortPair('concurrent2'),
        manager.createPortPair('concurrent3'),
      ])

      // All ports should exist
      expect(existsSync(pair1.masterPort)).toBe(true)
      expect(existsSync(pair2.masterPort)).toBe(true)
      expect(existsSync(pair3.masterPort)).toBe(true)

      // All PIDs should be unique
      const pids = [pair1.socatPid, pair2.socatPid, pair3.socatPid]
      expect(new Set(pids).size).toBe(3)
    })
  })

  describe('isPortReady', () => {
    it('should return true for existing ports', async () => {
      const pair = await manager.createPortPair('test')

      const ready = await manager.isPortReady(pair.masterPort)

      expect(ready).toBe(true)
    })

    it('should return false for non-existent ports', async () => {
      const ready = await manager.isPortReady('/tmp/ttyV-nonexistent', 500)

      expect(ready).toBe(false)
    })

    it('should timeout if port is never created', async () => {
      const ready = await manager.isPortReady('/tmp/ttyV-nonexistent', 500)

      expect(ready).toBe(false)
    })
  })

  describe('cleanup', () => {
    it('should remove all created ports', async () => {
      const pair1 = await manager.createPortPair('test1')
      const pair2 = await manager.createPortPair('test2')

      await manager.cleanup()

      expect(existsSync(pair1.masterPort)).toBe(false)
      expect(existsSync(pair1.slavePort)).toBe(false)
      expect(existsSync(pair2.masterPort)).toBe(false)
      expect(existsSync(pair2.slavePort)).toBe(false)
    })

    it('should kill all socat processes', async () => {
      const pair = await manager.createPortPair('test')

      await manager.cleanup()

      // Verify process no longer exists
      expect(() => {
        process.kill(pair.socatPid, 0) // Signal 0 checks if process exists
      }).toThrow() // Should throw ESRCH error
    })

    it('should handle cleanup when no ports were created', async () => {
      await expect(manager.cleanup()).resolves.not.toThrow()
    })

    it('should handle cleanup when ports already removed', async () => {
      const pair = await manager.createPortPair('test')

      // Manually remove one port
      const fs = await import('node:fs/promises')
      await fs.unlink(pair.masterPort)

      await expect(manager.cleanup()).resolves.not.toThrow()
    })

    it('should not throw on multiple cleanup calls', async () => {
      await manager.createPortPair('test')

      await manager.cleanup()
      await expect(manager.cleanup()).resolves.not.toThrow()
    })
  })

  describe('getActivePorts', () => {
    it('should return empty array when no ports created', () => {
      const ports = manager.getActivePorts()

      expect(ports).toEqual([])
    })

    it('should return all created port pairs', async () => {
      await manager.createPortPair('test1')
      await manager.createPortPair('test2')

      const ports = manager.getActivePorts()

      expect(ports).toHaveLength(2)
      expect(ports[0]).toHaveProperty('masterPort')
      expect(ports[0]).toHaveProperty('slavePort')
      expect(ports[0]).toHaveProperty('socatPid')
    })
  })

  describe('error handling', () => {
    it('should cleanup on error during port creation', async () => {
      // This test verifies that partial cleanup happens on error
      // Implementation will ensure no orphaned processes or files

      const initialPorts = manager.getActivePorts().length

      try {
        // Force an error by using invalid socat options
        // Implementation should catch and cleanup
        await manager.createPortPair('')
      } catch {
        // Expected to fail
      }

      const finalPorts = manager.getActivePorts().length
      expect(finalPorts).toBe(initialPorts)
    })

    it('should provide diagnostic information on timeout', async () => {
      await expect(manager.createPortPair('test', 100)).rejects.toThrow(/socat/i)
    }, 5000)
  })
})

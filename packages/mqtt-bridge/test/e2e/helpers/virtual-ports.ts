/**
 * Virtual Serial Port Manager
 *
 * Manages virtual serial port pairs using socat for E2E integration testing.
 * Each port pair consists of a master port (for emulator) and slave port (for bridge).
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { unlink } from 'node:fs/promises'

/**
 * Virtual port pair information
 */
export interface VirtualPortPair {
  /** Port for emulator to connect to */
  masterPort: string
  /** Port for mqtt-bridge to connect to */
  slavePort: string
  /** socat process ID for cleanup */
  socatPid: number
}

/**
 * Manages virtual serial port pairs for testing
 */
export class VirtualPortManager {
  private portPairs: Map<string, VirtualPortPair> = new Map()
  private socatProcesses: Map<number, ChildProcess> = new Map()

  /**
   * Create a virtual serial port pair
   *
   * @param baseName - Base name for the port pair (used in port paths)
   * @param timeoutMs - Timeout for port creation in milliseconds (default: 10000)
   * @returns Promise resolving to port pair information
   */
  async createPortPair(baseName: string, timeoutMs = 10000): Promise<VirtualPortPair> {
    if (!baseName || baseName.trim().length === 0) {
      throw new Error('Base name cannot be empty')
    }

    // Generate unique port names
    const timestamp = Date.now()
    const masterPort = `/tmp/ttyV${baseName}-${timestamp}-master`
    const slavePort = `/tmp/ttyV${baseName}-${timestamp}-slave`

    // Start socat process
    const socatArgs = [
      '-d',
      '-d', // Debug level 2 for logging
      `pty,rawer,echo=0,link=${masterPort},perm=0666`,
      `pty,rawer,echo=0,link=${slavePort},perm=0666`,
    ]

    const socatProcess = spawn('socat', socatArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    })

    const pid = socatProcess.pid
    if (!pid) {
      throw new Error('Failed to start socat process')
    }

    // Store process for cleanup
    this.socatProcesses.set(pid, socatProcess)

    // Handle process errors
    socatProcess.on('error', (error) => {
      console.error(`socat process ${pid} error:`, error)
    })

    socatProcess.on('exit', (code, _signal) => {
      if (code !== null && code !== 0) {
        console.error(`socat process ${pid} exited with code ${code}`)
      }
      this.socatProcesses.delete(pid)
    })

    // Capture stderr for diagnostic information
    let stderrData = ''
    socatProcess.stderr?.on('data', (data: Buffer) => {
      stderrData += data.toString()
    })

    try {
      // Wait for ports to be created
      await this.waitForPorts([masterPort, slavePort], timeoutMs)

      const pair: VirtualPortPair = {
        masterPort,
        slavePort,
        socatPid: pid,
      }

      this.portPairs.set(baseName, pair)

      return pair
    } catch (error) {
      // Cleanup on failure
      socatProcess.kill('SIGTERM')
      this.socatProcesses.delete(pid)

      // Try to remove ports if they were partially created
      await this.removePort(masterPort).catch(() => {})
      await this.removePort(slavePort).catch(() => {})

      const errorMessage = `Failed to create virtual ports: ${error instanceof Error ? error.message : String(error)}`
      const diagnostics = stderrData ? `\nsocat output: ${stderrData}` : ''
      throw new Error(errorMessage + diagnostics)
    }
  }

  /**
   * Check if a port is ready
   *
   * @param port - Port path to check
   * @param timeoutMs - Timeout in milliseconds (default: 5000)
   * @returns Promise resolving to true if port is ready, false otherwise
   */
  async isPortReady(port: string, timeoutMs = 5000): Promise<boolean> {
    try {
      await this.waitForPorts([port], timeoutMs)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get all active port pairs
   *
   * @returns Array of active port pairs
   */
  getActivePorts(): VirtualPortPair[] {
    return Array.from(this.portPairs.values())
  }

  /**
   * Cleanup all created ports and processes
   */
  async cleanup(): Promise<void> {
    // Kill all socat processes
    for (const [_pid, process] of this.socatProcesses.entries()) {
      try {
        // Check if process still exists
        process.kill(0)
        // If no error, process exists, kill it
        process.kill('SIGTERM')
      } catch (error) {
        // Process doesn't exist or already terminated
        if (error instanceof Error && 'code' in error && error.code !== 'ESRCH') {
          console.error(`Error checking/killing process:`, error)
        }
      }
    }

    // Wait a bit for processes to terminate
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Force kill any remaining processes
    for (const process of this.socatProcesses.values()) {
      try {
        process.kill('SIGKILL')
      } catch {
        // Ignore errors
      }
    }

    this.socatProcesses.clear()

    // Remove all port symlinks
    const removePromises = []
    for (const pair of this.portPairs.values()) {
      removePromises.push(this.removePort(pair.masterPort))
      removePromises.push(this.removePort(pair.slavePort))
    }

    await Promise.allSettled(removePromises)

    this.portPairs.clear()
  }

  /**
   * Wait for ports to be created
   *
   * @param ports - Array of port paths to wait for
   * @param timeoutMs - Timeout in milliseconds
   */
  private async waitForPorts(ports: string[], timeoutMs: number): Promise<void> {
    const startTime = Date.now()
    const checkInterval = 100 // Check every 100ms

    while (Date.now() - startTime < timeoutMs) {
      const allExist = ports.every((port) => {
        try {
          return existsSync(port)
        } catch {
          return false
        }
      })

      if (allExist) {
        return
      }

      await new Promise((resolve) => setTimeout(resolve, checkInterval))
    }

    throw new Error(`Timeout waiting for ports to be created: ${ports.join(', ')}`)
  }

  /**
   * Remove a port symlink
   *
   * @param port - Port path to remove
   */
  private async removePort(port: string): Promise<void> {
    try {
      if (existsSync(port)) {
        await unlink(port)
      }
    } catch (error) {
      // Ignore errors during cleanup
      console.debug(`Failed to remove port ${port}:`, error)
    }
  }
}

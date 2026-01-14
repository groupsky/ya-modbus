/**
 * Virtual serial port pair using socat
 *
 * Creates a pair of linked pseudo-terminals for testing RTU communication
 * without physical hardware. One end connects to the emulator (server),
 * the other to the client transport.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface PtyPair {
  /** PTY path for the server (emulator) side */
  serverPath: string
  /** PTY path for the client (transport) side */
  clientPath: string
  /** Stop the socat process and clean up */
  stop(): Promise<void>
}

/**
 * Create a virtual serial port pair using socat
 *
 * @param prefix - Prefix for PTY symlinks (default: 'ya-modbus')
 * @returns Promise resolving to PTY pair paths and cleanup function
 *
 * @example
 * ```typescript
 * const pty = await createPtyPair()
 * // pty.serverPath -> /tmp/ya-modbus-server-12345
 * // pty.clientPath -> /tmp/ya-modbus-client-12345
 * await pty.stop()
 * ```
 */
export async function createPtyPair(prefix = 'ya-modbus'): Promise<PtyPair> {
  const id = `${process.pid}-${Date.now()}`
  const tempDir = tmpdir()

  // Ensure temp directory exists
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true })
  }

  const serverPath = join(tempDir, `${prefix}-server-${id}`)
  const clientPath = join(tempDir, `${prefix}-client-${id}`)

  // Create socat process
  // PTY,link=<path> creates a pseudo-terminal with a symlink at the specified path
  // raw,echo=0 ensures binary data passes through unchanged
  const socatProc: ChildProcess = spawn(
    'socat',
    ['-d', '-d', `PTY,link=${serverPath},raw,echo=0`, `PTY,link=${clientPath},raw,echo=0`],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )

  // Wait for PTY links to be created
  await waitForPtyLinks(serverPath, clientPath, socatProc)

  return {
    serverPath,
    clientPath,
    async stop(): Promise<void> {
      // Kill socat process
      socatProc.kill('SIGTERM')

      // Wait for process to exit
      await new Promise<void>((resolve) => {
        socatProc.on('exit', () => resolve())
        // Timeout after 1 second
        setTimeout(() => {
          socatProc.kill('SIGKILL')
          resolve()
        }, 1000)
      })

      // Clean up symlinks
      try {
        if (existsSync(serverPath)) unlinkSync(serverPath)
      } catch {
        // Ignore cleanup errors
      }
      try {
        if (existsSync(clientPath)) unlinkSync(clientPath)
      } catch {
        // Ignore cleanup errors
      }
    },
  }
}

/**
 * Wait for PTY symlinks to be created by socat
 */
async function waitForPtyLinks(
  serverPath: string,
  clientPath: string,
  proc: ChildProcess
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      proc.kill('SIGKILL')
      reject(new Error('Timeout waiting for PTY links to be created'))
    }, 5000)

    let stderr = ''

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
      // socat outputs "N PTY is /dev/pts/X" when PTYs are ready
      // But we're using symlinks, so check if both links exist
      if (existsSync(serverPath) && existsSync(clientPath)) {
        clearTimeout(timeout)
        resolve()
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`Failed to start socat: ${err.message}`))
    })

    proc.on('exit', (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timeout)
        reject(new Error(`socat exited with code ${code}: ${stderr}`))
      }
    })

    // Also poll for files in case events are missed
    const pollInterval = setInterval(() => {
      if (existsSync(serverPath) && existsSync(clientPath)) {
        clearTimeout(timeout)
        clearInterval(pollInterval)
        resolve()
      }
    }, 50)

    // Clean up poll interval on timeout/reject
    const originalReject = reject
    reject = (err) => {
      clearInterval(pollInterval)
      originalReject(err)
    }
  })
}

/**
 * Check if socat is available on the system
 */
export async function isSocatAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('which', ['socat'], {
      stdio: ['ignore', 'ignore', 'ignore'],
    })

    proc.on('exit', (code) => {
      resolve(code === 0)
    })

    proc.on('error', () => {
      resolve(false)
    })
  })
}

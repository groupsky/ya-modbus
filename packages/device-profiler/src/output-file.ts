/**
 * Checks for the file the result is written to
 */

import { constants, type Stats } from 'node:fs'
import { access, open, readlink, realpath, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

/**
 * Check that the output file can be written
 *
 * A scan can take minutes. Checking before the scan means a mistyped path
 * does not cost the result. The check never creates or changes a file: an
 * existing file is opened for writing without truncating it, and for a new
 * file the check is that its directory can be written to. A FIFO is not
 * opened: that waits for a reader, and opening it and closing it again ends
 * the input of a reader that is already there.
 *
 * @param file - Path of the output file
 * @throws Error naming the file and the reason if it cannot be written
 */
export async function assertOutputWritable(file: string): Promise<void> {
  try {
    await checkWritable(file)
  } catch (error) {
    // The checks fail only with a system error, which always has a message
    throw new Error(`Cannot write to ${file}: ${(error as Error).message}`)
  }
}

async function checkWritable(file: string): Promise<void> {
  assertNamesFile(file)

  const existing = await statIfExists(file)

  if (existing === undefined) {
    // The file does not exist yet. It can be created if its directory allows it.
    await access(dirname(await resolveSymlinks(file)), constants.W_OK | constants.X_OK)
  } else if (existing.isFIFO()) {
    await access(file, constants.W_OK)
  } else {
    await (await open(file, constants.O_WRONLY)).close()
  }
}

function assertNamesFile(path: string): void {
  if (path === '' || /[\\/]$/.test(path)) {
    throw new Error('the path does not name a file')
  }
}

async function statIfExists(file: string): Promise<Stats | undefined> {
  try {
    return await stat(file)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

/**
 * Follow a path that does not exist to the path that a write would create
 *
 * A dangling symlink is created at its target, so the directory of the target
 * matters, not the directory of the symlink. The loop ends because the path
 * is known not to exist: a symlink cycle fails with ELOOP before this runs.
 */
async function resolveSymlinks(path: string): Promise<string> {
  let current = path
  for (;;) {
    let target: string
    try {
      target = await readlink(current)
    } catch {
      // Not a symlink: this is the path that a write creates
      return current
    }
    // The write would fail on a target such as "results/", which only a directory can have
    assertNamesFile(target)
    // A relative target starts at the real directory of the symlink
    current = resolve(await realpath(dirname(current)), target)
  }
}

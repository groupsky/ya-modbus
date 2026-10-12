/**
 * Checks for the file the result is written to
 */

import { constants } from 'node:fs'
import { access, open } from 'node:fs/promises'
import { dirname } from 'node:path'

/**
 * Check that the output file can be written
 *
 * A scan can take minutes. Checking before the scan means a mistyped path
 * does not cost the result. The check never creates or changes a file: an
 * existing file is opened for writing without truncating it, and for a new
 * file the check is that its directory can be written to.
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
  if (file === '' || /[\\/]$/.test(file)) {
    throw new Error('the path does not name a file')
  }

  try {
    await (await open(file, constants.O_WRONLY)).close()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
    // The file does not exist yet. It can be created if its directory allows it.
    await access(dirname(file), constants.W_OK | constants.X_OK)
  }
}

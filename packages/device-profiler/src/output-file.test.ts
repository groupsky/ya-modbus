import { execFileSync, spawn } from 'node:child_process'
import { constants } from 'node:fs'
import {
  type FileHandle,
  chmod,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { assertOutputWritable } from './output-file.js'

const isWindows = process.platform === 'win32'
// File permissions, symbolic links and FIFOs behave differently on Windows
const describeOnPosix = isWindows ? describe.skip : describe
// The root user can write to files and directories whatever their permissions are
const describeAsOrdinaryUser = isWindows || process.getuid?.() === 0 ? describe.skip : describe

describe('assertOutputWritable', () => {
  let directory: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'profiler-output-'))
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  function createFifo(): string {
    const fifo = join(directory, 'scan.fifo')
    execFileSync('mkfifo', [fifo])
    return fifo
  }

  // Opening a FIFO without waiting fails with ENXIO until a reader has opened it
  async function openWhenReaderIsReady(fifo: string): Promise<FileHandle> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await open(fifo, constants.O_WRONLY | constants.O_NONBLOCK)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENXIO' || attempt >= 100) {
          throw error
        }
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
    }
  }

  it('should accept a new file in an existing directory and leave nothing behind', async () => {
    await expect(assertOutputWritable(join(directory, 'scan.json'))).resolves.toBeUndefined()

    await expect(readdir(directory)).resolves.toEqual([])
  })

  it('should accept an existing file and keep its content', async () => {
    const file = join(directory, 'scan.json')
    await writeFile(file, 'existing content')

    await expect(assertOutputWritable(file)).resolves.toBeUndefined()

    await expect(readFile(file, 'utf8')).resolves.toBe('existing content')
  })

  it('should reject a file in a missing directory and name the file', async () => {
    const file = join(directory, 'missing', 'scan.json')

    await expect(assertOutputWritable(file)).rejects.toThrow(`Cannot write to ${file}: ENOENT`)
  })

  it('should reject a path that is a directory', async () => {
    const path = join(directory, 'results')
    await mkdir(path)

    await expect(assertOutputWritable(path)).rejects.toThrow(`Cannot write to ${path}: EISDIR`)
  })

  it('should reject a file below a path that is a file', async () => {
    const notADirectory = join(directory, 'file.txt')
    await writeFile(notADirectory, 'x')
    const file = join(notADirectory, 'scan.json')

    await expect(assertOutputWritable(file)).rejects.toThrow(`Cannot write to ${file}: ENOTDIR`)
  })

  it('should reject an empty path', async () => {
    await expect(assertOutputWritable('')).rejects.toThrow(
      'Cannot write to : the path does not name a file'
    )
  })

  it('should reject a path that ends with a separator, even when nothing exists there', async () => {
    const path = join(directory, 'results') + '/'

    await expect(assertOutputWritable(path)).rejects.toThrow(
      `Cannot write to ${path}: the path does not name a file`
    )
  })

  describeAsOrdinaryUser('permissions', () => {
    it('should reject an existing file that is read-only and keep its content', async () => {
      const file = join(directory, 'scan.json')
      await writeFile(file, 'existing content')
      await chmod(file, 0o444)

      await expect(assertOutputWritable(file)).rejects.toThrow(`Cannot write to ${file}: EACCES`)

      await expect(readFile(file, 'utf8')).resolves.toBe('existing content')
    })

    it('should reject a new file in a read-only directory', async () => {
      const readOnly = join(directory, 'read-only')
      await mkdir(readOnly)
      await chmod(readOnly, 0o555)
      const file = join(readOnly, 'scan.json')

      await expect(assertOutputWritable(file)).rejects.toThrow(`Cannot write to ${file}: EACCES`)
    })

    it('should reject a FIFO that cannot be written', async () => {
      const fifo = createFifo()
      await chmod(fifo, 0o444)

      await expect(assertOutputWritable(fifo)).rejects.toThrow(`Cannot write to ${fifo}: EACCES`)
    })
  })

  describeOnPosix('symbolic links', () => {
    it('should accept a symlink to a file and keep the content', async () => {
      const target = join(directory, 'target.json')
      await writeFile(target, 'existing content')
      const link = join(directory, 'scan.json')
      await symlink(target, link)

      await expect(assertOutputWritable(link)).resolves.toBeUndefined()

      await expect(readFile(target, 'utf8')).resolves.toBe('existing content')
    })

    it('should reject a symlink to a directory', async () => {
      const target = join(directory, 'results')
      await mkdir(target)
      const link = join(directory, 'scan.json')
      await symlink(target, link)

      await expect(assertOutputWritable(link)).rejects.toThrow(`Cannot write to ${link}: EISDIR`)
    })

    // The write creates the target of a symlink, so the directory of the target
    // has to exist, not the directory of the symlink
    it('should accept a dangling symlink whose target can be created', async () => {
      const link = join(directory, 'scan.json')
      await symlink('target.json', link)

      await expect(assertOutputWritable(link)).resolves.toBeUndefined()

      await expect(readdir(directory)).resolves.toEqual(['scan.json'])
    })

    it.each([
      { kind: 'relative', target: () => join('missing-dir', 'x.json') },
      { kind: 'absolute', target: (dir: string) => join(dir, 'missing-dir', 'x.json') },
    ])(
      'should reject a dangling $kind symlink into a directory that does not exist',
      async ({ target }) => {
        const link = join(directory, 'scan.json')
        await symlink(target(directory), link)

        await expect(assertOutputWritable(link)).rejects.toThrow(`Cannot write to ${link}: ENOENT`)
      }
    )

    it('should follow a chain of dangling symlinks to the last target', async () => {
      await symlink(join('missing-dir', 'x.json'), join(directory, 'second.json'))
      const first = join(directory, 'first.json')
      await symlink('second.json', first)

      await expect(assertOutputWritable(first)).rejects.toThrow(`Cannot write to ${first}: ENOENT`)
    })

    // The kernel resolves .. in a target after following the symlinked directory
    it('should resolve a relative target from the real directory of the symlink', async () => {
      await mkdir(join(directory, 'a', 'b'), { recursive: true })
      await mkdir(join(directory, 'a', 'x'))
      await symlink(join('a', 'b'), join(directory, 'linked-directory'))
      await symlink(join('..', 'x', 'out.json'), join(directory, 'a', 'b', 'scan.json'))

      await expect(
        assertOutputWritable(join(directory, 'linked-directory', 'scan.json'))
      ).resolves.toBeUndefined()
    })

    it('should reject a dangling symlink to a path that ends with a separator', async () => {
      const link = join(directory, 'scan.json')
      await symlink('results/', link)

      await expect(assertOutputWritable(link)).rejects.toThrow(
        `Cannot write to ${link}: the path does not name a file`
      )
    })

    it('should resolve a relative target from the directory of the symlink', async () => {
      await mkdir(join(directory, 'links'))
      const link = join(directory, 'links', 'scan.json')
      await symlink(join('..', 'results', 'x.json'), link)

      await expect(assertOutputWritable(link)).rejects.toThrow(`Cannot write to ${link}: ENOENT`)

      await mkdir(join(directory, 'results'))

      await expect(assertOutputWritable(link)).resolves.toBeUndefined()
    })
  })

  describeOnPosix('FIFOs', () => {
    // Opening a FIFO for writing blocks until something reads it
    it('should accept a FIFO that has no reader without waiting for one', async () => {
      await expect(assertOutputWritable(createFifo())).resolves.toBeUndefined()
    })

    // Opening a FIFO and closing it again ends the input of a reader that is already there.
    // The scan would then end with nobody to read the result.
    it('should leave a reader of the FIFO waiting for the data', async () => {
      const fifo = createFifo()
      const reader = spawn('cat', [fifo])
      let received = ''
      reader.stdout.on('data', (chunk: Buffer) => {
        received += chunk.toString()
      })
      const readerEnded = new Promise((resolve) => reader.once('close', resolve))

      try {
        await expect(assertOutputWritable(fifo)).resolves.toBeUndefined()

        const writer = await openWhenReaderIsReady(fifo)
        await writer.writeFile('scan result')
        await writer.close()
        await readerEnded

        expect(received).toBe('scan result')
      } finally {
        reader.kill()
      }
    })
  })
})

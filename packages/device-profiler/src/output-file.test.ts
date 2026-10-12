import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { assertOutputWritable } from './output-file.js'

describe('assertOutputWritable', () => {
  let directory: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'profiler-output-'))
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

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
})

import { describe, expect, it } from 'vitest'
import {
  createMemorySiteDirectory,
  snapshotSiteDirectory,
} from '../../site/export/memorySiteDirectory.test-helpers'
import { exportErrorCode, openExport } from './writeExport'

const bytes = (text: string) => new TextEncoder().encode(text)
const PDF = bytes('%PDF-1.7 first')
const PDF_2 = bytes('%PDF-1.7 second, longer')

/** Streams `chunks` to `exports/<name>` and closes. */
async function write(
  root: Parameters<typeof openExport>[0],
  name: string,
  chunks: Uint8Array[],
) {
  const stream = openExport(root, name)
  for (const chunk of chunks) stream.write(chunk)
  return stream.close()
}

describe('openExport', () => {
  it('creates exports/ and writes the chunks there, in order', async () => {
    const library = createMemorySiteDirectory({ 'library.json': '{}' })

    const result = await write(library.root, 'lake-trip-A5.pdf', [
      bytes('%PDF-1.7 '),
      bytes('first'),
    ])

    expect(await snapshotSiteDirectory(library.root)).toEqual([
      ['exports', 'dir'],
      ['exports/lake-trip-A5.pdf', PDF],
      ['library.json', bytes('{}')],
    ])
    expect(result.ok && result.file.name).toBe('lake-trip-A5.pdf')
    const written = result.ok ? await result.file.getFile() : undefined
    expect(await written?.text()).toBe('%PDF-1.7 first')
  })

  it('replaces a same-name file and keeps the others', async () => {
    const library = createMemorySiteDirectory({
      'exports/lake-trip-A5.pdf': PDF_2,
      'exports/other.pdf': 'x',
    })

    await write(library.root, 'lake-trip-A5.pdf', [PDF])

    expect(await snapshotSiteDirectory(library.root)).toEqual([
      ['exports', 'dir'],
      ['exports/lake-trip-A5.pdf', PDF],
      ['exports/other.pdf', bytes('x')],
    ])
  })

  it('aborts: the same-name file stays as it was', async () => {
    const library = createMemorySiteDirectory({
      'exports/lake-trip-A5.pdf': PDF_2,
    })

    const stream = openExport(library.root, 'lake-trip-A5.pdf')
    stream.write(PDF)
    await stream.abort()

    expect(await snapshotSiteDirectory(library.root)).toEqual([
      ['exports', 'dir'],
      ['exports/lake-trip-A5.pdf', PDF_2],
    ])
    expect(library.ops).toEqual(['abort exports/lake-trip-A5.pdf'])
  })

  it.each([
    ['NotAllowedError', 'access'],
    ['SecurityError', 'access'],
    ['QuotaExceededError', 'full'],
    ['InvalidStateError', 'other'],
  ] as const)('maps a refused %s open to %s on close', async (name, code) => {
    const library = createMemorySiteDirectory()
    library.failNextWrite(new DOMException(name, name))

    expect(await write(library.root, 'a.pdf', [PDF])).toEqual({
      ok: false,
      code,
    })
  })

  it('stops at the first failed write, drops the file and gives its code', async () => {
    const written: string[] = []
    let aborted = 0
    const file = {
      kind: 'file' as const,
      name: 'a.pdf',
      getFile: () => Promise.resolve(new Blob()),
      createWritable: () =>
        Promise.resolve({
          write: (data: Uint8Array) => {
            const text = new TextDecoder().decode(data)
            if (text === 'full') {
              return Promise.reject(new DOMException('', 'QuotaExceededError'))
            }
            written.push(text)
            return Promise.resolve()
          },
          close: () => Promise.reject(new Error('closed after a failure')),
          abort: () => {
            aborted += 1
            return Promise.resolve()
          },
        }),
    }
    const library = {
      getDirectoryHandle: () => Promise.resolve(library),
      getFileHandle: () => Promise.resolve(file),
    }

    const result = await write(library, 'a.pdf', [
      bytes('one'),
      bytes('full'),
      bytes('two'),
    ])

    expect(result).toEqual({ ok: false, code: 'full' })
    expect(written).toEqual(['one'])
    expect(aborted).toBe(1)
  })

  it('gives the code of a refused close and drops the file', async () => {
    const ops: string[] = []
    const file = {
      kind: 'file' as const,
      name: 'a.pdf',
      getFile: () => Promise.resolve(new Blob()),
      createWritable: () =>
        Promise.resolve({
          write: () => Promise.resolve(),
          close: () => {
            ops.push('close')
            return Promise.reject(new DOMException('', 'QuotaExceededError'))
          },
          abort: () => {
            ops.push('abort')
            return Promise.resolve()
          },
        }),
    }
    const library = {
      getDirectoryHandle: () => Promise.resolve(library),
      getFileHandle: () => Promise.resolve(file),
    }

    const result = await write(library, 'a.pdf', [PDF])

    expect(result).toEqual({ ok: false, code: 'full' })
    expect(ops).toEqual(['close', 'abort'])
  })

  it('fails with other when exports is a file', async () => {
    const library = createMemorySiteDirectory({ exports: 'not a folder' })

    expect(await write(library.root, 'a.pdf', [PDF])).toEqual({
      ok: false,
      code: 'other',
    })
  })
})

describe('exportErrorCode', () => {
  it('maps a thrown non-error to other', () => {
    expect(exportErrorCode('NotAllowedError')).toBe('other')
  })
})

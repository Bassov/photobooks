import { describe, expect, it } from 'vitest'
import {
  createMemorySiteDirectory,
  snapshotSiteDirectory,
} from '../../site/export/memorySiteDirectory.test-helpers'
import { exportErrorCode, writeExport } from './writeExport'

const PDF = new TextEncoder().encode('%PDF-1.7 first')
const PDF_2 = new TextEncoder().encode('%PDF-1.7 second, longer')

describe('writeExport', () => {
  it('creates exports/ and writes the file there', async () => {
    const library = createMemorySiteDirectory({ 'library.json': '{}' })

    const result = await writeExport(library.root, 'lake-trip-A5.pdf', PDF)

    expect(await snapshotSiteDirectory(library.root)).toEqual([
      ['exports', 'dir'],
      ['exports/lake-trip-A5.pdf', PDF],
      ['library.json', new TextEncoder().encode('{}')],
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

    await writeExport(library.root, 'lake-trip-A5.pdf', PDF)

    expect(await snapshotSiteDirectory(library.root)).toEqual([
      ['exports', 'dir'],
      ['exports/lake-trip-A5.pdf', PDF],
      ['exports/other.pdf', new TextEncoder().encode('x')],
    ])
  })

  it.each([
    ['NotAllowedError', 'access'],
    ['SecurityError', 'access'],
    ['QuotaExceededError', 'full'],
    ['InvalidStateError', 'other'],
  ] as const)('maps a %s write to %s', async (name, code) => {
    const library = createMemorySiteDirectory()
    library.failNextWrite(new DOMException(name, name))

    expect(await writeExport(library.root, 'a.pdf', PDF)).toEqual({
      ok: false,
      code,
    })
  })

  it('fails with other when exports is a file', async () => {
    const library = createMemorySiteDirectory({ exports: 'not a folder' })

    expect(await writeExport(library.root, 'a.pdf', PDF)).toEqual({
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

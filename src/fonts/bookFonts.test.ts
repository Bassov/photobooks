import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fc, test } from '@fast-check/vitest'
import { describe, expect, it, vi } from 'vitest'
import {
  BOOK_FONT_FACES,
  bookFontFamilies,
  bookFontFiles,
  clampWeight,
  faceCovers,
  facesForCodePoint,
  unicodeRangeCss,
} from './bookFonts'
import { faceDescriptors, loadBookFonts } from './loadBookFonts'

const FONTS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../public/fonts',
)
const css = fs.readFileSync(path.join(FONTS_DIR, 'fonts.css'), 'utf8')

function cssBlocks(): {
  family: string
  style: string
  file: string
  range: string
  weight: string
}[] {
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => {
    const body = m[1] ?? ''
    const pick = (re: RegExp) =>
      (re.exec(body)?.[1] ?? '').replace(/\s+/g, ' ').trim()
    return {
      family: pick(/font-family:\s*'([^']+)'/),
      style: pick(/font-style:\s*(\w+)/),
      file: pick(/url\('\.\/([^']+)'\)/),
      range: pick(/unicode-range:\s*([^;]+);/),
      weight: pick(/font-weight:\s*([^;]+);/),
    }
  })
}

describe('book font registry', () => {
  it('lists unique files that all exist as valid woff2 of the declared size', () => {
    const files = bookFontFiles()
    expect(new Set(files).size).toBe(files.length)
    for (const file of files) {
      const buf = fs.readFileSync(path.join(FONTS_DIR, file))
      expect(buf.subarray(0, 4).toString('latin1')).toBe('wOF2')
      expect(buf.readUInt32BE(8)).toBe(buf.length)
      expect(buf.readUInt16BE(12)).toBeGreaterThan(0)
    }
  })

  it('matches fonts.css face for face (same files for DOM and PDF)', () => {
    const blocks = cssBlocks()
    expect(blocks).toHaveLength(BOOK_FONT_FACES.length)
    for (const face of BOOK_FONT_FACES) {
      const block = blocks.find((b) => b.file === face.file)
      expect(block).toBeDefined()
      expect(block?.family).toBe(face.family)
      expect(block?.style).toBe(face.style)
      expect(block?.weight).toBe(
        `${face.weightMin.toString()} ${face.weightMax.toString()}`,
      )
      expect(block?.range.replace(/,\s*/g, ', ')).toBe(unicodeRangeCss(face))
    }
  })

  it('has an upright face for each family and Lora italic', () => {
    expect(bookFontFamilies()).toEqual(['Inter Variable', 'Lora Variable'])
    for (const family of bookFontFamilies()) {
      expect(facesForCodePoint(family, 'normal', 0x41)).toHaveLength(1)
    }
    expect(facesForCodePoint('Lora Variable', 'italic', 0x41)).toHaveLength(1)
    expect(facesForCodePoint('Inter Variable', 'italic', 0x41)).toHaveLength(0)
  })

  it.each([
    ['Latin', 'AZaz09 .,'],
    ['Cyrillic', 'АЯаяЁё'],
  ])('covers %s text in every upright and Lora italic face set', (_n, text) => {
    for (const [family, style] of [
      ['Inter Variable', 'normal'],
      ['Lora Variable', 'normal'],
      ['Lora Variable', 'italic'],
    ] as const) {
      for (const ch of text) {
        expect(
          facesForCodePoint(family, style, ch.codePointAt(0) ?? 0).length,
        ).toBeGreaterThan(0)
      }
    }
  })

  it('covers Latin Extended-A letters (Ł, é) and the № sign', () => {
    expect(facesForCodePoint('Lora Variable', 'normal', 0x141)[0]?.script).toBe(
      'latin-ext',
    )
    expect(facesForCodePoint('Inter Variable', 'normal', 0xe9)[0]?.script).toBe(
      'latin',
    )
    expect(
      facesForCodePoint('Inter Variable', 'normal', 0x2116)[0]?.script,
    ).toBe('cyrillic')
  })

  test.prop([fc.integer({ min: 0, max: 0x10ffff })])(
    'no codepoint is claimed by two faces of one family/style, except combining marks',
    (cp) => {
      const hits = facesForCodePoint('Lora Variable', 'normal', cp)
      const shared = [0x304, 0x308, 0x329].includes(cp)
      expect(hits.length).toBeLessThanOrEqual(shared ? 2 : 1)
    },
  )

  test.prop([
    fc.integer({ min: -1000, max: 2000 }),
    fc.constantFrom(...BOOK_FONT_FACES),
  ])('clampWeight stays inside the face range and is idempotent', (w, face) => {
    const c = clampWeight(face, w)
    expect(c).toBeGreaterThanOrEqual(face.weightMin)
    expect(c).toBeLessThanOrEqual(face.weightMax)
    expect(clampWeight(face, c)).toBe(c)
    if (w >= face.weightMin && w <= face.weightMax) expect(c).toBe(w)
  })

  test.prop([
    fc.constantFrom(...BOOK_FONT_FACES),
    fc.integer({ min: 0, max: 0x10ffff }),
  ])('faceCovers agrees with the ranges', (face, cp) => {
    expect(faceCovers(face, cp)).toBe(
      face.ranges.some(([lo, hi]) => lo <= cp && cp <= hi),
    )
  })
})

describe('loadBookFonts', () => {
  function fakes() {
    const added: unknown[] = []
    const fontSet = {
      add: (f: unknown) => added.push(f),
      ready: Promise.resolve(),
    }
    const created: {
      family: string
      bytes: ArrayBuffer
      d: FontFaceDescriptors
    }[] = []
    const createFace = vi.fn(
      (family: string, bytes: ArrayBuffer, d: FontFaceDescriptors) => {
        created.push({ family, bytes, d })
        const face = { load: () => Promise.resolve(face) }
        return face as unknown as FontFace
      },
    )
    return { added, fontSet, created, createFace }
  }

  it('reads each file, registers every face and exposes the bytes', async () => {
    const { added, fontSet, created, createFace } = fakes()
    const read = vi.fn((file: string) =>
      Promise.resolve(new TextEncoder().encode(file).buffer),
    )
    const result = await loadBookFonts({ read, fontSet, createFace })
    expect(read).toHaveBeenCalledTimes(BOOK_FONT_FACES.length)
    expect([...result.files.keys()].sort()).toEqual([...bookFontFiles()].sort())
    expect(added).toHaveLength(BOOK_FONT_FACES.length)
    expect(
      created.every(
        (c) =>
          result.files.get(bookFontFiles()[0] ?? '') !== undefined &&
          c.bytes.byteLength > 0,
      ),
    ).toBe(true)
    expect(created[0]?.d).toEqual(
      faceDescriptors(BOOK_FONT_FACES[0] ?? (undefined as never)),
    )
  })

  it('waits for fonts.ready before resolving', async () => {
    const { fontSet, createFace } = fakes()
    let release: () => void = () => undefined
    fontSet.ready = new Promise<void>((r) => (release = r))
    let done = false
    const p = loadBookFonts({
      read: () => Promise.resolve(new ArrayBuffer(1)),
      fontSet,
      createFace,
    }).then(() => (done = true))
    await new Promise((r) => setTimeout(r, 10))
    expect(done).toBe(false)
    release()
    await p
    expect(done).toBe(true)
  })

  it('rejects when a file cannot be read', async () => {
    const { fontSet, createFace } = fakes()
    await expect(
      loadBookFonts({
        read: () => Promise.reject(new Error('missing')),
        fontSet,
        createFace,
      }),
    ).rejects.toThrow('missing')
  })

  it('passes family, bytes and exact descriptors to the face factory', async () => {
    const { fontSet, created, createFace } = fakes()
    const face = BOOK_FONT_FACES.find((f) => f.style === 'italic')
    const bytes = new ArrayBuffer(3)
    await loadBookFonts({
      read: () => Promise.resolve(bytes),
      fontSet,
      createFace,
      faces: face ? [face] : [],
    })
    expect(created).toEqual([
      {
        family: 'Lora Variable',
        bytes,
        d: {
          style: 'italic',
          weight: '400 700',
          unicodeRange: expect.stringMatching(/^U\+/) as string,
          display: 'swap',
        },
      },
    ])
  })

  it('defaults to document.fonts and the FontFace constructor', async () => {
    const add = vi.fn()
    const ctor = vi.fn(function (this: { load: () => Promise<unknown> }) {
      this.load = () => Promise.resolve('loaded')
    })
    vi.stubGlobal('FontFace', ctor)
    vi.stubGlobal('document', { fonts: { add, ready: Promise.resolve() } })
    try {
      const face = BOOK_FONT_FACES.slice(0, 1)
      await loadBookFonts({
        read: () => Promise.resolve(new ArrayBuffer(1)),
        faces: face,
      })
    } finally {
      vi.unstubAllGlobals()
    }
    expect(ctor).toHaveBeenCalledTimes(1)
    expect(add).toHaveBeenCalledWith('loaded')
  })

  it('loads the full curated set when no faces are given', async () => {
    const { added, fontSet, createFace } = fakes()
    await loadBookFonts({
      read: () => Promise.resolve(new ArrayBuffer(1)),
      fontSet,
      createFace,
    })
    expect(added).toHaveLength(BOOK_FONT_FACES.length)
  })
})

function faceByFile(file: string): (typeof BOOK_FONT_FACES)[number] {
  const face = BOOK_FONT_FACES.find((f) => f.file === file)
  if (!face) throw new Error(`no face for ${file}`)
  return face
}

describe('registry lookups', () => {
  const lora = faceByFile('lora-cyrillic-wght-normal.woff2')

  it('treats range ends as inclusive', () => {
    expect(faceCovers(lora, 0x400)).toBe(true)
    expect(faceCovers(lora, 0x3ff)).toBe(false)
    expect(faceCovers(lora, 0x45f)).toBe(true)
    expect(faceCovers(lora, 0x460)).toBe(false)
    expect(faceCovers(lora, 0x301)).toBe(true)
  })

  it('filters by family and style', () => {
    const hits = facesForCodePoint('Lora Variable', 'italic', 0x430)
    expect(hits.map((f) => f.file)).toEqual(['lora-cyrillic-wght-italic.woff2'])
  })

  it('clamps weights to the exact bounds', () => {
    expect(clampWeight(lora, 100)).toBe(400)
    expect(clampWeight(lora, 900)).toBe(700)
    expect(clampWeight(lora, 500)).toBe(500)
  })

  it('formats unicode ranges like CSS', () => {
    expect(unicodeRangeCss(lora)).toBe(
      'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116',
    )
  })

  it('lists files in registry order', () => {
    expect(bookFontFiles()).toEqual(BOOK_FONT_FACES.map((f) => f.file))
  })
})

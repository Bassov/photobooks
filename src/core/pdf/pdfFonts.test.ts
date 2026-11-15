import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PDFDocument } from '@cantoo/pdf-lib'
import { fc } from '@fast-check/vitest'
import fontkit from '@pdf-lib/fontkit'
import { describe, expect, it } from 'vitest'
import { loadPdfFonts, type OutlineCommand, simpleGlyph } from './pdfFonts'
import { bookFontFiles } from './pdfText.test-helpers'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number; numRuns: number } }

const runs = {
  seed: gates.pbt.seed,
  numRuns: Number(process.env.FC_NUM_RUNS ?? gates.pbt.numRuns),
}

interface Point {
  x: number
  y: number
  on: boolean
}

/** Reads a `simpleGlyph` record back: contours of points. */
function readGlyph(bytes: Uint8Array): Point[][] {
  if (bytes.length === 0) return []
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const contours = view.getInt16(0)
  const ends = Array.from({ length: contours }, (_, i) =>
    view.getUint16(10 + 2 * i),
  )
  const count = (ends.at(-1) ?? -1) + 1
  let at = 10 + 2 * contours
  at += 2 + view.getUint16(at)
  const flags = Array.from(bytes.subarray(at, at + count))
  at += count
  const axis = () => {
    let value = 0
    return flags.map(() => {
      value += view.getInt16(at)
      at += 2
      return value
    })
  }
  const xs = axis()
  const ys = axis()
  const points = flags.map((flag, i) => ({
    x: xs[i] ?? 0,
    y: ys[i] ?? 0,
    on: (flag & 1) === 1,
  }))
  let start = 0
  return ends.map((end) => {
    const contour = points.slice(start, end + 1)
    start = end + 1
    return contour
  })
}

const coord = fc.double({ min: -3000, max: 3000, noNaN: true })
const segment = fc.oneof(
  fc.tuple(coord, coord).map(([x, y]) => ({ command: 'lineTo', args: [x, y] })),
  fc
    .tuple(coord, coord, coord, coord)
    .map((args) => ({ command: 'quadraticCurveTo', args })),
)
const contour = fc
  .tuple(coord, coord, fc.array(segment, { minLength: 1, maxLength: 8 }))
  .map(([x, y, rest]): OutlineCommand[] => [
    { command: 'moveTo', args: [x, y] },
    ...rest,
    { command: 'closePath', args: [] },
  ])

function expected(commands: OutlineCommand[]): Point[] {
  return commands.flatMap(({ command, args }) => {
    // `+ 0`: int16 has no -0.
    const point = (at: number, on: boolean) => ({
      x: Math.round(args[at] ?? 0) + 0,
      y: Math.round(args[at + 1] ?? 0) + 0,
      on,
    })
    if (command === 'quadraticCurveTo') return [point(0, false), point(2, true)]
    return command === 'closePath' ? [] : [point(0, true)]
  })
}

describe('simpleGlyph', () => {
  it('writes nothing for an empty outline', () => {
    expect(simpleGlyph([])).toEqual(new Uint8Array(0))
  })

  it('writes every rounded point back, contour by contour, 4-byte aligned (PBT)', () => {
    fc.assert(
      fc.property(fc.array(contour, { minLength: 1, maxLength: 4 }), (all) => {
        const bytes = simpleGlyph(all.flat())

        const raw = 12 + 2 * all.length + 5 * all.flatMap(expected).length
        expect(bytes.length).toBe(Math.ceil(raw / 4) * 4)
        expect(readGlyph(bytes)).toEqual(all.map(expected))
        const view = new DataView(bytes.buffer)
        const points = all.flatMap(expected)
        expect([1, 2, 3, 4].map((i) => view.getInt16(2 * i))).toEqual([
          Math.min(...points.map((p) => p.x)),
          Math.min(...points.map((p) => p.y)),
          Math.max(...points.map((p) => p.x)),
          Math.max(...points.map((p) => p.y)),
        ])
      }),
      runs,
    )
  })

  it('closes an outline left open', () => {
    const glyph = readGlyph(
      simpleGlyph([
        { command: 'moveTo', args: [0, 0] },
        { command: 'lineTo', args: [10, 0] },
        { command: 'lineTo', args: [10, 10] },
      ]),
    )
    expect(glyph).toHaveLength(1)
    expect(glyph[0]).toHaveLength(3)
  })

  it('starts a contour at each moveTo and after each closePath', () => {
    const line = (x: number): OutlineCommand => ({
      command: 'lineTo',
      args: [x, 5],
    })
    const glyph = readGlyph(
      simpleGlyph([
        { command: 'moveTo', args: [0, 0] },
        line(1),
        { command: 'moveTo', args: [10, 0] },
        line(11),
        { command: 'closePath', args: [] },
        line(20),
        line(21),
      ]),
    )
    expect(glyph.map((contour) => contour.length)).toEqual([2, 2, 2])
  })
})

describe('loadPdfFonts', () => {
  async function fonts(text: string, weight: number) {
    const lib = await import('@cantoo/pdf-lib')
    const doc = await PDFDocument.create()
    const loaded = await loadPdfFonts(
      lib,
      doc,
      [{ font: { family: 'Lora Variable', weight }, text }],
      bookFontFiles,
    )
    return { lib, doc, loaded }
  }

  it('measures at the style weight: Lora 700 sets wider than 400', async () => {
    const font = (weight: number) => ({
      family: 'Lora Variable' as const,
      weight,
      sizeMm: 10,
    })
    const regular = (await fonts('Summer', 400)).loaded
    const bold = (await fonts('Summer', 700)).loaded

    expect(bold.width('Summer', font(700))).toBeGreaterThan(
      regular.width('Summer', font(400)) * 1.03,
    )
    expect(regular.ascent(font(400))).toBeGreaterThan(0)
    expect(regular.descent(font(400))).toBeGreaterThan(0)
  })

  it('reads each font file once, and none for empty text', async () => {
    const doc = await PDFDocument.create()
    const read: string[] = []
    await loadPdfFonts(
      await import('@cantoo/pdf-lib'),
      doc,
      [
        { font: { family: 'Lora Variable', weight: 400 }, text: 'Summer' },
        { font: { family: 'Lora Variable', weight: 700 }, text: 'Summer' },
        { font: { family: 'Inter Variable', weight: 400 }, text: '' },
      ],
      (file) => {
        read.push(file)
        return bookFontFiles(file)
      },
    )

    expect(read).toHaveLength(1)
    expect(read[0]).toMatch(/^lora-latin/)
  })

  it('scales the vertical metrics with the size', async () => {
    const { loaded } = await fonts('Summer', 400)
    const font = (sizeMm: number) => ({
      family: 'Lora Variable' as const,
      weight: 400,
      sizeMm,
    })

    expect(loaded.ascent(font(10))).toBeCloseTo(2 * loaded.ascent(font(5)))
    expect(loaded.descent(font(10))).toBeCloseTo(2 * loaded.descent(font(5)))
    expect(loaded.ascent(font(10))).toBeLessThan(15)
  })

  it('sets each face run at its pen position, y up the page', async () => {
    const { doc, loaded } = await fonts('AБ', 400)
    const page = doc.addPage()
    const font = { family: 'Lora Variable' as const, weight: 400, sizeMm: 10 }

    const matrices = loaded
      .show(page, font, 'AБ', 2, 7)
      .map(String)
      .filter((op) => op.endsWith('Tm'))
      .map((op) => op.split(' ').slice(0, 6).map(Number))

    expect(matrices).toHaveLength(2)
    expect(matrices[0]).toEqual([1, 0, 0, -1, 2, 7])
    expect(matrices[1]?.slice(0, 4)).toEqual([1, 0, 0, -1])
    expect(matrices[1]?.[4]).toBeCloseTo(2 + loaded.width('A', font))
  })

  it('kerns a pair with a TJ shift and embeds a TrueType subset that fontkit reads', async () => {
    const { lib, doc, loaded } = await fonts('AVATAR', 500)
    const page = doc.addPage()
    const font = { family: 'Lora Variable' as const, weight: 500, sizeMm: 10 }

    const ops = loaded.show(page, font, 'AVATAR', 0, 0).map(String)
    loaded.show(page, font, 'TAR', 0, 20)
    const tj = ops.find((op) => op.endsWith('TJ')) ?? ''
    // Kerning pulls the pairs together by a fraction of the em, in 1/1000.
    const shifts = [...tj.matchAll(/> (-?[\d.]+) </g)].map(([, n]) => Number(n))
    expect(shifts.length).toBeGreaterThan(0)
    for (const shift of shifts) {
      expect(shift).toBeGreaterThan(0)
      expect(shift).toBeLessThan(200)
    }
    // Both lines share the page's one font resource.
    const resources = page.node
      .Resources()
      ?.lookup(lib.PDFName.of('Font'), lib.PDFDict)
    expect(resources?.keys()).toHaveLength(1)

    await loaded.embed()
    const files = doc.context
      .enumerateIndirectObjects()
      .map(([, object]) => object)
      .filter((object) => object instanceof lib.PDFDict)
      .map((dict) => dict.get(lib.PDFName.of('FontFile2')))
      .filter((ref) => ref instanceof lib.PDFRef)
      .map((ref) => doc.context.lookup(ref))
      .filter((stream) => stream instanceof lib.PDFRawStream)
    expect(files).toHaveLength(1)
    const subset = fontkit.create(
      files.map((file) => lib.decodePDFRawStream(file).decode())[0] ??
        new Uint8Array(),
    )
    // .notdef + A, V, T, R.
    expect(subset.numGlyphs).toBe(5)
    const codes = [...tj.matchAll(/<([0-9A-Fa-f]+)>/g)].flatMap(
      ([, hex = '']) => (hex.match(/.{4}/g) ?? []).map((c) => parseInt(c, 16)),
    )
    expect(new Set(codes)).toEqual(new Set([1, 2, 3, 4]))
    for (const id of [1, 2, 3, 4]) {
      const glyph = subset.getGlyph(id)
      expect(glyph.advanceWidth).toBeGreaterThan(0)
      expect(glyph.path.bbox.maxX).toBeGreaterThan(glyph.path.bbox.minX)
    }
  })
})

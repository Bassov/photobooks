import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fc } from '@fast-check/vitest'
import { getSpreadSizeMm } from '../geometry/spreadSize'
import { checkBookInvariants } from '../invariants'
import type { Book, Frame } from '../schema'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'
import { applyBookOp } from './applyBookOp'
import { framesPayload, nextFrameIds, pastedRects } from './clipboard'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number; numRuns: number } }

const runs = {
  seed: gates.pbt.seed,
  numRuns: Number(process.env.FC_NUM_RUNS ?? gates.pbt.numRuns),
}

const EPS = 1e-6
const TRIM = { widthMm: 300, heightMm: 200 }
const BLEED = 3
const SPREAD_IDS = ['first', 'middle', 'last'] as const

interface FrameSeed {
  x: number
  y: number
  width: number
  height: number
  /** A caption anchored to an earlier frame of its spread (by index). */
  anchor: number | null
}

const frameSeed: fc.Arbitrary<FrameSeed> = fc.record({
  x: fc.nat(),
  y: fc.nat(),
  width: fc.integer({ min: 5, max: 300 }),
  height: fc.integer({ min: 5, max: 200 }),
  anchor: fc.option(fc.nat(), { nil: null }),
})

/** Seeds as frames lying inside the spread's pages, captions anchored to earlier photos. */
function framesOf(seeds: readonly FrameSeed[], spreadWidth: number): Frame[] {
  const frames: Frame[] = []
  seeds.forEach((seed, i) => {
    const width = Math.min(seed.width, spreadWidth)
    const photos = frames.filter((f) => f.kind !== 'text')
    const anchor =
      seed.anchor === null || photos.length === 0
        ? undefined
        : photos[seed.anchor % photos.length]
    frames.push(
      makeFrame({
        id: `frame-${String(i + 1)}`,
        rect: {
          x: seed.x % (spreadWidth - width + 1),
          y: seed.y % (TRIM.heightMm - seed.height + 1),
          width,
          height: seed.height,
        },
        z: (seed.x + i) % 4,
        ...(anchor === undefined
          ? { assetId: 'a' }
          : {
              kind: 'text' as const,
              content: { type: 'template' as const, template: '{title}' },
              anchorFrameId: anchor.id,
            }),
      }),
    )
  })
  return frames
}

const scenario = fc.record({
  spreads: fc.tuple(
    fc.array(frameSeed, { minLength: 1, maxLength: 5 }),
    fc.array(frameSeed, { minLength: 1, maxLength: 5 }),
    fc.array(frameSeed, { minLength: 1, maxLength: 5 }),
  ),
  source: fc.nat(2),
  target: fc.nat(2),
  pick: fc.array(fc.boolean(), { minLength: 5, maxLength: 5 }),
  inPlace: fc.boolean(),
})

type Scenario = typeof scenario extends fc.Arbitrary<infer T> ? T : never

function setUp(s: Scenario) {
  const widths = [TRIM.widthMm, TRIM.widthMm * 2, TRIM.widthMm]
  const book: Book = makeBook({
    settings: { trim: TRIM, bleedMm: BLEED },
    assets: { a: { meta: { title: 'Lake' } } },
    gallery: ['a'],
    spreads: SPREAD_IDS.map((id, i) =>
      makeSpread({ id, frames: framesOf(s.spreads[i] ?? [], widths[i] ?? 0) }),
    ),
  })
  const sourceId = SPREAD_IDS[s.source] ?? 'first'
  const targetId = SPREAD_IDS[s.target] ?? 'first'
  const source = book.spreads[s.source]?.frames ?? []
  const picked = source.filter((_, i) => s.pick[i] === true)
  const frameIds = (picked.length > 0 ? picked : source).map((f) => f.id)
  const payload = framesPayload(book, sourceId, frameIds)
  const ids = nextFrameIds(book, targetId, payload.frames.length)
  const after = applyBookOp(book, {
    type: 'pasteFrames',
    spreadId: targetId,
    payload,
    inPlace: s.inPlace,
    ids,
  })
  const rects = pastedRects(book, targetId, payload, { inPlace: s.inPlace })
  return { book, after, payload, ids, sourceId, targetId, rects }
}

const frameAfter = (book: Book, spreadId: string) =>
  book.spreads.find((spread) => spread.id === spreadId)?.frames ?? []

describe('pasteFrames (PBT)', () => {
  it('adds one copy per payload frame with ids unique on the spread', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const { book, after, payload, ids, targetId } = setUp(s)
        const before = frameAfter(book, targetId)
        const now = frameAfter(after, targetId)
        expect(now.length).toBe(before.length + payload.frames.length)
        expect(new Set(now.map((f) => f.id)).size).toBe(now.length)
        expect(now.slice(before.length).map((f) => f.id)).toEqual(ids)
      }),
      runs,
    )
  })

  it('leaves the source frames and every other spread unchanged', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const { book, after, targetId } = setUp(s)
        for (const [i, spread] of book.spreads.entries()) {
          const now = after.spreads[i]?.frames ?? []
          if (spread.id === targetId) {
            expect(now.slice(0, spread.frames.length)).toEqual(spread.frames)
          } else {
            expect(after.spreads[i]).toBe(spread)
          }
        }
      }),
      runs,
    )
  })

  it('keeps the pairwise deltas and lands inside the area whenever it fits', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const { book, payload, targetId, rects } = setUp(s)
        const from = payload.frames.map((f) => f.rect)
        const [r0, f0] = [rects[0], from[0]]
        expect(rects.length).toBe(from.length)
        for (const [i, r] of rects.entries()) {
          const f = from[i]
          expect(r0 && f && f0).toBeTruthy()
          if (r0 === undefined || f === undefined || f0 === undefined) {
            continue
          }
          expect(Math.abs(r.x - r0.x - (f.x - f0.x))).toBeLessThan(EPS)
          expect(Math.abs(r.y - r0.y - (f.y - f0.y))).toBeLessThan(EPS)
          expect([r.width, r.height]).toEqual([f.width, f.height])
        }
        const index = book.spreads.findIndex((sp) => sp.id === targetId)
        const { widthMm, heightMm } = getSpreadSizeMm(book, index)
        const bbox = (rs: typeof rects) => ({
          x0: Math.min(...rs.map((r) => r.x)),
          x1: Math.max(...rs.map((r) => r.x + r.width)),
          y0: Math.min(...rs.map((r) => r.y)),
          y1: Math.max(...rs.map((r) => r.y + r.height)),
        })
        const src = bbox(from)
        const out = bbox(rects)
        if (src.x1 - src.x0 <= widthMm + 2 * BLEED) {
          expect(out.x0).toBeGreaterThanOrEqual(-BLEED - EPS)
          expect(out.x1).toBeLessThanOrEqual(widthMm + BLEED + EPS)
        }
        if (src.y1 - src.y0 <= heightMm + 2 * BLEED) {
          expect(out.y0).toBeGreaterThanOrEqual(-BLEED - EPS)
          expect(out.y1).toBeLessThanOrEqual(heightMm + BLEED + EPS)
        }
      }),
      runs,
    )
  })

  it('pastes in place on the source spread at the same rects', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const same = { ...s, target: s.source, inPlace: true }
        const { payload, rects } = setUp(same)
        expect(rects).toEqual(payload.frames.map((f) => f.rect))
      }),
      runs,
    )
  })

  it('never leaves a dangling anchor', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const { after } = setUp(s)
        expect(checkBookInvariants(after)).toEqual({ ok: true })
      }),
      runs,
    )
  })
})

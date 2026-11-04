import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fc } from '@fast-check/vitest'
import assert from 'node:assert/strict'
import { describe, expect, it } from 'vitest'
import { applyBookOp, type Book, type Frame } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { isMacPlatform, parentHitAt } from './parentHit'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number } }
const runs = {
  seed: gates.pbt.seed,
  numRuns: Math.max(1000, Number(process.env.FC_NUM_RUNS ?? 1000)),
}

const PX_PER_MM = 2

/** Three spreads on Master A; the middle one (`s2`, two pages) is tested. */
function book(
  parentFrames: Frame[] = [
    makeFrame({ id: 'band', rect: { x: 0, y: 0, width: 100, height: 20 } }),
    makeFrame({
      id: 'logo',
      rect: { x: 20, y: 4, width: 24, height: 8 },
      z: 1,
    }),
  ],
): Book {
  return makeBook({
    parents: [
      {
        id: 'p1',
        name: 'Master A',
        frames: parentFrames,
        guides: [{ id: 'pg', orientation: 'vertical', offsetMm: 150 }],
      },
    ],
    spreads: ['s1', 's2', 's3'].map((id) =>
      makeSpread({
        id,
        parentId: 'p1',
        // An own frame covering the logo: the hit test looks through it.
        frames: [
          makeFrame({ id: 'own', rect: { x: 0, y: 0, width: 60, height: 60 } }),
        ],
      }),
    ),
  })
}

const hit = (target: Book, x: number, y: number, guidesShown = true) =>
  parentHitAt(target, 's2', { x, y }, PX_PER_MM, guidesShown)

describe('parentHitAt', () => {
  it('finds the topmost parent frame under the press, through own frames', () => {
    expect(hit(book(), 30, 8)).toEqual({
      kind: 'frame',
      frameId: 'logo',
      parentName: 'Master A',
    })
    expect(hit(book(), 80, 10)).toMatchObject({ frameId: 'band' })
    expect(hit(book(), 80, 30)).toBeNull()
  })

  it('takes a parent guide within 4.5 screen px first, only while guides show', () => {
    const wide = book([
      makeFrame({ id: 'band', rect: { x: 0, y: 0, width: 300, height: 20 } }),
    ])
    expect(hit(wide, 152.25, 10)).toEqual({ kind: 'guide', guideId: 'pg' })
    expect(hit(wide, 147.75, 10)).toEqual({ kind: 'guide', guideId: 'pg' })
    expect(hit(wide, 152.5, 10)).toMatchObject({ kind: 'frame' })
    expect(hit(wide, 150, 10, false)).toMatchObject({ kind: 'frame' })
    // Guides show by default.
    expect(parentHitAt(wide, 's2', { x: 150, y: 10 }, PX_PER_MM)).toEqual({
      kind: 'guide',
      guideId: 'pg',
    })
  })

  it('takes the nearest parent guide by its axis and skips the spread own guides', () => {
    const base = book()
    const parent = base.parents?.[0]
    assert(parent !== undefined, 'expected Master A')
    const target: Book = {
      ...base,
      parents: [
        {
          ...parent,
          guides: [
            ...parent.guides,
            { id: 'pg2', orientation: 'vertical', offsetMm: 152 },
            { id: 'ph', orientation: 'horizontal', offsetMm: 100 },
          ],
        },
      ],
      spreads: base.spreads.map((spread) => ({
        ...spread,
        guides: [{ id: 'own-g', orientation: 'vertical', offsetMm: 181 }],
      })),
    }
    expect(hit(target, 151.5, 30)).toEqual({ kind: 'guide', guideId: 'pg2' })
    expect(hit(target, 150.5, 30)).toEqual({ kind: 'guide', guideId: 'pg' })
    expect(hit(target, 250, 101)).toEqual({ kind: 'guide', guideId: 'ph' })
    expect(hit(target, 180, 30)).toBeNull()
  })

  it('counts a press on the frame edge as inside', () => {
    expect(hit(book(), 20, 8)).toMatchObject({ frameId: 'logo' })
    expect(hit(book(), 30, 4)).toMatchObject({ frameId: 'logo' })
  })

  it('never hits a copy, a hidden item, a spread without a parent or an unknown spread', () => {
    const copied = applyBookOp(book(), {
      type: 'overrideParentFrame',
      spreadId: 's2',
      parentFrameId: 'logo',
    })
    expect(hit(copied, 30, 8)).toMatchObject({ frameId: 'band' })
    const hidden = applyBookOp(copied, {
      type: 'hideParentItem',
      spreadId: 's2',
      parentItemId: 'band',
    })
    expect(hit(hidden, 30, 8)).toBeNull()
    const none = applyBookOp(book(), {
      type: 'setSpreadParent',
      spreadId: 's2',
      parentId: null,
    })
    expect(hit(none, 30, 8)).toBeNull()
    expect(parentHitAt(book(), 'gone', { x: 30, y: 8 }, PX_PER_MM)).toBeNull()
  })

  it('tests the rotated rect (PBT): inside hits, outside misses', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -180, max: 180 }),
        fc.double({ min: -0.95, max: 0.95, noNaN: true }),
        fc.double({ min: -0.95, max: 0.95, noNaN: true }),
        fc.boolean(),
        (rotationDeg, u, v, outside) => {
          const rect = { x: 100, y: 100, width: 40, height: 20 }
          const target = book([makeFrame({ id: 'tilt', rect, rotationDeg })])
          // A local point (u, v of the half sizes), pushed out on x if `outside`.
          const localX = (outside ? Math.sign(u || 1) * 1.1 : u) * 20
          const localY = v * 10
          const rad = (rotationDeg * Math.PI) / 180
          const x = 120 + localX * Math.cos(rad) - localY * Math.sin(rad)
          const y = 110 + localX * Math.sin(rad) + localY * Math.cos(rad)
          const found = parentHitAt(target, 's2', { x, y }, PX_PER_MM, false)
          expect(found?.kind === 'frame').toBe(!outside)
        },
      ),
      runs,
    )
  })
})

describe('isMacPlatform', () => {
  it('reads the user agent', () => {
    expect(isMacPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')).toBe(
      true,
    )
    expect(isMacPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(
      false,
    )
    expect(isMacPlatform('Mozilla/5.0 (X11; Linux x86_64)')).toBe(false)
  })
})

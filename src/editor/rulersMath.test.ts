import { describe, expect, it } from 'vitest'
import {
  pageLocalMm,
  rulerGeometry,
  rulerStepMm,
  rulerTicks,
} from './rulersMath'

describe('rulerGeometry', () => {
  const input = {
    boxLeft: 150,
    boxTop: 90,
    boxWidth: 600,
    areaLeft: 50,
    areaTop: 40,
    offsetWidth: 300,
    pxPerMm: 0.5,
    pageMm: 300,
  }

  it('measures origins from the area and scale from the live box', () => {
    expect(rulerGeometry(input)).toEqual({
      originX: 100,
      originY: 50,
      sc: 1,
      spineMm: 300,
    })
  })

  it('has no spine for a single page', () => {
    expect(rulerGeometry({ ...input, offsetWidth: 150 }).spineMm).toBeNull()
    expect(rulerGeometry({ ...input, offsetWidth: 225 }).spineMm).toBeNull()
    expect(rulerGeometry({ ...input, offsetWidth: 226 }).spineMm).toBe(300)
  })
})

const base = { axis: 'x', origin: 0, sc: 1, len: 100, pageMm: 200 } as const

describe('rulerStepMm', () => {
  it.each([
    [10, 5],
    [6.8, 5],
    [6.79, 10],
    [3.4, 10],
    [3.39, 20],
    [2.695, 20],
    [1.7, 20],
    [1.69, 50],
    [0.68, 50],
    [0.67, 100],
    [0.34, 100],
    [0.33, 200],
    [0.17, 200],
    [0.169, 500],
    [0.068, 500],
    [0.067, 1000],
    [0.001, 1000],
  ])('scale %f gives %i mm', (sc, step) => {
    expect(rulerStepMm(sc)).toBe(step)
  })

  it('keeps majors at least 34 px apart down to the 1000 mm step', () => {
    for (let sc = 0.034; sc <= 12; sc += 0.013) {
      expect(rulerStepMm(sc) * sc).toBeGreaterThanOrEqual(34)
    }
  })
})

describe('pageLocalMm', () => {
  it('wraps at the spine and for negative mm', () => {
    expect(pageLocalMm(210, 200)).toBe(10)
    expect(pageLocalMm(-10, 200)).toBe(190)
    expect(pageLocalMm(0, 200)).toBe(0)
  })
})

describe('rulerTicks', () => {
  it('puts a tick every step/5 mm at mm * sc past the origin', () => {
    const ticks = rulerTicks({ ...base, sc: 8, origin: 24, len: 50 })
    expect(ticks.map((t) => t.mm).slice(0, 5)).toEqual([-3, -2, -1, 0, 1])
    expect(ticks.find((t) => t.mm === 0)?.p).toBe(24)
    expect(ticks.find((t) => t.mm === 1)?.p).toBe(32)
  })

  it('marks majors on the step and labels only them', () => {
    const ticks = rulerTicks({ ...base, sc: 1.8, len: 82 })
    const majors = ticks.filter((t) => t.major)
    expect(majors.map((t) => t.mm)).toEqual([0, 20, 40])
    expect(majors.map((t) => t.label)).toEqual([0, 20, 40])
    expect(
      ticks.filter((t) => !t.major).every((t) => t.label === undefined),
    ).toBe(true)
    expect(ticks.find((t) => t.mm === 4)?.major).toBe(false)
  })

  it('culls ticks outside [0, len]', () => {
    const ticks = rulerTicks({ ...base, origin: -54, sc: 1.8, len: 108 })
    expect(ticks.every((t) => t.p >= 0 && t.p <= 108)).toBe(true)
    expect(ticks[0]?.mm).toBe(32)
    expect(ticks.at(-1)?.mm).toBe(88)
  })

  it('resets X labels at the spine and shows 0 there', () => {
    const ticks = rulerTicks({
      ...base,
      origin: 0,
      sc: 1.8,
      len: 400,
      pageMm: 100,
    })
    const label = (mm: number) => ticks.find((t) => t.mm === mm)?.label
    expect(label(80)).toBe(80)
    expect(label(100)).toBe(0)
    expect(label(120)).toBe(20)
  })

  it('Y labels are plain mm, including negative', () => {
    const ticks = rulerTicks({
      axis: 'y',
      origin: 40,
      sc: 1.8,
      len: 120,
      pageMm: 100,
    })
    expect(ticks.find((t) => t.mm === -20)?.label).toBe(-20)
    expect(ticks.find((t) => t.mm === 40)?.label).toBe(40)
  })

  it('uses a coarser step when zoomed far out', () => {
    const ticks = rulerTicks({ ...base, sc: 0.7, len: 72 })
    expect(ticks.filter((t) => t.major).map((t) => t.mm)).toEqual([0, 50, 100])
    expect(ticks.find((t) => t.mm === 10)?.major).toBe(false)
  })

  it('uses the denser step at higher scale', () => {
    const ticks = rulerTicks({ ...base, sc: 8, len: 80 })
    expect(ticks.filter((t) => t.major).map((t) => t.mm)).toEqual([0, 5, 10])
  })

  it('includes ticks exactly on both ends and nothing past them', () => {
    const ticks = rulerTicks({ ...base, sc: 8, origin: 0, len: 40 })
    expect(ticks.map((t) => [t.mm, t.p])).toEqual([
      [0, 0],
      [1, 8],
      [2, 16],
      [3, 24],
      [4, 32],
      [5, 40],
    ])
    const shifted = rulerTicks({ ...base, sc: 8, origin: 24, len: 48 })
    expect(shifted.map((t) => t.mm)).toEqual([-3, -2, -1, 0, 1, 2, 3])
  })

  it('rounds labels to 0.01 mm and keeps majors every fifth tick', () => {
    const ticks = rulerTicks({ ...base, sc: 8, origin: 0, len: 83 })
    expect(ticks.filter((t) => t.major).map((t) => t.label)).toEqual([0, 5, 10])
    expect(ticks.filter((t) => t.major)).toHaveLength(3)
  })

  it('returns nothing for a degenerate ruler', () => {
    expect(rulerTicks({ ...base, sc: 0, origin: 10 })).toEqual([])
    expect(rulerTicks({ ...base, sc: -1, origin: 10 })).toEqual([])
    expect(rulerTicks({ ...base, sc: 0 })).toEqual([])
    expect(rulerTicks({ ...base, len: 0 })).toEqual([])
  })
})

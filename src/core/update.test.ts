import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { updateFrame, updateSpread } from './index'
import { makeBook, makeFrame, makeSpread } from './testing/fixtures'

describe('updateSpread / updateFrame', () => {
  it('preserves unrelated spread identity when one spread changes', () => {
    const spreadA = makeSpread({ id: 'a', frames: [makeFrame({ id: 'f1' })] })
    const spreadB = makeSpread({ id: 'b', frames: [makeFrame({ id: 'f2' })] })
    const book = makeBook({ spreads: [spreadA, spreadB] })

    const next = updateSpread(book, 'a', (spread) => ({
      ...spread,
      frames: [...spread.frames, makeFrame({ id: 'f3', z: 1 })],
    }))

    expect(next).not.toBe(book)
    expect(next.spreads[0]).not.toBe(spreadA)
    expect(next.spreads[1]).toBe(spreadB)
  })

  it('returns the same book when updater is a no-op', () => {
    const book = makeBook()
    const next = updateSpread(book, 'spread-1', (spread) => spread)
    expect(next).toBe(book)
  })

  it('preserves book when spread id is missing', () => {
    const book = makeBook()
    expect(updateSpread(book, 'missing', (s) => s)).toBe(book)
  })

  it('updates a frame while preserving other spreads', () => {
    const spreadA = makeSpread({
      id: 'a',
      frames: [makeFrame({ id: 'f1', z: 0 })],
    })
    const spreadB = makeSpread({ id: 'b', frames: [makeFrame({ id: 'f2' })] })
    const book = makeBook({ spreads: [spreadA, spreadB] })

    const next = updateFrame(book, 'a', 'f1', (frame) => ({ ...frame, z: 9 }))

    expect(next.spreads[1]).toBe(spreadB)
    expect(next.spreads[0]?.frames[0]?.z).toBe(9)
  })

  it('returns the same book when frame updater is a no-op', () => {
    const book = makeBook()
    const next = updateFrame(book, 'spread-1', 'frame-1', (frame) => frame)
    expect(next).toBe(book)
  })

  it('does not mutate the original spreads array', () => {
    const book = makeBook()
    const originalLength = book.spreads.length
    const next = updateSpread(book, 'spread-1', (spread) => ({
      ...spread,
      frames: [...spread.frames, makeFrame({ id: 'extra', z: 1 })],
    }))
    next.spreads.push(makeSpread({ id: 'injected' }))
    expect(book.spreads).toHaveLength(originalLength)
  })

  it('updates only the targeted frame among several', () => {
    const frameA = makeFrame({ id: 'f1', z: 0 })
    const frameB = makeFrame({ id: 'f2', z: 1 })
    const book = makeBook({
      spreads: [makeSpread({ id: 's1', frames: [frameA, frameB] })],
    })

    const next = updateFrame(book, 's1', 'f2', (frame) => ({ ...frame, z: 99 }))

    expect(next.spreads[0]?.frames[0]).toBe(frameA)
    expect(next.spreads[0]?.frames[1]?.z).toBe(99)
    expect(frameB.z).toBe(1)
  })

  it('returns the same book when frame id is missing', () => {
    const book = makeBook()
    expect(
      updateFrame(book, 'spread-1', 'missing', (f) => ({ ...f, z: 3 })),
    ).toBe(book)
  })

  it('does not rewrite the first spread when the id is missing', () => {
    const spreadA = makeSpread({ id: 'a', frames: [makeFrame({ id: 'f1' })] })
    const spreadB = makeSpread({ id: 'b', frames: [makeFrame({ id: 'f2' })] })
    const book = makeBook({ spreads: [spreadA, spreadB] })

    const next = updateSpread(book, 'missing', (spread) => ({
      ...spread,
      frames: [],
    }))

    expect(next).toBe(book)
    expect(book.spreads[0]).toBe(spreadA)
    expect(spreadA.frames).toHaveLength(1)
  })

  it('does not mutate the original frames array', () => {
    const frameA = makeFrame({ id: 'f1' })
    const book = makeBook({
      spreads: [makeSpread({ id: 's1', frames: [frameA] })],
    })
    const next = updateFrame(book, 's1', 'f1', (frame) => ({ ...frame, z: 2 }))
    next.spreads[0]?.frames.push(makeFrame({ id: 'injected' }))
    expect(book.spreads[0]?.frames).toHaveLength(1)
  })
})

test.prop([fc.integer({ min: 0, max: 2 })], {
  numRuns: Number(process.env.FC_NUM_RUNS ?? 100),
})('updating one spread preserves other spread identities', (targetIndex) => {
  const spreads = [0, 1, 2].map((i) =>
    makeSpread({
      id: `s${String(i)}`,
      frames: [makeFrame({ id: `f${String(i)}` })],
    }),
  )
  const book = makeBook({ spreads })
  const targetId = `s${String(targetIndex)}`

  const next = updateSpread(book, targetId, (spread) => ({
    ...spread,
    frames: [...spread.frames, makeFrame({ id: 'extra', z: 1 })],
  }))

  for (const [index, spread] of spreads.entries()) {
    if (index === targetIndex) {
      expect(next.spreads[index]).not.toBe(spread)
    } else {
      expect(next.spreads[index]).toBe(spread)
    }
  }
})

import { describe, expect, it } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import {
  inspectorView,
  sameInspectorPanel,
  spreadLabel,
  spreadSummary,
  type InspectorPanel,
} from './inspectorModel'

describe('sameInspectorPanel', () => {
  const base: InspectorPanel = { kind: 'frame', spreadId: 's1' }
  const spread: InspectorPanel = { kind: 'spread', spreadId: 's1' }
  const empty: InspectorPanel = { kind: 'empty' }

  it('is true for an equal copy', () => {
    expect(sameInspectorPanel(base, { ...base })).toBe(true)
    expect(sameInspectorPanel(spread, { ...spread })).toBe(true)
    expect(sameInspectorPanel(empty, { kind: 'empty' })).toBe(true)
  })

  it('is false when the frame panel spread id differs', () => {
    expect(sameInspectorPanel(base, { ...base, spreadId: 's2' })).toBe(false)
  })

  it('is false across kinds in either order', () => {
    for (const [x, y] of [
      [base, spread],
      [spread, base],
      [base, empty],
      [empty, base],
      [spread, empty],
      [empty, spread],
    ] as const) {
      expect(sameInspectorPanel(x, y)).toBe(false)
    }
  })

  it('compares spread panels by id', () => {
    expect(sameInspectorPanel(spread, { ...spread, spreadId: 's2' })).toBe(
      false,
    )
  })
})

const f1 = makeFrame({ id: 'f1', assetId: 'a' })
const f2 = makeFrame({ id: 'f2' })
const s1 = makeSpread({ id: 's1', frames: [f1, f2] })
const s2 = makeSpread({ id: 's2', templateId: 't-two-up', frames: [] })
const book = makeBook({
  assets: {
    a: { widthPx: 4000, heightPx: 3000, relativePath: 'trip/a.jpg' },
    b: {},
  },
  gallery: ['a', 'b'],
  spreads: [s1, s2],
})

describe('inspectorView', () => {
  it('prefers the selected frame', () => {
    const view = inspectorView(
      book,
      { spreadId: 's1', frameId: 'f1' },
      's2',
      null,
    )
    expect(view.kind).toBe('frame')
  })

  it('falls back to the active spread, then empty', () => {
    expect(inspectorView(book, null, 's2', null).kind).toBe('spread')
    expect(inspectorView(book, null, 's2', 's2').kind).toBe('empty')
    expect(inspectorView(book, null, null, null).kind).toBe('empty')
    expect(inspectorView(book, null, 'gone', null).kind).toBe('empty')
  })

  it('ignores a frame id that belongs to another spread', () => {
    const view = inspectorView(
      book,
      { spreadId: 's2', frameId: 'f1' },
      's2',
      null,
    )
    expect(view.kind).toBe('spread')
  })

  it('reports the index of the picked spread', () => {
    const other = makeSpread({ id: 's3', frames: [makeFrame({ id: 'f3' })] })
    const view = inspectorView(
      makeBook({ spreads: [s1, s2, other] }),
      { spreadId: 's3', frameId: 'f3' },
      null,
      null,
    )
    expect(view).toMatchObject({ kind: 'frame', spreadIndex: 2 })
  })

  it('ignores a stale frame source', () => {
    const view = inspectorView(
      book,
      { spreadId: 's1', frameId: 'gone' },
      null,
      null,
    )
    expect(view.kind).toBe('empty')
  })
})

describe('spreadLabel', () => {
  // uikit/src/sandbox/context-inspector.tsx:59 labels the first spread "Page 1".
  it('labels the first spread "Page 1" like the kit', () => {
    expect(spreadLabel(0)).toBe('Page 1')
    expect(spreadLabel(1)).toBe('Pages 2–3')
    expect(spreadLabel(2)).toBe('Pages 4–5')
  })
})

describe('spreadSummary', () => {
  const book = makeBook({
    spreads: [
      makeSpread({ id: 'first', frames: [makeFrame({ id: 'c1' })] }),
      makeSpread({
        id: 'mid',
        frames: [
          makeFrame({ id: 'a', assetId: 'x' }),
          makeFrame({ id: 'b' }),
          makeFrame({ id: 'c' }),
          makeFrame({ id: 't', kind: 'text' }),
        ],
      }),
    ],
  })

  // uikit/src/sandbox/context-inspector.tsx:56-59: "Page 1" first, image
  // frames without a photo count as empty.
  it('names the pages and counts empty photo frames (kit Spread header)', () => {
    expect(spreadSummary(book, 'mid')).toBe('Pages 2–3 · 2 empty')
    expect(spreadSummary(book, 'first')).toBe('Page 1 · 1 empty')
  })

  it('is blank for an unknown spread', () => {
    expect(spreadSummary(book, 'nope')).toBe('')
  })
})

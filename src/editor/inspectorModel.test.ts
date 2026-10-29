import { describe, expect, it } from 'vitest'
import type { Book } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import {
  framePhotoRows,
  inspectorView,
  sameInspectorPanel,
  spreadRows,
  spreadTitle,
  type InspectorPanel,
} from './inspectorModel'

describe('sameInspectorPanel', () => {
  const base: InspectorPanel = {
    kind: 'frame',
    spreadId: 's1',
    rows: [{ label: 'Size', value: '1 × 2' }],
    spreadRows: [{ label: 'Frames', value: '2' }],
  }
  const spread: InspectorPanel = {
    kind: 'spread',
    spreadId: 's1',
    spreadRows: [{ label: 'Frames', value: '2' }],
  }
  const empty: InspectorPanel = { kind: 'empty' }

  it('is true for an equal copy with new row objects', () => {
    expect(
      sameInspectorPanel(base, {
        ...base,
        rows: [{ label: 'Size', value: '1 × 2' }],
      }),
    ).toBe(true)
    expect(
      sameInspectorPanel(spread, {
        ...spread,
        spreadRows: [{ label: 'Frames', value: '2' }],
      }),
    ).toBe(true)
    expect(sameInspectorPanel(empty, { kind: 'empty' })).toBe(true)
  })

  it.each<[string, Partial<Extract<InspectorPanel, { kind: 'frame' }>>]>([
    ['spread row value', { spreadRows: [{ label: 'Frames', value: '3' }] }],
    ['spread row label', { spreadRows: [{ label: 'Photos', value: '2' }] }],
    ['spread row count', { spreadRows: [] }],
    ['spread id', { spreadId: 's2' }],
    ['row count', { rows: [] }],
    ['row label', { rows: [{ label: 'Pixels', value: '1 × 2' }] }],
    ['row value', { rows: [{ label: 'Size', value: '3 × 4' }] }],
  ])('is false when %s differs', (_, patch) => {
    expect(sameInspectorPanel(base, { ...base, ...patch })).toBe(false)
  })

  it('does not merge rows across label/value boundaries', () => {
    const row = (label: string, value: string) => [{ label, value }]
    expect(
      sameInspectorPanel(
        { ...base, rows: row('a', 'b') },
        { ...base, rows: row('ab', '') },
      ),
    ).toBe(false)
    expect(
      sameInspectorPanel(
        { ...base, rows: [...row('a', 'b'), ...row('c', 'd')] },
        { ...base, rows: [...row('a', 'b\u0001c'), ...row('', 'd')] },
      ),
    ).toBe(false)
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

  it('compares spread panels by id and rows', () => {
    expect(sameInspectorPanel(spread, { ...spread, spreadId: 's2' })).toBe(
      false,
    )
    expect(sameInspectorPanel(spread, { ...spread, spreadRows: [] })).toBe(
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

describe('rows', () => {
  it('titles the cover and page spreads', () => {
    expect(spreadTitle(0)).toBe('Cover')
    expect(spreadTitle(1)).toBe('Pages 2–3')
  })

  it('describes a spread', () => {
    expect(spreadRows(s1)).toEqual([
      { label: 'Template', value: 'Free layout' },
      { label: 'Frames', value: '2' },
      { label: 'Photos', value: '1' },
    ])
    expect(spreadRows(s2)[0]?.value).toBe('two up')
  })

  it('names templates by stripping only the leading t- and all dashes', () => {
    const named = (templateId: string) =>
      spreadRows(makeSpread({ templateId }))[0]?.value
    expect(named('t-three-up-wide')).toBe('three up wide')
    expect(named('split-two')).toBe('split two')
  })

  it('counts only frames that hold a photo', () => {
    const three = makeSpread({
      frames: [
        makeFrame({ id: 'x1', assetId: 'a' }),
        makeFrame({ id: 'x2', assetId: 'b' }),
        makeFrame({ id: 'x3' }),
      ],
    })
    const rows = spreadRows(three)
    expect(rows[1]?.value).toBe('3')
    expect(rows[2]?.value).toBe('2')
  })

  it('does not look up an asset for an empty frame', () => {
    const odd = makeBook({
      assets: { undefined: { widthPx: 1, heightPx: 2, relativePath: 'u.jpg' } },
    })
    expect(framePhotoRows(odd, f2, 0, 0).map((r) => r.label)).toEqual([
      'Spread',
      'Size',
    ])
  })

  it('shows pixels only when both dimensions are known', () => {
    const labels = (asset: Book['assets'][string]) =>
      framePhotoRows(makeBook({ assets: { a: asset } }), f1, 0, 1).map(
        (r) => r.label,
      )
    expect(labels({ widthPx: 10 })).toEqual(['Spread', 'Size', 'Used'])
    expect(labels({ heightPx: 10 })).toEqual(['Spread', 'Size', 'Used'])
    expect(labels({ widthPx: 10, heightPx: 20 })).toContain('Pixels')
  })

  it('describes a placed photo and an empty frame', () => {
    const placed = framePhotoRows(book, f1, 0, 2).map((r) => r.label)
    expect(placed).toEqual(['Spread', 'Size', 'Pixels', 'File', 'Used'])
    expect(framePhotoRows(book, f2, 0, 0).map((r) => r.label)).toEqual([
      'Spread',
      'Size',
    ])
  })
})

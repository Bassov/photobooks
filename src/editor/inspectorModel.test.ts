import { describe, expect, it } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import {
  ALIGN_REASON,
  alignState,
  DISTRIBUTE_REASON,
  inspectorView,
  multiSummary,
  selectionCaption,
  linkMarginsPatch,
  marginsEqual,
  masterGridPatch,
  parentUsage,
  resetGridFields,
  parentUsageLabel,
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

  it('shows multi for 2 or more selected frames on a book spread', () => {
    const view = inspectorView(book, null, 's2', null, {
      spreadId: 's1',
      frameIds: ['f2', 'f1'],
    })
    expect(view).toMatchObject({ kind: 'multi', spreadIndex: 0 })
    expect(view.kind === 'multi' ? view.frames : []).toEqual([f1, f2])
  })

  it('falls back when fewer than 2 selected frames still exist or the spread is not a book spread', () => {
    const one = { spreadId: 's1', frameIds: ['f1'] }
    const stale = { spreadId: 's1', frameIds: ['f1', 'gone'] }
    const parent = { spreadId: 'm', frameIds: ['f1', 'f2'] }
    expect(inspectorView(book, null, 's2', null, one).kind).toBe('spread')
    expect(inspectorView(book, null, 's2', null, stale).kind).toBe('spread')
    expect(inspectorView(book, null, null, null, parent).kind).toBe('empty')
  })
})

describe('sameInspectorPanel, multi', () => {
  it('is the same only for the same selection object', () => {
    const set = { spreadId: 's1', frameIds: ['f1', 'f2'] }
    const multi: InspectorPanel = { kind: 'multi', spreadId: 's1', set }
    expect(sameInspectorPanel(multi, { ...multi })).toBe(true)
    expect(
      sameInspectorPanel(multi, {
        ...multi,
        set: { spreadId: 's1', frameIds: ['f1', 'f2', 'f3'] },
      }),
    ).toBe(false)
    expect(sameInspectorPanel(multi, { kind: 'spread', spreadId: 's1' })).toBe(
      false,
    )
    expect(sameInspectorPanel({ kind: 'frame', spreadId: 's1' }, multi)).toBe(
      false,
    )
  })
})

describe('multiSummary', () => {
  const photo = makeFrame({ id: 'p', assetId: 'a' })
  const empty = makeFrame({ id: 'e' })
  const text = makeFrame({ id: 't', kind: 'text' })

  it('counts frames, then only the non-zero parts', () => {
    expect(multiSummary([photo, photo])).toBe('2 frames · 2 photos')
    expect(multiSummary([photo, photo, empty])).toBe(
      '3 frames · 2 photos, 1 empty',
    )
    expect(multiSummary([photo, empty, text, text])).toBe(
      '4 frames · 1 photo, 1 empty, 2 text',
    )
    expect(multiSummary([empty, text])).toBe('2 frames · 1 empty, 1 text')
  })
})

describe('alignState', () => {
  const free = makeFrame({ id: 'a' })
  const locked = makeFrame({ id: 'l', locked: true })

  it('needs 2 unlocked frames to align and 3 to distribute', () => {
    expect(alignState([free, free, free])).toEqual({
      locked: 0,
      alignReason: undefined,
      distributeReason: undefined,
    })
    expect(alignState([free, free, locked])).toEqual({
      locked: 1,
      alignReason: undefined,
      distributeReason: DISTRIBUTE_REASON,
    })
    expect(alignState([free, locked])).toEqual({
      locked: 1,
      alignReason: ALIGN_REASON,
      distributeReason: DISTRIBUTE_REASON,
    })
    expect(ALIGN_REASON).toBe('Needs 2 unlocked frames')
    expect(DISTRIBUTE_REASON).toBe('Select 3 or more unlocked frames')
  })
})

describe('selectionCaption', () => {
  const at = (x: number, y: number, locked = false) =>
    makeFrame({
      id: `${String(x)}-${String(y)}`,
      rect: { x, y, width: 40.04, height: 30 },
      ...(locked ? { locked: true } : {}),
    })

  it('sizes the box of every selected frame, locked ones included', () => {
    expect(selectionCaption([at(10, 10), at(204.9, 190)])).toBe(
      'Selection 234.9 × 210 mm',
    )
    expect(selectionCaption([at(10, 10), at(50, 10), at(100, 40, true)])).toBe(
      'Selection 130 × 60 mm · 1 locked, skipped',
    )
    expect(selectionCaption([])).toBe('')
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

describe('parentUsage', () => {
  const parents = [
    { id: 'pa', name: 'Master A', frames: [], guides: [] },
    { id: 'pb', name: 'Master B', frames: [], guides: [] },
  ]

  it('counts the default parent: 1 + 2 + 2 + 1 pages', () => {
    const book = makeBook({
      parents,
      defaultParentId: 'pa',
      spreads: ['a', 'b', 'c', 'd'].map((id) => makeSpread({ id })),
    })
    expect(parentUsage(book, 'pa')).toBe(6)
    expect(parentUsage(book, 'pb')).toBe(0)
  })

  it('counts explicit parents; None and a lone spread are 0 and 1', () => {
    const book = makeBook({
      parents,
      defaultParentId: 'pa',
      spreads: [
        makeSpread({ id: 'a', parentId: null }),
        makeSpread({ id: 'b', parentId: 'pb' }),
        makeSpread({ id: 'c' }),
      ],
    })
    expect(parentUsage(book, 'pa')).toBe(1)
    expect(parentUsage(book, 'pb')).toBe(2)
    const lone = makeBook({
      parents,
      spreads: [makeSpread({ parentId: 'pb' })],
    })
    expect(parentUsage(lone, 'pb')).toBe(1)
  })

  it('masterGridPatch: a linked margin writes all four, a count stays single', () => {
    expect(masterGridPatch('columns', 3, true)).toEqual({ columns: 3 })
    expect(masterGridPatch('top', 3, false)).toEqual({ top: 3 })
    expect(masterGridPatch('bottom', 3, true)).toEqual({
      top: 3,
      bottom: 3,
      inside: 3,
      outside: 3,
    })
  })

  const grid = {
    columns: 2,
    rows: 2,
    columnGutterMm: 5,
    rowGutterMm: 5,
    top: 15,
    bottom: 15,
    inside: 15,
    outside: 15,
  }

  it('marginsEqual: only all four margins equal (counts ignored)', () => {
    expect(marginsEqual(grid)).toBe(true)
    expect(marginsEqual({ ...grid, columns: 9 })).toBe(true)
    for (const field of ['top', 'bottom', 'inside', 'outside'] as const) {
      expect(marginsEqual({ ...grid, [field]: 9 })).toBe(false)
    }
  })

  it('linkMarginsPatch: writes only margins that differ from Top (GP5)', () => {
    expect(linkMarginsPatch(grid)).toBeNull()
    expect(linkMarginsPatch({ ...grid, bottom: 9, outside: 4 })).toEqual({
      bottom: 15,
      outside: 15,
    })
    expect(linkMarginsPatch({ ...grid, top: 7 })).toEqual({
      bottom: 7,
      inside: 7,
      outside: 7,
    })
  })

  it('resetGridFields: a linked margin resets all four, else just the field (GP3)', () => {
    expect(resetGridFields('inside', true)).toEqual([
      'top',
      'bottom',
      'inside',
      'outside',
    ])
    expect(resetGridFields('inside', false)).toEqual(['inside'])
    expect(resetGridFields('columnGutterMm', true)).toEqual(['columnGutterMm'])
  })

  it('labels 0, 1 and N pages', () => {
    expect(parentUsageLabel(0)).toBe('Not used yet')
    expect(parentUsageLabel(1)).toBe('Used by 1 page')
    expect(parentUsageLabel(10)).toBe('Used by 10 pages')
  })
})

import { describe, expect, it } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import {
  framePhotoRows,
  inspectorView,
  spreadRows,
  spreadTitle,
} from './inspectorModel'

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

  it('describes a placed photo and an empty frame', () => {
    const placed = framePhotoRows(book, f1, 0, 2).map((r) => r.label)
    expect(placed).toEqual(['Spread', 'Size', 'Pixels', 'File', 'Used'])
    expect(framePhotoRows(book, f2, 0, 0).map((r) => r.label)).toEqual([
      'Spread',
      'Size',
    ])
  })
})

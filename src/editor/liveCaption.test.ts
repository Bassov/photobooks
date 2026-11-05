import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { Frame } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import {
  anchorOptions,
  chipAnchor,
  chipState,
  editableText,
  imageFrames,
  insertToken,
  isLive,
  LIVE_TOKENS,
} from './liveCaption'

const near = makeFrame({
  id: 'near',
  rect: { x: 10, y: 10, width: 50, height: 40 },
  assetId: 'lake',
})
const far = makeFrame({
  id: 'far',
  rect: { x: 200, y: 10, width: 50, height: 40 },
  assetId: 'bare',
})
const empty = makeFrame({
  id: 'empty',
  rect: { x: 100, y: 10, width: 50, height: 40 },
})
const caption: Frame = {
  id: 't',
  kind: 'text',
  rect: { x: 10, y: 55, width: 50, height: 8 },
  z: 3,
  content: { type: 'static', text: 'Hi' },
}
const spread = makeSpread({ id: 's1', frames: [near, empty, far, caption] })
const book = makeBook({
  spreads: [spread],
  assets: {
    lake: {
      relativePath: 'trip/day 1/IMG_0001.jpg',
      capturedAt: '2025:07:12 08:35:00',
      meta: { title: 'Morning on the lake', camera: 'Canon EOS R5' },
    },
    bare: {},
  },
})
const liveCaption: Frame = {
  ...caption,
  content: { type: 'template', template: '{date}' },
  anchorFrameId: 'far',
}

describe('live caption helpers', () => {
  it('the field edits the template while live, the static text otherwise', () => {
    expect(isLive(caption)).toBe(false)
    expect(editableText(caption)).toBe('Hi')
    expect(isLive(liveCaption)).toBe(true)
    expect(editableText(liveCaption)).toBe('{date}')
    expect(editableText({ ...caption, content: undefined })).toBe('')
  })

  it('chips read the anchor while live, else the frame Live would pick', () => {
    expect(chipAnchor(spread, caption)?.id).toBe('near')
    expect(chipAnchor(spread, liveCaption)?.id).toBe('far')
    expect(imageFrames(spread).map((frame) => frame.id)).toEqual([
      'near',
      'empty',
      'far',
    ])
  })

  it('chip titles: the value, Not in this photo, No photo in this frame', () => {
    expect(
      LIVE_TOKENS.map((token) => chipState(book, spread, near, token)),
    ).toEqual([
      { title: '12 Jul 2025', missing: false },
      { title: 'Morning on the lake', missing: false },
      { title: 'Not in this photo', missing: true },
      { title: 'Canon EOS R5', missing: false },
    ])
    expect(chipState(book, spread, far, 'date')).toEqual({
      title: 'Not in this photo',
      missing: true,
    })
    expect(chipState(book, spread, empty, 'title')).toEqual({
      title: 'No photo in this frame',
      missing: true,
    })
    expect(chipState(book, spread, undefined, 'camera').title).toBe(
      'No photo in this frame',
    )
  })

  it('Anchored to lists every image frame with its file name or empty', () => {
    expect(anchorOptions(book, spread, (id) => `name-${id}`)).toEqual([
      { value: 'near', label: 'Frame 1 · IMG_0001.jpg' },
      { value: 'empty', label: 'Frame 2 · empty' },
      { value: 'far', label: 'Frame 3 · name-bare' },
    ])
  })

  it('appends with the kit separator when no caret is remembered', () => {
    expect(insertToken('', 'date', null)).toEqual({
      text: '{date}',
      caret: null,
    })
    expect(insertToken('Lake', 'camera', null)).toEqual({
      text: 'Lake · {camera}',
      caret: null,
    })
  })

  it('PBT: a remembered selection is replaced by the token, caret after it', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.nat(),
        fc.nat(),
        fc.constantFrom(...LIVE_TOKENS),
        (text, a, b, token) => {
          const start = Math.min(a, b) % (text.length + 1)
          const end = Math.max(start, Math.max(a, b) % (text.length + 1))
          const next = insertToken(text, token, { start, end })
          const tag = `{${token}}`
          expect(next.text).toBe(text.slice(0, start) + tag + text.slice(end))
          expect(next.caret).toEqual({
            start: start + tag.length,
            end: start + tag.length,
          })
          expect(next.text.slice(start, start + tag.length)).toBe(tag)
        },
      ),
    )
  })
})

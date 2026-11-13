import { describe, expect, it } from 'vitest'
import type { RoomSlide } from '../siteModel'
import { bookInput } from '../siteRoom.test-helpers'
import type { RoomBook } from '../SiteSlide'
import { portGeo, roomMode, slideKey, slideKind } from './roomLayout'

/** A sample room book re-trimmed to 200 × 250 mm (page ratio 0.8). */
function roomBook(): RoomBook {
  const { book, images, entry } = bookInput()
  return {
    entry,
    images,
    book: {
      ...book,
      settings: { ...book.settings, trim: { widthMm: 200, heightMm: 250 } },
    },
  }
}

describe('roomMode', () => {
  it('is portrait below 768 px wide when taller than wide', () => {
    expect(roomMode(767, 768)).toBe('port')
    expect(roomMode(390, 391)).toBe('port')
    expect(roomMode(390, 390)).toBe('desk')
    expect(roomMode(768, 1024)).toBe('desk')
  })

  it('is landscape when wider than tall and under 500 px high', () => {
    expect(roomMode(844, 390)).toBe('land')
    expect(roomMode(1440, 499)).toBe('land')
    expect(roomMode(1440, 500)).toBe('desk')
    expect(roomMode(450, 450)).toBe('desk')
    expect(roomMode(1440, 900)).toBe('desk')
  })
})

describe('portGeo', () => {
  it('fits the page to the width on a tall phone and centres the rows', () => {
    expect(portGeo(roomBook(), 390, 844)).toStrictEqual({
      pw: 358,
      ph: 447.5,
      gt: 128.25,
      stageTop: 180.25,
      footTop: 635.75,
    })
  })

  it('fits the page to the height on a short screen', () => {
    const g = portGeo(roomBook(), 700, 500)
    expect(g.pw).toBeCloseTo(262.4, 9)
    expect(g.ph).toBeCloseTo(328, 9)
    expect(g.gt).toBeCloseTo(16, 9)
    expect(g.stageTop).toBeCloseTo(68, 9)
    expect(g.footTop).toBeCloseTo(404, 9)
  })
})

describe('slideKind', () => {
  const at = (page?: RoomSlide['page']): RoomSlide =>
    ({ spread: 0, page }) as RoomSlide

  it('tells the cover, a whole spread and one page apart', () => {
    expect(slideKind(at())).toBe('cover')
    expect(slideKind(at({ side: 'both' } as RoomSlide['page']))).toBe('spread')
    expect(slideKind(at({ side: 'left' } as RoomSlide['page']))).toBe('page')
    expect(slideKind(at({ side: 'right' } as RoomSlide['page']))).toBe('page')
  })
})

describe('slideKey', () => {
  const k = (key: string, init: KeyboardEventInit = {}, target?: unknown) => {
    const e = new KeyboardEvent('keydown', { key, ...init })
    if (target !== undefined)
      Object.defineProperty(e, 'target', { value: target })
    return slideKey(e)
  }

  it('ignores every modifier', () => {
    for (const m of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'])
      expect(k('ArrowLeft', { [m]: true })).toBeNull()
    expect(k('Home', { altKey: true })).toBeNull()
  })

  it('ignores keys typed into fields, not other targets', () => {
    for (const tag of ['input', 'textarea', 'select'])
      expect(k('End', {}, document.createElement(tag))).toBeNull()
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', '')
    expect(k('ArrowRight', {}, editable)).toBeNull()
    expect(k('ArrowRight', {}, document.createElement('div'))).toBe(1)
    expect(k('ArrowLeft', {}, null)).toBe(-1)
    expect(k('Home', {}, window)).toBe('home')
  })

  it('maps nothing else', () => {
    expect(k('Enter')).toBeNull()
    expect(k('toString')).toBeNull()
  })
})

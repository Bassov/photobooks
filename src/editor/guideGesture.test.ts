import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import { getBookStoreSnapshot, resetBookStore, undoBook } from './bookStore'
import { getEditorStatus, setEditorStatus } from './editorStatus'
import { startGuideDrag } from './guideGesture'
import { getGuidesVisible, setGuidesVisible } from './guidesView'

// Spread: one 300 mm page; 1 mm = 2 client px and 1.5 layout px.
const BOX = { left: 100, top: 50, width: 600, height: 600 }

function guidesOf() {
  return getBookStoreSnapshot().book.spreads[0]?.guides ?? []
}

function mount() {
  const spreadEl = document.createElement('div')
  spreadEl.dataset.spreadId = 's1'
  Object.defineProperty(spreadEl, 'offsetWidth', { value: 450 })
  spreadEl.getBoundingClientRect = () =>
    ({
      ...BOX,
      right: BOX.left + BOX.width,
      bottom: BOX.top + BOX.height,
      x: BOX.left,
      y: BOX.top,
    }) as DOMRect
  const rulerX = document.createElement('div')
  rulerX.getBoundingClientRect = () =>
    ({ top: 28, bottom: 50, left: 0, right: 2000 }) as DOMRect
  const rulerY = document.createElement('div')
  rulerY.getBoundingClientRect = () =>
    ({ top: 0, bottom: 2000, left: 78, right: 100 }) as DOMRect
  document.body.append(spreadEl)
  // The placed guide's line, used only by the tests that drag an existing guide.
  const lineEl = document.createElement('div')
  spreadEl.append(lineEl)
  return { spreadEl, rulerX, rulerY, lineEl }
}

let frames: FrameRequestCallback[] = []

function rawMove(x: number, y: number) {
  window.dispatchEvent(
    new MouseEvent('pointermove', { clientX: x, clientY: y }),
  )
}

function flush() {
  const pending = frames
  frames = []
  for (const frame of pending) frame(0)
}

/** Moves are applied in the next animation frame, once however many arrive. */
function move(x: number, y: number) {
  rawMove(x, y)
  flush()
}

function up(x: number, y: number) {
  window.dispatchEvent(new MouseEvent('pointerup', { clientX: x, clientY: y }))
}

const pointer = (x: number, y: number) =>
  new MouseEvent('pointerdown', { clientX: x, clientY: y }) as PointerEvent

describe('startGuideDrag', () => {
  beforeEach(() => {
    frames = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {
      frames = []
    })
    resetBookStore({
      book: makeBook({
        spreads: [
          makeSpread({
            id: 's1',
            guides: [{ id: 'g', orientation: 'vertical', offsetMm: 100 }],
          }),
        ],
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.replaceChildren()
    setGuidesVisible(true)
    setEditorStatus('')
    resetBookStore()
  })

  it('pulls a new horizontal guide from the ruler: a transform while dragging, one op on release', () => {
    const { spreadEl, rulerX } = mount()
    startGuideDrag({
      event: pointer(500, 40),
      spreadEl,
      orientation: 'horizontal',
      rulerEl: rulerX,
    })
    const line = spreadEl.querySelector<HTMLElement>('.guide-line')
    expect(line?.dataset.orientation).toBe('horizontal')
    move(500, 250)
    expect(line?.style.transform).toBe('translateY(150px)')
    expect(line?.querySelector('.guide-line-tag')?.textContent).toBe('100 mm')
    expect(line?.dataset.removing).toBe('false')
    expect(guidesOf()).toHaveLength(1)

    up(500, 250)
    expect(spreadEl.querySelector('.guide-line')).toBeNull()
    expect(guidesOf()).toHaveLength(2)
    expect(guidesOf()[1]).toMatchObject({
      orientation: 'horizontal',
      offsetMm: 100,
    })
  })

  it('shows the removal state over the ruler edge and abandons a new guide dropped there', () => {
    const { spreadEl, rulerX } = mount()
    startGuideDrag({
      event: pointer(500, 40),
      spreadEl,
      orientation: 'horizontal',
      rulerEl: rulerX,
    })
    const line = spreadEl.querySelector<HTMLElement>('.guide-line')
    expect(line?.dataset.removing).toBe('true')
    move(500, 300)
    expect(line?.dataset.removing).toBe('false')
    // The strip's bottom edge counts as on the ruler; one px below does not.
    move(500, 51)
    expect(line?.dataset.removing).toBe('false')
    move(500, 50)
    expect(line?.dataset.removing).toBe('true')
    up(500, 50)
    expect(guidesOf()).toHaveLength(1)
    expect(spreadEl.querySelector('.guide-line')).toBeNull()
  })

  it('abandons a new guide dropped far off the spread', () => {
    const { spreadEl, rulerY } = mount()
    startGuideDrag({
      event: pointer(90, 200),
      spreadEl,
      orientation: 'vertical',
      rulerEl: rulerY,
    })
    up(900, 200)
    expect(guidesOf()).toHaveLength(1)
  })

  it('moves a placed vertical guide and restores the line element', () => {
    const { spreadEl, rulerY, lineEl } = mount()
    startGuideDrag({
      event: pointer(300, 200),
      spreadEl,
      orientation: 'vertical',
      rulerEl: rulerY,
      existing: { id: 'g', lineEl, offsetMm: 100 },
    })
    expect(lineEl.dataset.dragging).toBe('true')
    move(500, 200)
    expect(lineEl.style.transform).toBe('translateX(150px)')
    up(500, 200)
    expect(guidesOf()).toEqual([
      { id: 'g', orientation: 'vertical', offsetMm: 200 },
    ])
    expect(lineEl.isConnected).toBe(true)
    expect(lineEl.style.transform).toBe('')
    expect(lineEl.dataset.dragging).toBeUndefined()
    expect(lineEl.dataset.removing).toBeUndefined()
    expect(lineEl.querySelector('.guide-line-tag')).toBeNull()
  })

  it('moves a placed guide without a ruler on screen', () => {
    const { spreadEl, lineEl } = mount()
    startGuideDrag({
      event: pointer(300, 200),
      spreadEl,
      orientation: 'vertical',
      rulerEl: null,
      existing: { id: 'g', lineEl, offsetMm: 100 },
    })
    up(500, 200)
    expect(guidesOf()[0]?.offsetMm).toBe(200)
  })

  it('removes a placed guide dropped on the ruler edge', () => {
    const { spreadEl, rulerY, lineEl } = mount()
    startGuideDrag({
      event: pointer(300, 200),
      spreadEl,
      orientation: 'vertical',
      rulerEl: rulerY,
      existing: { id: 'g', lineEl, offsetMm: 100 },
    })
    move(101, 200)
    expect(lineEl.dataset.removing).toBe('false')
    move(100, 200)
    expect(lineEl.dataset.removing).toBe('true')
    up(100, 200)
    expect(guidesOf()).toEqual([])
  })

  it('removes a placed guide dragged off the spread when no ruler is shown', () => {
    const { spreadEl, lineEl } = mount()
    startGuideDrag({
      event: pointer(300, 200),
      spreadEl,
      orientation: 'vertical',
      rulerEl: null,
      existing: { id: 'g', lineEl, offsetMm: 100 },
    })
    up(1500, 200)
    expect(guidesOf()).toEqual([])
  })

  it('applies many moves in one frame, with the latest pointer', () => {
    const { spreadEl, rulerY } = mount()
    startGuideDrag({
      event: pointer(90, 200),
      spreadEl,
      orientation: 'vertical',
      rulerEl: rulerY,
    })
    flush()
    rawMove(200, 200)
    rawMove(300, 200)
    expect(frames).toHaveLength(1)
    flush()
    const line = spreadEl.querySelector<HTMLElement>('.guide-line')
    expect(line?.style.transform).toBe('translateX(150px)')
    up(300, 200)
  })

  it('stops listening on release and cancels the pending frame', () => {
    const { spreadEl, rulerY } = mount()
    startGuideDrag({
      event: pointer(90, 200),
      spreadEl,
      orientation: 'vertical',
      rulerEl: rulerY,
    })
    flush()
    rawMove(300, 200)
    expect(frames).toHaveLength(1)
    up(300, 200)
    expect(frames).toHaveLength(0)
    rawMove(400, 200)
    expect(frames).toHaveLength(0)
  })

  it('shows hidden guides so the new one is visible', () => {
    setGuidesVisible(false)
    const { spreadEl, rulerY } = mount()
    startGuideDrag({
      event: pointer(90, 200),
      spreadEl,
      orientation: 'vertical',
      rulerEl: rulerY,
    })
    expect(getGuidesVisible()).toBe(true)
    up(90, 200)
  })

  describe('on a parent (Masters canvas)', () => {
    const parentGuides = () =>
      getBookStoreSnapshot().book.parents?.[0]?.guides ?? []

    beforeEach(() => {
      resetBookStore({
        book: makeBook({
          spreads: [makeSpread({ id: 's1' })],
          parents: [
            {
              id: 'pa',
              name: 'Master A',
              frames: [],
              guides: [{ id: 'g', orientation: 'vertical', offsetMm: 100 }],
            },
          ],
        }),
        sessionMeta: new Map(),
        importRunning: false,
        importExpectedCount: 0,
      })
    })

    // A parent is two 300 mm pages: 600 mm over the 600 px box, 1 mm = 1 client px.
    it('adds a ruler guide to the parent, sized as a two-page spread', () => {
      const { spreadEl, rulerX } = mount()
      spreadEl.dataset.spreadId = 'pa'
      startGuideDrag({
        event: pointer(500, 40),
        spreadEl,
        orientation: 'horizontal',
        rulerEl: rulerX,
      })
      move(500, 150)
      const line = spreadEl.querySelector<HTMLElement>('.guide-line')
      expect(line?.style.transform).toBe('translateY(75px)')
      up(500, 150)
      expect(parentGuides()).toEqual([
        { id: 'g', orientation: 'vertical', offsetMm: 100 },
        { id: 'guide-2', orientation: 'horizontal', offsetMm: 100 },
      ])
      expect(getBookStoreSnapshot().book.spreads[0]?.guides).toBeUndefined()
    })

    it('moves a parent guide as one undo step, and removes it on its ruler', () => {
      const { spreadEl, rulerY, lineEl } = mount()
      spreadEl.dataset.spreadId = 'pa'
      const drag = (x: number) => {
        startGuideDrag({
          event: pointer(200, 200),
          spreadEl,
          orientation: 'vertical',
          rulerEl: rulerY,
          existing: {
            id: 'g',
            lineEl,
            offsetMm: parentGuides()[0]?.offsetMm ?? 0,
          },
        })
        up(x, 200)
      }
      drag(400)
      expect(parentGuides()[0]?.offsetMm).toBe(300)
      undoBook()
      expect(parentGuides()[0]?.offsetMm).toBe(100)
      drag(100)
      expect(parentGuides()).toEqual([])
    })
  })

  it('does nothing for an unknown spread or a collapsed box', () => {
    const { spreadEl } = mount()
    spreadEl.dataset.spreadId = 'nope'
    startGuideDrag({
      event: pointer(0, 0),
      spreadEl,
      orientation: 'vertical',
      rulerEl: null,
    })
    expect(spreadEl.querySelector('.guide-line')).toBeNull()
    spreadEl.dataset.spreadId = 's1'
    spreadEl.getBoundingClientRect = () => ({ width: 0 }) as DOMRect
    startGuideDrag({
      event: pointer(0, 0),
      spreadEl,
      orientation: 'vertical',
      rulerEl: null,
    })
    expect(spreadEl.querySelector('.guide-line')).toBeNull()
  })

  function seedSpreads(ids: string[]) {
    resetBookStore({
      book: makeBook({
        spreads: ids.map((id) =>
          makeSpread({
            id,
            guides: [{ id: 'g', orientation: 'vertical', offsetMm: 100 }],
          }),
        ),
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
  }

  function drag(
    spreadEl: HTMLElement,
    rulerEl: HTMLElement,
    x: number,
    existing?: { id: string; lineEl: HTMLElement; offsetMm: number },
  ) {
    startGuideDrag({
      event: pointer(90, 300),
      spreadEl,
      orientation: 'vertical',
      rulerEl,
      ...(existing === undefined ? {} : { existing }),
    })
    move(x, 300)
    up(x, 300)
  }

  it('states a placed or moved guide with its page on a two-page spread', () => {
    // s1 is the middle spread: two 300 mm pages, 1 mm = 1 client px.
    seedSpreads(['s0', 's1', 's2'])
    const { spreadEl, rulerY, lineEl } = mount()
    drag(spreadEl, rulerY, 550)
    expect(getEditorStatus()).toBe('Vertical guide at 150 mm (right page)')
    drag(spreadEl, rulerY, 220, { id: 'g', lineEl, offsetMm: 100 })
    expect(
      getBookStoreSnapshot().book.spreads[1]?.guides?.map((g) => g.offsetMm),
    ).toEqual([120, 450])
    expect(getEditorStatus()).toBe('Vertical guide at 120 mm (left page)')
  })

  it('states a guide on a single page with its side and a horizontal one in mm', () => {
    // s1 is page 1 of the book: one 300 mm page on the right, 1 mm = 2 px.
    seedSpreads(['s1', 's2'])
    const { spreadEl, rulerX, rulerY } = mount()
    drag(spreadEl, rulerY, 184)
    expect(getEditorStatus()).toBe('Vertical guide at 42 mm (right page)')
    startGuideDrag({
      event: pointer(500, 40),
      spreadEl,
      orientation: 'horizontal',
      rulerEl: rulerX,
    })
    up(500, 250)
    expect(getEditorStatus()).toBe('Horizontal guide at 100 mm')
  })

  it('leaves the status alone when a guide is abandoned or removed', () => {
    const { spreadEl, rulerY, lineEl } = mount()
    setEditorStatus('Photo moved')
    drag(spreadEl, rulerY, 90)
    drag(spreadEl, rulerY, 90, { id: 'g', lineEl, offsetMm: 100 })
    expect(guidesOf()).toHaveLength(0)
    expect(getEditorStatus()).toBe('Photo moved')
  })
})

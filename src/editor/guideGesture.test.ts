import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  resetBookStore,
  undoBook,
} from './bookStore'
import { getEditorStatus, setEditorStatus } from './editorStatus'
import { startGuideDrag, startParentGuideOverride } from './guideGesture'
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

  it('pulls the new line beside the paper when it sits in a spread stage', () => {
    const { spreadEl, rulerX } = mount()
    const stage = document.createElement('div')
    stage.className = 'spread-stage'
    document.body.append(stage)
    stage.append(spreadEl)
    startGuideDrag({
      event: pointer(500, 40),
      spreadEl,
      orientation: 'horizontal',
      rulerEl: rulerX,
    })
    const line = stage.querySelector<HTMLElement>(':scope > .guide-line')
    expect(line?.dataset.testid).toBe('guide-line-new')
    expect(spreadEl.querySelector('.guide-line')).toBeNull()
    up(500, 250)
    expect(stage.querySelector('.guide-line')).toBeNull()
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

describe('startParentGuideOverride (Designer PO5)', () => {
  // s1 is a two-page 600 mm spread over the 600 px box: 1 mm = 1 client px.
  const spread = () => getBookStoreSnapshot().book.spreads[1]
  const copies = () => spread()?.parentOverrides?.guides ?? []

  function load(locked?: true) {
    resetBookStore({
      book: makeBook({
        spreads: ['s0', 's1', 's2'].map((id) => makeSpread({ id })),
        parents: [
          {
            id: 'pa',
            name: 'Master A',
            frames: [],
            guides: [
              {
                id: 'pg',
                orientation: 'horizontal',
                offsetMm: 100,
                ...(locked && { locked }),
              },
            ],
          },
        ],
        defaultParentId: 'pa',
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
  }

  /** The pasteboard stage: rulers, the spread and the copy's line the overlay renders. */
  function mountStage() {
    const parts = mount()
    const stage = document.createElement('div')
    stage.dataset.rulers = 'true'
    const spreadStage = document.createElement('div')
    spreadStage.className = 'spread-stage'
    parts.rulerX.dataset.testid = 'ruler-x'
    const other = document.createElement('div')
    other.dataset.testid = 'guide-line'
    other.dataset.guideId = 'guide-1'
    parts.lineEl.dataset.testid = 'guide-line'
    parts.lineEl.dataset.guideId = 'copy-1'
    spreadStage.append(parts.spreadEl, other, parts.lineEl)
    stage.append(parts.rulerX, spreadStage)
    document.body.append(stage)
    return { ...parts, other }
  }

  beforeEach(() => {
    frames = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {
      frames = []
    })
    load()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.replaceChildren()
    resetBookStore()
  })

  it('overrides the parent guide and drags its copy: two undo steps, the parent untouched', () => {
    const { spreadEl, lineEl, other } = mountStage()
    expect(startParentGuideOverride(pointer(300, 150), spreadEl, 'pg')).toBe(
      true,
    )
    const copy = {
      id: 'copy-1',
      orientation: 'horizontal',
      offsetMm: 100,
      overridesId: 'pg',
    }
    expect(copies()).toEqual([copy])
    expect(lineEl.dataset.dragging).toBe('true')
    expect(other.dataset.dragging).toBeUndefined()
    move(300, 190)
    up(300, 190)
    expect(copies()).toEqual([{ ...copy, offsetMm: 140 }])
    expect(getBookStoreSnapshot().book.parents?.[0]?.guides).toEqual([
      { id: 'pg', orientation: 'horizontal', offsetMm: 100 },
    ])
    undoBook()
    expect(copies()).toEqual([copy])
    undoBook()
    expect(copies()).toEqual([])
  })

  it('hides the parent guide when the copy is dropped on its ruler', () => {
    const { spreadEl } = mountStage()
    startParentGuideOverride(pointer(300, 150), spreadEl, 'pg')
    move(300, 40)
    up(300, 40)
    expect(copies()).toEqual([])
    expect(spread()?.parentOverrides?.hiddenIds).toEqual(['pg'])
    undoBook()
    expect(copies()).toHaveLength(1)
  })

  it('a locked parent guide only overrides', () => {
    load(true)
    const { spreadEl, lineEl } = mountStage()
    expect(startParentGuideOverride(pointer(300, 150), spreadEl, 'pg')).toBe(
      true,
    )
    expect(copies()).toHaveLength(1)
    expect(lineEl.dataset.dragging).toBeUndefined()
  })

  it('an unknown or hidden guide, or an unknown spread, is not consumed', () => {
    const { spreadEl } = mountStage()
    const press = () =>
      startParentGuideOverride(pointer(300, 150), spreadEl, 'pg')
    expect(startParentGuideOverride(pointer(300, 150), spreadEl, 'nope')).toBe(
      false,
    )
    dispatchBookOp({
      type: 'hideParentItem',
      spreadId: 's1',
      parentItemId: 'pg',
    })
    const hidden = getBookStoreSnapshot().book
    expect(press()).toBe(false)
    spreadEl.dataset.spreadId = 'gone'
    expect(press()).toBe(false)
    expect(getBookStoreSnapshot().book).toBe(hidden)
  })

  it('an own guide dropped on its ruler is removed, never a parent guide', () => {
    const { spreadEl, rulerY, lineEl } = mountStage()
    const dropOwn = () => {
      startGuideDrag({
        event: pointer(400, 200),
        spreadEl,
        orientation: 'vertical',
        rulerEl: rulerY,
        existing: { id: 'own', lineEl, offsetMm: 300 },
      })
      up(90, 200)
    }
    const add = () => {
      dispatchBookOp({
        type: 'addGuide',
        spreadId: 's1',
        orientation: 'vertical',
        offsetMm: 300,
        id: 'own',
      })
    }
    add()
    // Hidden only: no copies on the spread.
    dispatchBookOp({
      type: 'hideParentItem',
      spreadId: 's1',
      parentItemId: 'pg',
    })
    dropOwn()
    expect(spread()?.guides).toEqual([])
    expect(spread()?.parentOverrides).toEqual({ hiddenIds: ['pg'] })
    // Beside a copy.
    dispatchBookOp({
      type: 'resetParentItem',
      spreadId: 's1',
      parentItemId: 'pg',
    })
    dispatchBookOp({
      type: 'overrideParentGuide',
      spreadId: 's1',
      parentGuideId: 'pg',
    })
    add()
    dropOwn()
    expect(spread()?.guides).toEqual([])
    expect(copies()).toHaveLength(1)
  })
})

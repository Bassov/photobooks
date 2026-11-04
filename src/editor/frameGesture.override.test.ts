import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import {
  getBookStoreSnapshot,
  getHistorySnapshot,
  resetBookStore,
  undoBook,
} from './bookStore'
import {
  getEditorStatus,
  parentItemStatus,
  setEditorStatus,
} from './editorStatus'
import { resetEditorToolForTests, setEditorTool } from './editorToolStore'
import { getFrameSource, resetFrameSelection } from './frameSelection'
import { installFrameGesture } from './frameGesture'
import { setGuidesVisible } from './guidesView'

/** 300 × 300 mm spread laid out at 2 client px per mm, offset on the page. */
const SIZE_MM = 300
const SCALE = 2
const ORIGIN = { x: 40, y: 30 }

const LOGO = { x: 20, y: 4, width: 24, height: 8 }

/** Spread on Master A (logo + a vertical guide at 200 mm); own frame `own` covers the logo. */
function load(locked = false) {
  resetBookStore({
    book: makeBook({
      parents: [
        {
          id: 'p1',
          name: 'Master A',
          frames: [
            makeFrame({
              id: 'logo',
              rect: LOGO,
              z: 1,
              assetId: 'a1',
              ...(locked ? { locked } : {}),
            }),
          ],
          guides: [{ id: 'pg', orientation: 'vertical', offsetMm: 200 }],
        },
      ],
      spreads: [
        makeSpread({
          parentId: 'p1',
          frames: [
            makeFrame({
              id: 'own',
              rect: { x: 0, y: 0, width: 260, height: 60 },
            }),
          ],
        }),
      ],
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

function spreadNow() {
  const spread = getBookStoreSnapshot().book.spreads[0]
  if (spread === undefined) throw new Error('expected a spread')
  return spread
}

function copies() {
  return spreadNow().parentOverrides?.frames ?? []
}

function mount() {
  const spread = document.createElement('div')
  spread.setAttribute('data-testid', 'spread-view')
  spread.setAttribute('data-spread-id', spreadNow().id)
  spread.getBoundingClientRect = () =>
    ({
      left: ORIGIN.x,
      top: ORIGIN.y,
      width: SIZE_MM * SCALE,
      height: SIZE_MM * SCALE,
    }) as DOMRect
  const own = document.createElement('button')
  own.className = 'spread-frame'
  own.setAttribute('data-frame-id', 'own')
  own.setAttribute('data-filled', 'false')
  spread.append(own)
  document.body.append(spread)
  return { spread, own }
}

/** Pointer event at a spread position given in mm. */
function pointer(
  type: string,
  target: Element | Window,
  xMm: number,
  yMm: number,
  init: MouseEventInit = {},
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: ORIGIN.x + xMm * SCALE,
    clientY: ORIGIN.y + yMm * SCALE,
    ...init,
  })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  target.dispatchEvent(event)
  return event
}

const CTRL_SHIFT = { ctrlKey: true, shiftKey: true }

describe('frameGesture · parent item override (PO2)', () => {
  let stop: () => void
  let spread: HTMLElement
  let own: HTMLElement

  beforeEach(() => {
    load()
    ;({ spread, own } = mount())
    stop = installFrameGesture()
  })

  afterEach(() => {
    stop()
    spread.remove()
    resetEditorToolForTests()
    resetFrameSelection()
    resetBookStore()
    setGuidesVisible(true)
    setEditorStatus('')
  })

  it('Ctrl+Shift press through an own frame overrides the logo and selects the copy; its click is swallowed', () => {
    const down = pointer('pointerdown', own, 30, 8, CTRL_SHIFT)
    pointer('pointerup', window, 30, 8, CTRL_SHIFT)
    const click = pointer('click', own, 30, 8, CTRL_SHIFT)

    expect(down.defaultPrevented).toBe(true)
    expect(click.defaultPrevented).toBe(true)
    expect(copies()).toEqual([
      expect.objectContaining({
        id: 'copy-1',
        overridesId: 'logo',
        rect: LOGO,
      }),
    ])
    expect(spreadNow().frames.map((frame) => frame.id)).toEqual(['own'])
    expect(getFrameSource()).toEqual({
      spreadId: spreadNow().id,
      frameId: 'copy-1',
    })
    expect(getHistorySnapshot().undoLabel).toBe('Override parent item')
  })

  it('a drag past the slop moves the copy as its own undo step', () => {
    pointer('pointerdown', own, 30, 8, { metaKey: true, shiftKey: true })
    // React paints the copy before the first move.
    const copyButton = document.createElement('button')
    copyButton.className = 'spread-frame'
    copyButton.setAttribute('data-frame-id', 'copy-1')
    copyButton.style.left = '1%'
    spread.append(copyButton)
    // Alt bypasses the snap, as for any move.
    pointer('pointermove', window, 37.5, 8, { altKey: true })
    expect(copyButton.style.left).toBe(`${String((27.5 / SIZE_MM) * 100)}%`)
    pointer('pointermove', window, 45, 8, { altKey: true })
    pointer('pointerup', window, 45, 8, { altKey: true })

    expect(copyButton.style.left).toBe('1%')
    expect(copies()[0]?.rect).toEqual({ ...LOGO, x: 35 })
    expect(getFrameSource()?.frameId).toBe('copy-1')

    undoBook()
    expect(copies()[0]?.rect).toEqual(LOGO)
    undoBook()
    expect(spreadNow().parentOverrides).toBeUndefined()
  })

  it('needs Shift with Ctrl or ⌘ and a parent frame under the press', () => {
    for (const init of [
      { altKey: true },
      { ctrlKey: true },
      { shiftKey: true },
      { altKey: true, shiftKey: true },
    ]) {
      pointer('pointerdown', own, 30, 8, init)
      pointer('pointerup', window, 30, 8, init)
    }
    // Outside the logo, and on a parent guide (PO5 keeps today's press).
    pointer('pointerdown', own, 100, 30, CTRL_SHIFT)
    pointer('pointerup', window, 100, 30, CTRL_SHIFT)
    pointer('pointerdown', own, 201, 8, CTRL_SHIFT)
    pointer('pointerup', window, 201, 8, CTRL_SHIFT)

    expect(spreadNow().parentOverrides).toBeUndefined()
  })

  it('ignores Ctrl+Shift on a spread that is not laid out yet', () => {
    spread.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 0, height: 0 }) as DOMRect

    pointer('pointerdown', own, 30, 8, CTRL_SHIFT)
    pointer('pointerup', window, 30, 8, CTRL_SHIFT)

    expect(spreadNow().parentOverrides).toBeUndefined()
    expect(getFrameSource()).toBeNull()
  })

  it('a locked parent item overrides into a locked copy that the drag leaves in place', () => {
    load(true)
    pointer('pointerdown', own, 30, 8, CTRL_SHIFT)
    pointer('pointermove', window, 45, 8)
    pointer('pointerup', window, 45, 8)

    expect(copies()).toEqual([
      expect.objectContaining({ id: 'copy-1', locked: true, rect: LOGO }),
    ])
    expect(getFrameSource()?.frameId).toBe('copy-1')
    expect(getHistorySnapshot().undoLabel).toBe('Override parent item')
  })

  it('Escape mid-drag puts the copy back where the press made it', () => {
    pointer('pointerdown', own, 30, 8, CTRL_SHIFT)
    pointer('pointermove', window, 40, 8)
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    pointer('pointerup', window, 40, 8)

    expect(copies()[0]?.rect).toEqual(LOGO)
  })

  it('a plain press on an uncovered parent item keeps the paper press and announces the shortcut', async () => {
    own.remove()
    pointer('pointerdown', spread, 30, 8)
    pointer('pointerup', window, 30, 8)
    expect(getEditorStatus()).toBe('')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(getEditorStatus()).toBe(parentItemStatus('Master A', false))
    expect(spreadNow().parentOverrides).toBeUndefined()
    expect(getFrameSource()).toBeNull()

    setEditorStatus('')
    pointer('pointerdown', spread, 100, 100)
    pointer('pointerup', window, 100, 100)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(getEditorStatus()).toBe('')
  })

  it('leaves the Frame tool alone', () => {
    setEditorTool('frame')
    pointer('pointerdown', own, 30, 8, CTRL_SHIFT)
    pointer('pointerup', window, 30, 8, CTRL_SHIFT)

    expect(spreadNow().parentOverrides).toBeUndefined()
  })
})

describe('parentItemStatus', () => {
  it('names the parent and the platform keys', () => {
    expect(parentItemStatus('Master A', false)).toBe(
      'Parent item from “Master A”. Ctrl+Shift+click to override it on this spread.',
    )
    expect(parentItemStatus('Master B', true)).toBe(
      'Parent item from “Master B”. ⌘⇧-click to override it on this spread.',
    )
  })
})

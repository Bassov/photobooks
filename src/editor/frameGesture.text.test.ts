import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import type { Frame } from '../core'
import {
  getBookStoreSnapshot,
  getHistorySnapshot,
  resetBookStore,
} from './bookStore'
import {
  getEditorTool,
  resetEditorToolForTests,
  setEditorTool,
} from './editorToolStore'
import { getFrameSource, resetFrameSelection } from './frameSelection'
import {
  installFrameGesture,
  textClickRect,
  textDragRect,
} from './frameGesture'
import {
  cancelTextEdit,
  getTextEdit,
  resetTextEditForTests,
} from './textEditStore'

const SIZE_MM = 300
const SCALE = 2
const ORIGIN = { x: 40, y: 30 }

const rect = (x: number, y: number, width: number, height: number) => ({
  x,
  y,
  width,
  height,
})

const photo = makeFrame({ id: 'a', rect: rect(100, 100, 80, 60) })
const label: Frame = {
  id: 't',
  rect: rect(20, 200, 60, 14),
  z: 2,
  kind: 'text',
  content: { type: 'static', text: 'Hi' },
}

function load(frames: Frame[] = [photo, label]) {
  resetBookStore({
    book: makeBook({ spreads: [makeSpread({ frames })] }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

const frames = () => getBookStoreSnapshot().book.spreads[0]?.frames ?? []

function mount(): HTMLElement {
  const spread = document.createElement('div')
  spread.setAttribute('data-testid', 'spread-view')
  spread.setAttribute('data-spread-id', 'spread-1')
  spread.getBoundingClientRect = () =>
    ({
      left: ORIGIN.x,
      top: ORIGIN.y,
      width: SIZE_MM * SCALE,
      height: SIZE_MM * SCALE,
    }) as DOMRect
  for (const frame of frames()) {
    const button = document.createElement('button')
    button.className = 'spread-frame'
    button.setAttribute('data-frame-id', frame.id)
    if (frame.kind === 'text') {
      button.setAttribute('data-kind', 'text')
    } else {
      button.setAttribute('data-filled', 'true')
    }
    spread.append(button)
  }
  document.body.append(spread)
  return spread
}

function pointer(
  type: string,
  target: Element | Window,
  xMm: number,
  yMm: number,
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: ORIGIN.x + xMm * SCALE,
    clientY: ORIGIN.y + yMm * SCALE,
  })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  target.dispatchEvent(event)
  return event
}

const button = (spread: HTMLElement, id: string) => {
  const found = spread.querySelector(`[data-frame-id="${id}"]`)
  if (!(found instanceof HTMLElement)) {
    throw new Error(`no frame ${id}`)
  }
  return found
}

describe('textClickRect', () => {
  const spread = { widthMm: 400, heightMm: 300, pageCount: 2 }

  it('puts the 60 × 14 mm box at the point', () => {
    expect(textClickRect({ x: 30, y: 40 }, spread)).toEqual(
      rect(30, 40, 60, 14),
    )
  })

  it('clamps into the clicked page safe area (6 mm)', () => {
    // Left page ends at 200: the box stops 6 mm before it.
    expect(textClickRect({ x: 190, y: 295 }, spread)).toEqual(
      rect(134, 280, 60, 14),
    )
    expect(textClickRect({ x: 201, y: 1 }, spread)).toEqual(
      rect(206, 6, 60, 14),
    )
    // The far right edge still belongs to the last page.
    expect(textClickRect({ x: 400, y: 40 }, spread)).toEqual(
      rect(334, 40, 60, 14),
    )
  })

  it('never grows wider than the page allows', () => {
    expect(
      textClickRect(
        { x: 0, y: 0 },
        { widthMm: 50, heightMm: 20, pageCount: 1 },
      ),
    ).toEqual(rect(6, 6, 38, 8))
  })
})

describe('textDragRect', () => {
  it('keeps a large draft and grows a small one to 10 × 4.5 mm', () => {
    const spread = { widthMm: 300, heightMm: 300 }
    expect(textDragRect(rect(10, 20, 80, 30), spread)).toEqual(
      rect(10, 20, 80, 30),
    )
    expect(textDragRect(rect(296, 298, 2, 1), spread)).toEqual(
      rect(290, 295.5, 10, 4.5),
    )
  })
})

describe('frameGesture · Text tool', () => {
  let stop: () => void
  let spread: HTMLElement

  beforeEach(() => {
    load()
    spread = mount()
    stop = installFrameGesture()
    setEditorTool('text')
  })

  afterEach(() => {
    stop()
    spread.remove()
    resetEditorToolForTests()
    resetFrameSelection()
    resetTextEditForTests()
    resetBookStore()
  })

  it('a click makes an empty caption frame, selects it, edits it, back to Select', () => {
    pointer('pointerdown', spread, 30, 40)
    pointer('pointerup', window, 30, 40)
    const created = frames()[2]
    expect(created).toMatchObject({
      kind: 'text',
      styleId: 'caption',
      align: 'left',
      content: { type: 'static', text: '' },
      rect: rect(30, 40, 60, 14),
    })
    expect(getFrameSource()).toEqual({
      spreadId: 'spread-1',
      frameId: created?.id,
    })
    expect(getTextEdit()).toMatchObject({
      frameId: created?.id,
      addKey: expect.stringMatching(/^add:/),
    })
    expect(getEditorTool()).toBe('select')
    expect(getHistorySnapshot().undoLabel).toBe('Add text')
  })

  it('a drag past 3 px draws the draft rect', () => {
    pointer('pointerdown', spread, 10, 10)
    pointer('pointermove', window, 10.5, 10.5)
    expect(spread.querySelector('[data-testid="frame-draft"]')).not.toBeNull()
    pointer('pointermove', window, 90, 30)
    pointer('pointerup', window, 90, 30)
    expect(frames()[2]?.rect).toEqual(rect(10, 10, 80, 20))
  })

  it('starts over a photo frame and swallows the click on it', () => {
    pointer('pointerdown', button(spread, 'a'), 120, 120)
    pointer('pointerup', window, 120, 120)
    expect(frames()).toHaveLength(3)
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    button(spread, 'a').dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
  })

  it('Esc during the drag cancels', () => {
    pointer('pointerdown', spread, 10, 10)
    pointer('pointermove', window, 60, 30)
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    pointer('pointerup', window, 60, 30)
    expect(frames()).toHaveLength(2)
    expect(spread.querySelector('[data-testid="frame-draft"]')).toBeNull()
  })

  it('a move under 3 px stays a click; 3 px draws the 10 × 4.5 mm minimum', () => {
    pointer('pointerdown', spread, 200, 20)
    pointer('pointermove', window, 201, 20)
    pointer('pointerup', window, 201, 20)
    expect(frames()[2]?.rect).toMatchObject({ width: 60, height: 14 })

    setEditorTool('text')
    pointer('pointerdown', spread, 200, 120)
    pointer('pointermove', window, 201.5, 120)
    pointer('pointerup', window, 201.5, 120)
    // (The first frame, left empty, went away when this edit started.)
    expect(frames().at(-1)?.rect).toMatchObject({ width: 10, height: 4.5 })
  })

  it('a draw dragged back near its start keeps following the pointer', () => {
    pointer('pointerdown', spread, 200, 20)
    pointer('pointermove', window, 260, 60)
    pointer('pointermove', window, 200.5, 20)
    pointer('pointerup', window, 200.5, 20)
    expect(frames()[2]?.rect).toMatchObject({ width: 10, height: 4.5 })
  })

  it('a Text press blocks native drags', () => {
    pointer('pointerdown', button(spread, 'a'), 120, 120)
    const drag = new Event('dragstart', { bubbles: true, cancelable: true })
    button(spread, 'a').dispatchEvent(drag)
    expect(drag.defaultPrevented).toBe(true)
    pointer('pointerup', window, 120, 120)
  })

  it('a press on a text frame selects it and edits it on release', () => {
    const press = pointer('pointerdown', button(spread, 't'), 30, 205)
    expect(press.defaultPrevented).toBe(true)
    expect(getFrameSource()).toEqual({ spreadId: 'spread-1', frameId: 't' })
    expect(getTextEdit()).toBeNull()
    pointer('pointerup', window, 30, 205)
    expect(getTextEdit()).toMatchObject({ frameId: 't', addKey: undefined })
    expect(frames()).toHaveLength(2)
    expect(getEditorTool()).toBe('select')
    // The release click must not land on the frame button.
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    button(spread, 't').dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    // One release, one edit.
    cancelTextEdit()
    pointer('pointerup', window, 30, 205)
    expect(getTextEdit()).toBeNull()
  })

  it('Select moves a text frame by its body', () => {
    setEditorTool('select')
    pointer('pointerdown', button(spread, 't'), 30, 205)
    pointer('pointermove', window, 40, 215)
    pointer('pointerup', window, 40, 215)
    expect(frames()[1]?.rect).toEqual(rect(30, 210, 60, 14))
  })
})

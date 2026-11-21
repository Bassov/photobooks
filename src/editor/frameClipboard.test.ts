import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FRAMES_PAYLOAD_TYPE,
  findBookFrame,
  framesPayload,
  type Frame,
} from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  getHistorySnapshot,
  resetBookStore,
  undoBook,
} from './bookStore'
import { setCoverSelected } from './coverSelection'
import { enterCropMode, exitCropMode, getCropTarget } from './cropMode'
import {
  STATUS_FRAME_LOCKED,
  getEditorStatus,
  setEditorStatus,
} from './editorStatus'
import { setEndpaperSelected } from './endpaperSelection'
import {
  copySelectedFrames,
  cutSelectedFrames,
  duplicateSelectedFrames,
  frameClipboardMirror,
  installFrameClipboard,
  pasteFrames,
  resetFrameClipboard,
} from './frameClipboard'
import {
  getFrameSelection,
  resetFrameSelection,
  setFrameSelection,
} from './frameSelection'
import { resetLeftPanelTabForTests, setLeftPanelTab } from './leftPanelTabStore'
import {
  getActiveSpreadId,
  resetActiveSpreadIdForTests,
  setActiveSpreadId,
} from './photoRootSession'

const rect = (x: number, y: number) => ({ x, y, width: 100, height: 100 })

/** Page 1, a two-page spread `mid` (a, b locked, c) and the last page. */
function load(extra: Partial<Parameters<typeof makeBook>[0]> = {}): void {
  resetBookStore({
    book: makeBook({
      spreads: [
        makeSpread({ id: 'p1', frames: [] }),
        makeSpread({
          id: 'mid',
          frames: [
            makeFrame({ id: 'a', rect: rect(20, 20), z: 1 }),
            makeFrame({ id: 'b', rect: rect(320, 20), z: 2, locked: true }),
            makeFrame({ id: 'c', rect: rect(150, 150), z: 3 }),
          ],
        }),
        makeSpread({ id: 'last', frames: [] }),
      ],
      ...extra,
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

const book = () => getBookStoreSnapshot().book
const frameOn = (spreadId: string, id: string): Frame | undefined =>
  findBookFrame(book(), spreadId, id)
const idsOn = (spreadId: string) =>
  book()
    .spreads.find((s) => s.id === spreadId)
    ?.frames.map((f) => f.id)
/** The rect of the (first) selected frame on `mid`: the new copy. */
const newRect = () =>
  frameOn('mid', getFrameSelection()?.frameIds[0] ?? '')?.rect
const select = (...frameIds: string[]) => {
  setFrameSelection({ spreadId: 'mid', frameIds })
}

/** A clipboard event (jsdom has no DataTransfer on it). */
function clip(
  type: 'copy' | 'cut' | 'paste',
  data: Record<string, string> = {},
  target: EventTarget = document.body,
) {
  const store = new Map(Object.entries(data))
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: {
      getData: (t: string) => store.get(t) ?? '',
      setData: (t: string, v: string) => store.set(t, v),
      get types() {
        return [...store.keys()]
      },
    },
  })
  target.dispatchEvent(event)
  return { prevented: event.defaultPrevented, store }
}

function key(init: KeyboardEventInit, target: EventTarget = document.body) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    ...init,
  })
  target.dispatchEvent(event)
  return event.defaultPrevented
}

function inside(html: string): HTMLElement {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  const el = host.querySelector('[data-t]')
  if (!(el instanceof HTMLElement)) {
    throw new Error('no target')
  }
  return el
}

let stop: () => void = () => undefined

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0)
  load()
  stop = installFrameClipboard()
})

afterEach(() => {
  stop()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
  resetFrameClipboard()
  resetFrameSelection()
  exitCropMode()
  setCoverSelected(false)
  setEndpaperSelected(null)
  resetLeftPanelTabForTests()
  resetActiveSpreadIdForTests()
  setEditorStatus('')
  resetBookStore()
})

describe('copy', () => {
  it('writes the payload, keeps the mirror and flashes the status for 2 s', () => {
    vi.useFakeTimers()
    select('c', 'a')
    const { prevented, store } = clip('copy')
    expect(prevented).toBe(true)
    const payload = framesPayload(book(), 'mid', ['a', 'c'])
    expect(JSON.parse(store.get(FRAMES_PAYLOAD_TYPE) ?? '')).toStrictEqual(
      payload,
    )
    expect([...store.keys()]).toStrictEqual([FRAMES_PAYLOAD_TYPE])
    expect(frameClipboardMirror()).toStrictEqual(payload)
    expect(getEditorStatus()).toBe('Copied 2 frames')
    vi.advanceTimersByTime(1999)
    expect(getEditorStatus()).toBe('Copied 2 frames')
    vi.advanceTimersByTime(1)
    expect(getEditorStatus()).toBe('')
  })

  it('says Copied frame and leaves a newer status alone', () => {
    vi.useFakeTimers()
    select('a')
    clip('copy')
    expect(getEditorStatus()).toBe('Copied frame')
    vi.advanceTimersByTime(1000)
    clip('copy')
    vi.advanceTimersByTime(1500)
    expect(getEditorStatus()).toBe('Copied frame')
    setEditorStatus('Photo moved')
    vi.advanceTimersByTime(1000)
    expect(getEditorStatus()).toBe('Photo moved')
  })

  it('is native with no selection or outside the canvas', () => {
    expect(clip('copy').prevented).toBe(false)
    select('a')
    for (const html of [
      '<input data-t>',
      '<textarea data-t></textarea>',
      '<div contenteditable="true"><span data-t></span></div>',
      '<div data-testid="spreads-panel"><button data-t></button></div>',
      '<div data-testid="dock"><button data-t></button></div>',
      '<div role="dialog"><button data-t></button></div>',
    ]) {
      const { prevented, store } = clip('copy', {}, inside(html))
      expect(prevented).toBe(false)
      expect(store.size).toBe(0)
    }
    expect(getEditorStatus()).toBe('')
    expect(frameClipboardMirror()).toBeNull()
  })

  it('does nothing in Site preview, Masters, on the cover or an endpaper', () => {
    select('a')
    const preview = inside('<div data-testid="site-preview" data-t></div>')
    expect(clip('copy').prevented).toBe(false)
    preview.remove()
    setLeftPanelTab('masters')
    expect(clip('copy').prevented).toBe(false)
    resetLeftPanelTabForTests()
    setEndpaperSelected('front')
    expect(copySelectedFrames()).toBeNull()
    setEndpaperSelected(null)
    select('a')
    setCoverSelected(true)
    expect(copySelectedFrames()).toBeNull()
  })

  it('copies the cropped frame in crop mode', () => {
    load({
      assets: { x: {} },
      gallery: ['x'],
      spreads: [
        makeSpread({
          id: 'mid',
          frames: [
            makeFrame({
              id: 'a',
              assetId: 'x',
              crop: { zoom: 1, center: { x: 0.5, y: 0.5 } },
            }),
          ],
        }),
      ],
    })
    enterCropMode('mid', 'a')
    expect(getFrameSelection()).toBeNull()
    expect(copySelectedFrames()?.frames.map((f) => f.id)).toStrictEqual(['a'])
  })
})

describe('cut', () => {
  it('removes the unlocked frames in one step and keeps the locked selected', () => {
    select('a', 'b')
    const { prevented, store } = clip('cut')
    expect(prevented).toBe(true)
    expect(idsOn('mid')).toStrictEqual(['b', 'c'])
    expect(getFrameSelection()).toStrictEqual({
      spreadId: 'mid',
      frameIds: ['b'],
    })
    expect(store.has(FRAMES_PAYLOAD_TYPE)).toBe(true)
    expect(frameClipboardMirror()?.frames.map((f) => f.id)).toStrictEqual(['a'])
    expect(getHistorySnapshot().undoLabel).toBe('Cut frame')
    expect(getEditorStatus()).toBe('')
    undoBook()
    expect(idsOn('mid')).toStrictEqual(['a', 'b', 'c'])
  })

  it('counts the frames it cuts', () => {
    select('a', 'c')
    cutSelectedFrames()
    expect(getHistorySnapshot().undoLabel).toBe('Cut 2 frames')
    expect(getFrameSelection()).toBeNull()
  })

  it('cuts nothing without a selection', () => {
    expect(cutSelectedFrames()).toBeNull()
    expect(idsOn('mid')).toStrictEqual(['a', 'b', 'c'])
    expect(getHistorySnapshot().undoLabel).toBeNull()
    expect(frameClipboardMirror()).toBeNull()
  })

  it('cuts nothing when every frame is locked', () => {
    select('b')
    const { prevented, store } = clip('cut')
    expect(prevented).toBe(true)
    expect(store.size).toBe(0)
    expect(idsOn('mid')).toStrictEqual(['a', 'b', 'c'])
    expect(getEditorStatus()).toBe(STATUS_FRAME_LOCKED)
    expect(frameClipboardMirror()).toBeNull()
  })
})

describe('paste', () => {
  it('pastes +5/+5 mm as the selection on the selection spread, one step', () => {
    select('a')
    const { store } = clip('copy')
    const data = Object.fromEntries(store)
    const { prevented } = clip('paste', data)
    expect(prevented).toBe(true)
    const [pasted] = idsOn('mid')?.slice(3) ?? []
    expect(idsOn('mid')).toHaveLength(4)
    expect(getFrameSelection()).toStrictEqual({
      spreadId: 'mid',
      frameIds: [pasted],
    })
    expect(newRect()).toStrictEqual(rect(25, 25))
    expect(getActiveSpreadId()).toBe('mid')
    expect(getHistorySnapshot().undoLabel).toBe('Paste frame')
    clip('paste', data)
    expect(newRect()).toStrictEqual(rect(30, 30))
    undoBook()
    expect(idsOn('mid')).toStrictEqual(['a', 'b', 'c', pasted])
  })

  it('pastes on the active spread with no selection and ends crop mode', () => {
    select('a', 'c')
    const payload = copySelectedFrames()
    expect(payload).not.toBeNull()
    resetFrameSelection()
    setActiveSpreadId('last')
    const data = { [FRAMES_PAYLOAD_TYPE]: JSON.stringify(payload) }
    clip('paste', data)
    expect(idsOn('last')).toStrictEqual(['frame-1', 'frame-2'])
    expect(getHistorySnapshot().undoLabel).toBe('Paste 2 frames')
    expect(getFrameSelection()?.frameIds).toStrictEqual(['frame-1', 'frame-2'])
  })

  it('ends crop mode on the target', () => {
    load({
      assets: { x: {} },
      gallery: ['x'],
      spreads: [
        makeSpread({
          id: 'mid',
          frames: [
            makeFrame({
              id: 'a',
              assetId: 'x',
              crop: { zoom: 1, center: { x: 0.5, y: 0.5 } },
            }),
          ],
        }),
      ],
    })
    enterCropMode('mid', 'a')
    expect(duplicateSelectedFrames()).toBe(true)
    expect(getCropTarget()).toBeNull()
    expect(getFrameSelection()?.frameIds).toStrictEqual(idsOn('mid')?.slice(1))
  })

  it('pastes nothing for text, a bad payload or nowhere to go', () => {
    select('a')
    expect(clip('paste', { 'text/plain': 'hello' }).prevented).toBe(false)
    expect(clip('paste', { [FRAMES_PAYLOAD_TYPE]: '{"v":2}' }).prevented).toBe(
      false,
    )
    expect(idsOn('mid')).toStrictEqual(['a', 'b', 'c'])
    const payload = framesPayload(book(), 'mid', ['a'])
    resetFrameSelection()
    expect(pasteFrames(payload, { inPlace: false })).toBe(false)
    setActiveSpreadId('gone')
    expect(pasteFrames(payload, { inPlace: false })).toBe(false)
    setActiveSpreadId('mid')
    setLeftPanelTab('masters')
    expect(pasteFrames(payload, { inPlace: false })).toBe(false)
    resetLeftPanelTabForTests()
    expect(pasteFrames({ ...payload, frames: [] }, { inPlace: false })).toBe(
      false,
    )
    expect(idsOn('mid')).toStrictEqual(['a', 'b', 'c'])
  })

  it('keeps native paste in a field', () => {
    select('a')
    const data = { [FRAMES_PAYLOAD_TYPE]: JSON.stringify(copySelectedFrames()) }
    expect(clip('paste', data, inside('<input data-t>')).prevented).toBe(false)
    expect(idsOn('mid')).toStrictEqual(['a', 'b', 'c'])
  })

  it('Ctrl+Shift+V pastes in place from the event, else from the mirror', () => {
    select('a')
    const { store } = clip('copy')
    expect(key({ key: 'V', shiftKey: true })).toBe(false)
    clip('paste', Object.fromEntries(store))
    expect(newRect()).toStrictEqual(rect(20, 20))
    // Chromium's paste-and-match-style event has no frames type
    key({ key: 'v', shiftKey: true })
    clip('paste')
    expect(idsOn('mid')).toHaveLength(5)
    expect(newRect()).toStrictEqual(rect(20, 20))
    // with text on it the last copy elsewhere wins: nothing
    key({ key: 'v', shiftKey: true })
    clip('paste', { 'text/plain': 'x' })
    expect(idsOn('mid')).toHaveLength(5)
    // a plain Ctrl+V does not use the mirror and resets in place
    key({ key: 'v', shiftKey: true })
    key({ key: 'v' })
    clip('paste')
    expect(idsOn('mid')).toHaveLength(5)
    clip('paste', Object.fromEntries(store))
    expect(newRect()).toStrictEqual(rect(25, 25))
  })

  it('says how many photos the book lacks for 4 s', () => {
    vi.useFakeTimers()
    const other = framesPayload(
      makeBook({
        id: 'other',
        assets: { x: {}, y: {} },
        gallery: ['x', 'y'],
        spreads: [
          makeSpread({
            id: 'o',
            frames: [
              makeFrame({ id: 'p', assetId: 'x' }),
              makeFrame({ id: 'q', assetId: 'y', z: 1 }),
            ],
          }),
        ],
      }),
      'o',
      ['p', 'q'],
    )
    select('a')
    expect(pasteFrames(other, { inPlace: false })).toBe(true)
    expect(getEditorStatus()).toBe(
      "2 photos aren't in this book, so their frames are empty",
    )
    vi.advanceTimersByTime(3999)
    expect(getEditorStatus()).not.toBe('')
    vi.advanceTimersByTime(1)
    expect(getEditorStatus()).toBe('')
  })
})

describe('duplicate (Ctrl/⌘+D)', () => {
  it('duplicates +5/+5 mm, then repeats the move of its copy', () => {
    select('a')
    expect(key({ key: 'd' })).toBe(true)
    expect(newRect()).toStrictEqual(rect(25, 25))
    expect(getHistorySnapshot().undoLabel).toBe('Duplicate frame')
    dispatchBookOp({
      type: 'setFrameRect',
      spreadId: 'mid',
      frameId: getFrameSelection()?.frameIds[0] ?? '',
      rect: rect(60, 30),
    })
    expect(key({ key: 'D', metaKey: true, ctrlKey: false })).toBe(true)
    expect(newRect()).toStrictEqual(rect(100, 40))
    // a selection that is not the last copies: +5/+5 again
    select('c')
    key({ key: 'd' })
    expect(newRect()).toStrictEqual(rect(155, 155))
  })

  it('counts the frames and leaves other keys alone', () => {
    select('a', 'c')
    key({ key: 'd' })
    expect(getHistorySnapshot().undoLabel).toBe('Duplicate 2 frames')
    expect(key({ key: 'd', shiftKey: true })).toBe(false)
    expect(key({ key: 'd', altKey: true })).toBe(false)
    expect(key({ key: 'd', ctrlKey: false })).toBe(false)
    expect(key({ key: 'x' })).toBe(false)
    expect(idsOn('mid')).toHaveLength(5)
  })

  it('is not prevented without a selection, in the spreads list or a field', () => {
    expect(key({ key: 'd' })).toBe(false)
    select('a')
    expect(
      key(
        { key: 'd' },
        inside('<div data-testid="spreads-panel"><div data-t></div></div>'),
      ),
    ).toBe(false)
    expect(key({ key: 'd' }, inside('<input data-t>'))).toBe(false)
    expect(idsOn('mid')).toStrictEqual(['a', 'b', 'c'])
  })

  it('duplicates nothing without a selection or frames left to copy', () => {
    expect(duplicateSelectedFrames()).toBe(false)
    select('gone')
    expect(duplicateSelectedFrames()).toBe(false)
    expect(getFrameSelection()).toStrictEqual({
      spreadId: 'mid',
      frameIds: ['gone'],
    })
    expect(idsOn('mid')).toStrictEqual(['a', 'b', 'c'])
    // no lastDuplicate was kept: a real duplicate still steps +5/+5 mm
    select('a')
    expect(duplicateSelectedFrames()).toBe(true)
    expect(newRect()).toStrictEqual(rect(25, 25))
  })

  it('stops listening once uninstalled', () => {
    stop()
    select('a')
    expect(key({ key: 'd' })).toBe(false)
    expect(clip('copy').prevented).toBe(false)
  })
})

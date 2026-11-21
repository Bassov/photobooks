import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Book } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import {
  getBookStoreSnapshot,
  getHistorySnapshot,
  resetBookStore,
  undoBook,
} from './bookStore'
import { enterCropMode, exitCropMode, getCropTarget } from './cropMode'
import { getEditorStatus, setEditorStatus } from './editorStatus'
import { getFrameSource, resetFrameSelection } from './frameSelection'
import { setLeftPanelTab } from './leftPanelTabStore'
import {
  endPhotoPick,
  getPhotoPick,
  isPhotoPicking,
  photoPickOnSpread,
  pickPhoto,
  PICK_STATUS,
  startPhotoPick,
  subscribePhotoPick,
} from './photoPick'
import { setActiveSpreadId } from './photoRootSession'

const CROP = { zoom: 1, center: { x: 0.5, y: 0.5 } }
const REPLACE = { spreadId: 's', frameId: 'filled', kind: 'replace' } as const
const PLACE = { spreadId: 's', frameId: 'empty', kind: 'place' } as const

function book(locked = false): Book {
  return makeBook({
    assets: { a: {}, b: {}, c: {} },
    gallery: ['a', 'b', 'c'],
    spreads: [
      makeSpread({
        id: 's',
        frames: [
          makeFrame({ id: 'filled', assetId: 'a', crop: CROP, locked }),
          makeFrame({ id: 'empty', z: 2 }),
        ],
      }),
      makeSpread({ id: 't', frames: [] }),
    ],
  })
}

function seed(next: Book = book()): void {
  resetBookStore({
    book: next,
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

function assetOf(frameId: string): string | undefined {
  return getBookStoreSnapshot().book.spreads[0]?.frames.find(
    (frame) => frame.id === frameId,
  )?.assetId
}

function addDock(): { dock: HTMLElement; thumb: HTMLElement } {
  const dock = document.createElement('div')
  dock.dataset.testid = 'dock'
  const strip = document.createElement('section')
  strip.dataset.testid = 'filmstrip'
  const first = document.createElement('div')
  first.className = 'filmstrip-item'
  first.tabIndex = -1
  const thumb = document.createElement('div')
  thumb.className = 'filmstrip-item'
  thumb.tabIndex = 0
  strip.append(first, thumb)
  dock.append(strip)
  document.body.append(dock)
  return { dock, thumb }
}

describe('photoPick', () => {
  afterEach(() => {
    endPhotoPick()
    exitCropMode()
    resetFrameSelection()
    setLeftPanelTab('pages')
    setActiveSpreadId(null)
    setEditorStatus('')
    resetBookStore()
    document.body.replaceChildren()
    vi.useRealTimers()
  })

  it('starts: crop ends, the frame is selected, status and tag key are set', () => {
    seed()
    enterCropMode('s', 'filled')
    const listener = vi.fn()
    const unsubscribe = subscribePhotoPick(listener)
    startPhotoPick(REPLACE)
    unsubscribe()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getPhotoPick()).toEqual(REPLACE)
    expect(isPhotoPicking()).toBe(true)
    expect(getCropTarget()).toBeNull()
    expect(getFrameSource()).toEqual({ spreadId: 's', frameId: 'filled' })
    expect(getEditorStatus()).toBe(
      'Click a photo in the filmstrip to replace this one · Esc to cancel',
    )
    expect(photoPickOnSpread('s')).toBe('replace:filled')
    expect(photoPickOnSpread('t')).toBe('')
  })

  it('a pick replaces as one "Replace photo" step; Undo restores the old photo', () => {
    seed()
    startPhotoPick(REPLACE)
    pickPhoto('c')
    expect(assetOf('filled')).toBe('c')
    expect(getPhotoPick()).toBeNull()
    expect(getEditorStatus()).toBe('')
    expect(getFrameSource()).toEqual({ spreadId: 's', frameId: 'filled' })
    expect(getHistorySnapshot().undoLabel).toBe('Replace photo')
    undoBook()
    expect(assetOf('filled')).toBe('a')
    expect(getHistorySnapshot().canUndo).toBe(false)
  })

  it('a pick on an empty frame places as one "Place photo" step', () => {
    seed()
    startPhotoPick(PLACE)
    expect(getEditorStatus()).toBe(PICK_STATUS.place)
    expect(getEditorStatus()).toBe(
      'Click a photo in the filmstrip to place it here · Esc to cancel',
    )
    pickPhoto('b')
    expect(assetOf('empty')).toBe('b')
    expect(getHistorySnapshot().undoLabel).toBe('Place photo')
    undoBook()
    expect(assetOf('empty')).toBeUndefined()
  })

  it('pickPhoto outside the mode does nothing', () => {
    seed()
    pickPhoto('b')
    expect(assetOf('empty')).toBeUndefined()
    expect(getHistorySnapshot().canUndo).toBe(false)
  })

  it('the first Esc ends the mode before any other Esc layer, with no step', () => {
    seed()
    const later = vi.fn()
    document.addEventListener('keydown', later)
    startPhotoPick(REPLACE)
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    document.body.dispatchEvent(event)
    document.removeEventListener('keydown', later)
    expect(getPhotoPick()).toBeNull()
    expect(event.defaultPrevented).toBe(true)
    expect(later).not.toHaveBeenCalled()
    expect(getEditorStatus()).toBe('')
    expect(assetOf('filled')).toBe('a')
    expect(getHistorySnapshot().canUndo).toBe(false)
    // Off: Esc reaches the other layers again.
    const after = vi.fn()
    document.addEventListener('keydown', after)
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    document.removeEventListener('keydown', after)
    expect(after).toHaveBeenCalledTimes(1)
  })

  it('other keys keep the mode', () => {
    seed()
    startPhotoPick(REPLACE)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(getPhotoPick()).toEqual(REPLACE)
  })

  it('a pointerdown inside the dock keeps the mode; outside ends it', () => {
    seed()
    const { dock } = addDock()
    startPhotoPick(REPLACE)
    dock.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(getPhotoPick()).toEqual(REPLACE)
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(getPhotoPick()).toBeNull()
    expect(getHistorySnapshot().canUndo).toBe(false)
  })

  it('focus moves to the roving thumb on start', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] })
    seed()
    const { thumb } = addDock()
    startPhotoPick(REPLACE)
    vi.advanceTimersToNextFrame()
    expect(document.activeElement).toBe(thumb)
  })

  it('focus falls back to the first thumb without a roving one', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] })
    seed()
    const { thumb } = addDock()
    thumb.tabIndex = -1
    startPhotoPick(REPLACE)
    vi.advanceTimersToNextFrame()
    expect(document.activeElement).toBe(thumb.previousElementSibling)
  })

  it('another active spread ends it; the same one keeps it', () => {
    seed()
    setActiveSpreadId('s')
    startPhotoPick(REPLACE)
    setActiveSpreadId('s')
    expect(getPhotoPick()).toEqual(REPLACE)
    setActiveSpreadId('t')
    expect(getPhotoPick()).toBeNull()
  })

  it('Masters ends it and refuses a start', () => {
    seed()
    startPhotoPick(REPLACE)
    setLeftPanelTab('masters')
    expect(getPhotoPick()).toBeNull()
    startPhotoPick(REPLACE)
    expect(getPhotoPick()).toBeNull()
  })

  it('the frame locked or removed ends it; an unrelated change keeps it', () => {
    seed()
    startPhotoPick(REPLACE)
    seed(book())
    expect(getPhotoPick()).toEqual(REPLACE)
    seed(book(true))
    expect(getPhotoPick()).toBeNull()
    startPhotoPick(PLACE)
    expect(getPhotoPick()).toEqual(PLACE)
    seed(makeBook({ spreads: [makeSpread({ id: 's', frames: [] })] }))
    expect(getPhotoPick()).toBeNull()
  })

  it('a locked frame refuses a start', () => {
    seed(book(true))
    startPhotoPick(REPLACE)
    expect(getPhotoPick()).toBeNull()
    expect(getEditorStatus()).toBe('')
  })

  it('keeps the status text while on', () => {
    seed()
    startPhotoPick(REPLACE)
    setEditorStatus('')
    expect(getEditorStatus()).toBe(PICK_STATUS.replace)
    endPhotoPick()
    setEditorStatus('Selected')
    expect(getEditorStatus()).toBe('Selected')
  })

  it('notifies on end; an unsubscribed listener hears nothing', () => {
    seed()
    startPhotoPick(REPLACE)
    const listener = vi.fn()
    const unsubscribe = subscribePhotoPick(listener)
    endPhotoPick()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(isPhotoPicking()).toBe(false)
    unsubscribe()
    startPhotoPick(REPLACE)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('a press stopped before the document (bubble) still ends it: capture phase', () => {
    seed()
    const stopper = document.createElement('div')
    stopper.addEventListener('pointerdown', (event) => {
      event.stopPropagation()
    })
    document.body.append(stopper)
    startPhotoPick(REPLACE)
    stopper.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(getPhotoPick()).toBeNull()
  })

  it('after the end no listener is left: Esc and presses pass through', () => {
    seed()
    startPhotoPick(REPLACE)
    endPhotoPick()
    const esc = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    document.body.dispatchEvent(esc)
    expect(esc.defaultPrevented).toBe(false)
    startPhotoPick(PLACE)
    setActiveSpreadId('t')
    expect(getPhotoPick()).toBeNull()
    setEditorStatus('Saved')
    expect(getEditorStatus()).toBe('Saved')
  })

  it('focuses without scrolling; the end before the frame cancels the focus', () => {
    vi.useFakeTimers({
      toFake: ['requestAnimationFrame', 'cancelAnimationFrame'],
    })
    seed()
    const { thumb } = addDock()
    const focus = vi.spyOn(thumb, 'focus')
    startPhotoPick(REPLACE)
    vi.advanceTimersToNextFrame()
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    focus.mockClear()
    startPhotoPick(PLACE)
    endPhotoPick()
    vi.advanceTimersToNextFrame()
    expect(focus).not.toHaveBeenCalled()
  })

  it('no filmstrip, or one with no thumbs, is fine', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] })
    seed()
    startPhotoPick(REPLACE)
    expect(() => vi.advanceTimersToNextFrame()).not.toThrow()
    endPhotoPick()
    const strip = document.createElement('section')
    strip.dataset.testid = 'filmstrip'
    document.body.append(strip)
    startPhotoPick(REPLACE)
    expect(() => vi.advanceTimersToNextFrame()).not.toThrow()
    expect(getPhotoPick()).toEqual(REPLACE)
  })

  it('a second start switches the target', () => {
    seed()
    startPhotoPick(REPLACE)
    startPhotoPick(PLACE)
    expect(getPhotoPick()).toEqual(PLACE)
    expect(getEditorStatus()).toBe(PICK_STATUS.place)
    endPhotoPick()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(getEditorStatus()).toBe('')
  })
})

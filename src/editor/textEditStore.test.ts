import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import type { Frame } from '../core'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  getHistorySnapshot,
  resetBookStore,
  undoBook,
} from './bookStore'
import {
  getFrameSource,
  resetFrameSelection,
  setFrameSource,
} from './frameSelection'
import {
  cancelTextEdit,
  commitTextEdit,
  getSpreadOverflow,
  getSpreadTextEditKey,
  getTextEdit,
  isTextOverflowing,
  nextEditKey,
  registerTextDraft,
  resetTextEditForTests,
  setSpreadOverflow,
  startTextEdit,
  subscribeTextEdit,
  subscribeTextOverflow,
} from './textEditStore'

const at = { spreadId: 'spread-1', frameId: 't' }
const label: Frame = {
  id: 't',
  rect: { x: 10, y: 10, width: 60, height: 14 },
  z: 2,
  kind: 'text',
  content: { type: 'static', text: 'Hi' },
}

/** A text frame whose content was never written. */
const bare: Frame = { id: 'e', rect: label.rect, z: 3, kind: 'text' }

function load() {
  resetBookStore({
    book: makeBook({
      spreads: [
        makeSpread({
          frames: [makeFrame({ id: 'a' }), label, bare],
        }),
      ],
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

const frame = (id: string) =>
  getBookStoreSnapshot().book.spreads[0]?.frames.find((item) => item.id === id)
const textOf = (id: string) => {
  const found = frame(id)
  return found?.content?.type === 'static' ? found.content.text : undefined
}

/** The Text tool's create: one keyed step, then edit mode. */
function create(id = 'n') {
  const key = nextEditKey('add', id)
  dispatchBookOp(
    {
      type: 'addTextFrame',
      spreadId: 'spread-1',
      id,
      rect: { x: 0, y: 0, width: 60, height: 14 },
    },
    key,
  )
  setFrameSource({ spreadId: 'spread-1', frameId: id })
  startTextEdit({ spreadId: 'spread-1', frameId: id }, key)
}

describe('textEditStore', () => {
  let draft = { text: '', fitHeightMm: 0 }
  let release: () => void

  beforeEach(() => {
    load()
    draft = { text: '', fitHeightMm: 0 }
    release = registerTextDraft(() => draft)
  })

  afterEach(() => {
    release()
    resetTextEditForTests()
    resetFrameSelection()
    resetBookStore()
  })

  it('create plus the first typing is one "Add text" step', () => {
    create()
    draft = { text: 'Lake', fitHeightMm: 30 }
    commitTextEdit()
    expect(textOf('n')).toBe('Lake')
    expect(frame('n')?.rect.height).toBe(30)
    expect(getHistorySnapshot().undoLabel).toBe('Add text')
    undoBook()
    expect(frame('n')).toBeUndefined()
    expect(getHistorySnapshot().undoLabel).toBeNull()
  })

  it('an empty new frame goes away with no step and no selection', () => {
    create()
    draft = { text: '', fitHeightMm: 4.34 }
    commitTextEdit()
    expect(frame('n')).toBeUndefined()
    expect(getHistorySnapshot()).toMatchObject({
      undoLabel: null,
      redoLabel: null,
    })
    expect(getFrameSource()).toBeNull()
    expect(getTextEdit()).toBeNull()
  })

  it('an empty new frame whose step moved on is removed as a step', () => {
    create()
    // Another step lands meanwhile (e.g. inspector typing then clearing).
    dispatchBookOp({
      type: 'editText',
      spreadId: 'spread-1',
      frameId: 'n',
      text: 'x',
    })
    dispatchBookOp({
      type: 'editText',
      spreadId: 'spread-1',
      frameId: 'n',
      text: '',
    })
    draft = { text: '', fitHeightMm: 4.34 }
    commitTextEdit()
    expect(frame('n')).toBeUndefined()
    expect(getHistorySnapshot().undoLabel).toBe('Delete frame')
  })

  it('a later edit session is one "Edit text" step; untouched text writes none', () => {
    startTextEdit(at)
    expect(getSpreadTextEditKey('spread-1')).toBe('t')
    expect(getSpreadTextEditKey('other')).toBe('')
    draft = { text: 'Hi', fitHeightMm: 40 }
    commitTextEdit()
    expect(frame('t')?.rect.height).toBe(14)
    expect(getHistorySnapshot().undoLabel).toBeNull()

    startTextEdit(at)
    draft = { text: 'Hello', fitHeightMm: 4.34 }
    commitTextEdit()
    expect(textOf('t')).toBe('Hello')
    expect(getHistorySnapshot().undoLabel).toBe('Edit text')
  })

  it('a new edit commits the previous one; cancel drops it unwritten', () => {
    const listener = vi.fn()
    const stop = subscribeTextEdit(listener)
    startTextEdit(at)
    draft = { text: 'One', fitHeightMm: 4.34 }
    create('m')
    expect(textOf('t')).toBe('One')
    expect(getTextEdit()?.frameId).toBe('m')
    draft = { text: 'Two', fitHeightMm: 4.34 }
    cancelTextEdit()
    expect(getTextEdit()).toBeNull()
    expect(textOf('m')).toBe('')
    cancelTextEdit()
    commitTextEdit()
    // start, commit + start of the next one, cancel; the no-ops stay quiet.
    expect(listener).toHaveBeenCalledTimes(4)
    stop()
    startTextEdit(at)
    expect(listener).toHaveBeenCalledTimes(4)
  })

  it('an empty new frame keeps another selection, and works with none', () => {
    create()
    setFrameSource(at)
    commitTextEdit()
    expect(frame('n')).toBeUndefined()
    expect(getFrameSource()).toEqual(at)

    create('m')
    setFrameSource(null)
    commitTextEdit()
    expect(frame('m')).toBeUndefined()
    expect(getFrameSource()).toBeNull()
  })

  it('a stale unregister keeps the newer draft', () => {
    const stop = registerTextDraft(() => ({ text: 'Newer', fitHeightMm: 14 }))
    release()
    startTextEdit(at)
    commitTextEdit()
    expect(textOf('t')).toBe('Newer')
    stop()
  })

  it('commits without throwing when the spread or frame is gone or has no text yet', () => {
    draft = { text: '', fitHeightMm: 14 }
    startTextEdit({ spreadId: 'spread-1', frameId: 'e' })
    commitTextEdit()
    expect(frame('e')?.content).toBeUndefined()
    expect(getHistorySnapshot().undoLabel).toBeNull()

    draft = { text: 'X', fitHeightMm: 14 }
    startTextEdit({ spreadId: 'gone', frameId: 't' })
    commitTextEdit()
    startTextEdit({ spreadId: 'spread-1', frameId: 'zz' })
    commitTextEdit()
    expect(textOf('t')).toBe('Hi')
    expect(getTextEdit()).toBeNull()
  })

  it('commits nothing when no overlay holds a draft', () => {
    release()
    startTextEdit(at)
    commitTextEdit()
    expect(textOf('t')).toBe('Hi')
  })

  it('history keys count up from 1 after a reset', () => {
    expect(nextEditKey('txt', 't')).toBe('txt:t:1')
    expect(nextEditKey('add', 'u')).toBe('add:u:2')
  })
})

describe('text overflow ids', () => {
  afterEach(() => {
    resetTextEditForTests()
  })

  it('tracks overflowing frames per spread and notifies on change only', () => {
    const listener = vi.fn()
    const stop = subscribeTextOverflow(listener)
    setSpreadOverflow('s1', ['t'])
    setSpreadOverflow('s1', ['t'])
    expect(isTextOverflowing('s1', 't')).toBe(true)
    expect(isTextOverflowing('s2', 't')).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)
    setSpreadOverflow('s1', [])
    expect(isTextOverflowing('s1', 't')).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)
    setSpreadOverflow('s2', [])
    expect(listener).toHaveBeenCalledTimes(2)
    expect(getSpreadOverflow('s3')).toBe(getSpreadOverflow('s4'))
    stop()
    setSpreadOverflow('s1', ['t'])
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('a same-length change with other ids updates', () => {
    setSpreadOverflow('s1', ['a', 'b'])
    setSpreadOverflow('s1', ['a', 'c'])
    expect(getSpreadOverflow('s1')).toEqual(['a', 'c'])
    expect(isTextOverflowing('s1', 'b')).toBe(false)
  })
})

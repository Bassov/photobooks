import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import { resetBookStore } from './bookStore'
import {
  createBookWithPrompt,
  renameActiveBook,
} from './editorChromeBookActions'
import { seedGallery } from './gallery.test-helpers'

describe('editorChromeBookActions', () => {
  afterEach(() => {
    resetBookStore()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renameActiveBook no-ops without a book id or when prompt is cancelled', () => {
    const rename = vi.fn()
    const prompt = vi.fn(() => 'X')
    vi.stubGlobal('prompt', prompt)
    renameActiveBook(null, rename)
    expect(prompt).not.toHaveBeenCalled()
    expect(rename).not.toHaveBeenCalled()

    vi.stubGlobal(
      'prompt',
      vi.fn(() => null),
    )
    renameActiveBook('b1', rename)
    expect(rename).not.toHaveBeenCalled()
  })

  it('renameActiveBook renames when a title is entered', () => {
    resetBookStore({
      book: makeBook({
        id: 'b',
        title: 'Old',
        spreads: [makeSpread({ id: 's0', frames: [] })],
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    const rename = vi.fn()
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'New'),
    )
    renameActiveBook('b1', rename)
    expect(rename).toHaveBeenCalledWith('b1', 'New')
  })

  it('createBookWithPrompt respects confirm cancel and prompt cancel', () => {
    seedGallery(1)
    const create = vi.fn()
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    )
    createBookWithPrompt(create)
    expect(create).not.toHaveBeenCalled()

    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    vi.stubGlobal(
      'prompt',
      vi.fn(() => null),
    )
    createBookWithPrompt(create)
    expect(create).not.toHaveBeenCalled()
  })

  it('createBookWithPrompt creates after confirm', () => {
    seedGallery(1)
    const create = vi.fn()
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'Created'),
    )
    createBookWithPrompt(create)
    expect(create).toHaveBeenCalledWith('Created')
  })

  it('createBookWithPrompt skips confirm when empty', () => {
    resetBookStore({
      book: makeBook({
        id: 'empty',
        gallery: [],
        spreads: [makeSpread({ id: 's0', frames: [] })],
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    const create = vi.fn()
    const confirm = vi.fn()
    vi.stubGlobal('confirm', confirm)
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'Fresh'),
    )
    createBookWithPrompt(create)
    expect(confirm).not.toHaveBeenCalled()
    expect(create).toHaveBeenCalledWith('Fresh')
  })
})

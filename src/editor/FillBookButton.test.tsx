import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bookPrintProfile,
  pageCountRange,
  pagesOf,
  planFillBook,
  type Book,
  type Spread,
} from '../core'
import {
  getBookStoreSnapshot,
  getHistorySnapshot,
  getPlacedAssetIdsSnapshot,
  resetBookStore,
  undoBook,
} from './bookStore'
import {
  getEditorStatus,
  isStatusPillVisible,
  setEditorStatus,
} from './editorStatus'
import { FILL_BOOK_STATUS_MS, FillBookButton } from './FillBookButton'
import { revealFrames } from './frameReveal'
import { getFrameSource, setFrameSource } from './frameSelection'

vi.mock('./frameReveal', () => ({ revealFrames: vi.fn() }))
import { seedGallery } from './gallery.test-helpers'
import { resetLeftPanelTabForTests, setLeftPanelTab } from './leftPanelTabStore'
import { getActiveSpreadId, setActiveSpreadId } from './photoRootSession'
import { replaceRelinkStatuses, resetRelinkStore } from './relink/statusStore'

const chip = () => screen.getByTestId('film-fill-book')
const reason = () =>
  screen.getByTestId('film-fill-book-wrap').getAttribute('title')
const text = (id: string) => screen.getByTestId(id).textContent
const book = (): Book => getBookStoreSnapshot().book
const maxPages = () => pageCountRange(bookPrintProfile(book())).max

function withSpreads(spreads: readonly Spread[]): void {
  const snap = getBookStoreSnapshot()
  resetBookStore({ ...snap, book: { ...snap.book, spreads: [...spreads] } })
}

function nth<T>(list: readonly T[], index: number): T {
  const item = list[index]
  if (item === undefined) {
    throw new Error(`no item ${String(index)}`)
  }
  return item
}

const spreadId = (index: number): string => nth(book().spreads, index).id

/** `count` frameless spreads: no empty frame anywhere. */
const blankSpreads = (count: number): Spread[] =>
  Array.from({ length: count }, (_, index) => ({
    ...nth(book().spreads, 0),
    id: `blank-${String(index)}`,
    frames: [],
  }))

function openPopover(): void {
  fireEvent.click(chip())
}

describe('FillBookButton', () => {
  afterEach(() => {
    cleanup()
    vi.mocked(revealFrames).mockClear()
    vi.useRealTimers()
    resetBookStore()
    resetLeftPanelTabForTests()
    resetRelinkStore()
    setEditorStatus('')
    setFrameSource(null)
    setActiveSpreadId(null)
  })

  it('is disabled until the gallery has photos', () => {
    resetBookStore()
    render(<FillBookButton sort="added" />)
    expect(chip().hasAttribute('data-disabled')).toBe(true)
    expect(reason()).toBe('Add a folder of photos first')
  })

  it('is disabled in Masters mode', () => {
    seedGallery(3)
    setLeftPanelTab('masters')
    render(<FillBookButton sort="added" />)
    expect(chip().hasAttribute('data-disabled')).toBe(true)
    expect(reason()).toBe('Switch to Pages to fill the book')
  })

  it('is disabled when every unplaced photo file is missing', () => {
    const ids = seedGallery(2)
    replaceRelinkStatuses(new Map(ids.map((id) => [id, 'missing'])))
    render(<FillBookButton sort="added" />)
    expect(reason()).toBe("The unplaced photos' files are missing")
  })

  it('shows the plan numbers, order and missing note when open', () => {
    const ids = seedGallery(12)
    replaceRelinkStatuses(
      new Map([
        [nth(ids, 10), 'missing'],
        [nth(ids, 11), 'missing'],
      ]),
    )
    render(<FillBookButton sort="name" />)
    expect(chip().hasAttribute('data-disabled')).toBe(false)
    expect(reason()).toBe('Place the unplaced photos into the book')
    openPopover()
    const plan = planFillBook(book(), ids.slice(0, 10), maxPages())
    expect(plan.onNewSpreads).toBe(6)
    expect(text('fill-book-order')).toBe('10 unplaced photos, by File name.')
    expect(text('fill-book-frames')).toBe(`${String(plan.intoFrames)} photos`)
    expect(text('fill-book-spreads')).toBe(
      `${String(plan.onNewSpreads)} photos · ${String(plan.newSpreads)} spreads`,
    )
    expect(text('fill-book-pages')).toBe(
      `${String(plan.pagesBefore)} → ${String(plan.pagesAfter)}`,
    )
    expect(text('fill-book-missing')).toBe(
      '2 photos with missing files are skipped.',
    )
    expect(screen.queryByTestId('fill-book-left')).toBeNull()
    // Designer R42 M152: every popover text line uses the kit's 16.8 px leading.
    for (const id of [
      'fill-book-order',
      'fill-book-missing',
      'fill-book-cover',
    ]) {
      expect(screen.getByTestId(id).className).toContain('leading-[16.8px]')
    }
    expect(
      screen.getByTestId('fill-book-pages').parentElement?.className,
    ).toContain('leading-[16.8px]')
  })

  it('says "is" for one missing file', () => {
    const ids = seedGallery(2)
    replaceRelinkStatuses(new Map([[nth(ids, 1), 'missing']]))
    render(<FillBookButton sort="added" />)
    openPopover()
    expect(text('fill-book-missing')).toBe(
      '1 photo with missing files is skipped.',
    )
  })

  it('fills in the filmstrip sort, not the gallery order', () => {
    const ids = seedGallery(4)
    const snap = getBookStoreSnapshot()
    resetBookStore({
      ...snap,
      book: { ...snap.book, gallery: [...ids].reverse() },
    })
    render(<FillBookButton sort="name" />)
    openPopover()
    fireEvent.click(screen.getByTestId('fill-book-confirm'))
    const first = nth(book().spreads, 0).frames.find(
      (frame) => frame.assetId !== undefined,
    )
    expect(first?.assetId).toBe('seed-0')
  })

  it('names the Date taken order and "none" rows', () => {
    seedGallery(1)
    render(<FillBookButton sort="captured" />)
    openPopover()
    expect(text('fill-book-order')).toBe('1 unplaced photo, by Date taken.')
    expect(text('fill-book-spreads')).toBe('none')
    expect(text('fill-book-pages')).toBe(String(pagesOf(book().spreads.length)))
    expect(screen.queryByTestId('fill-book-missing')).toBeNull()
    expect(screen.queryByTestId('fill-book-left')).toBeNull()
  })

  it('says "stays" for one leftover photo', () => {
    seedGallery(3)
    withSpreads(blankSpreads(maxPages() / 2))
    render(<FillBookButton sort="added" />)
    openPopover()
    expect(text('fill-book-left')).toMatch(/^1 photo stays in the filmstrip: /)
    expect(screen.getByTestId('fill-book-left').className).toContain(
      'leading-[16.8px]',
    )
  })

  it('warns about leftovers at the page limit', () => {
    seedGallery(5)
    const max = maxPages()
    // One spread of room, no empty frames: 2 photos fit, 3 stay.
    withSpreads(blankSpreads(max / 2))
    render(<FillBookButton sort="added" />)
    openPopover()
    expect(text('fill-book-frames')).toBe('none')
    expect(text('fill-book-spreads')).toBe('2 photos · 1 spread')
    expect(text('fill-book-left')).toBe(
      `3 photos stay in the filmstrip: ${bookPrintProfile(book()).name} prints up to ${String(max)} pages.`,
    )
  })

  it('nothing fits: no rows and a disabled confirm', () => {
    seedGallery(1)
    const max = maxPages()
    withSpreads(blankSpreads(max / 2 + 1))
    render(<FillBookButton sort="added" />)
    openPopover()
    expect(screen.queryByTestId('fill-book-frames')).toBeNull()
    expect(text('fill-book-left')).toBe(
      `No empty frames, and the book is at ${String(max)} pages, the most ${bookPrintProfile(book()).name} prints.`,
    )
    expect(
      screen.getByTestId('fill-book-confirm').hasAttribute('data-disabled'),
    ).toBe(true)
  })

  it('Cancel closes with no change', () => {
    seedGallery(3)
    const before = book()
    render(<FillBookButton sort="added" />)
    openPopover()
    fireEvent.click(screen.getByTestId('fill-book-cancel'))
    expect(screen.queryByTestId('fill-book-popover')).toBeNull()
    expect(book()).toBe(before)
  })

  it('confirm fills in one undo step and reports the result', () => {
    const ids = seedGallery(12)
    const spreads = book().spreads.length
    const plan = planFillBook(book(), ids, maxPages())
    // Already active: only the fill itself can clear the frame selection.
    setActiveSpreadId(spreadId(0))
    setFrameSource({
      spreadId: spreadId(0),
      frameId: nth(nth(book().spreads, 0).frames, 0).id,
    })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    render(<FillBookButton sort="added" />)
    openPopover()
    fireEvent.click(screen.getByTestId('fill-book-confirm'))
    expect(screen.queryByTestId('fill-book-popover')).toBeNull()
    expect(book().spreads).toHaveLength(spreads + plan.newSpreads)
    expect(revealFrames).toHaveBeenCalledTimes(1)
    expect(revealFrames).toHaveBeenCalledWith(
      spreadId(0),
      nth(book().spreads, 0).frames.map((frame) => frame.id),
    )
    expect(getPlacedAssetIdsSnapshot().size).toBe(
      plan.intoFrames + plan.onNewSpreads,
    )
    expect(getHistorySnapshot().undoLabel).toBe('Fill book')
    expect(getActiveSpreadId()).toBe(spreadId(0))
    expect(getFrameSource()).toBeNull()
    const status = `Placed ${String(plan.intoFrames + plan.onNewSpreads)} photos · added ${String(plan.newSpreads)} spreads`
    expect(getEditorStatus()).toBe(status)
    expect(isStatusPillVisible(status)).toBe(true)
    expect(reason()).toBe('Every photo is placed')
    act(() => {
      vi.advanceTimersByTime(FILL_BOOK_STATUS_MS)
    })
    expect(getEditorStatus()).toBe('')
    act(() => {
      undoBook()
    })
    expect(book().spreads).toHaveLength(spreads)
    expect(getPlacedAssetIdsSnapshot().size).toBe(0)
  })

  it('the first changed spread is a new one when no empty frame exists', () => {
    seedGallery(2)
    withSpreads(blankSpreads(3))
    render(<FillBookButton sort="added" />)
    openPopover()
    fireEvent.click(screen.getByTestId('fill-book-confirm'))
    expect(book().spreads).toHaveLength(4)
    expect(getActiveSpreadId()).toBe(spreadId(2))
  })
})

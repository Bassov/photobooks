import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { placeAsset } from '../core'
import {
  getBookStoreSnapshot,
  patchAssetRecord,
  resetBookStore,
} from './bookStore'
import { spacerWidthPx } from './thumbSlotSize'
import { getEditorStatus, setEditorStatus } from './editorStatus'
import { FilmstripDock } from './FilmstripDock'
import { seedGallery } from './gallery.test-helpers'
import { installEditorKeys } from './galleryDrop'
import { resetGallerySelection, setSelectedAssetId } from './gallerySelection'
import {
  resetFilmstripThumbHeightForTests,
  setFilmstripThumbHeight,
} from './filmstripSize'
import { resetThumbCache } from './thumbCache'

function stubScrollportWidth(width: number): () => void {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return (this as HTMLElement).getAttribute('data-testid') ===
        'filmstrip-scroll'
        ? width
        : 0
    },
  })
  return () => {
    Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
  }
}

function placeFirst(ids: readonly string[], index = 0): void {
  const snap = getBookStoreSnapshot()
  const spread = snap.book.spreads[0]
  const frameId = spread?.frames[0]?.id
  const assetId = ids[index]
  if (spread === undefined || frameId === undefined || assetId === undefined) {
    throw new Error('expected a frame and an asset')
  }
  act(() => {
    resetBookStore({
      book: placeAsset(snap.book, spread.id, frameId, assetId),
      sessionMeta: snap.sessionMeta,
      importRunning: false,
      importExpectedCount: 0,
    })
  })
}

function itemIds(): string[] {
  return screen
    .queryAllByTestId('filmstrip-item')
    .map((node) => node.getAttribute('data-asset-id') ?? '')
}

function firstOf(testId: string): HTMLElement {
  const node = screen.getAllByTestId(testId).at(0)
  if (node === undefined) {
    throw new Error(`expected ${testId}`)
  }
  return node
}

describe('filmstrip sort / filter / remove', () => {
  let restore: () => void
  beforeEach(() => {
    restore = stubScrollportWidth(1200)
  })
  afterEach(() => {
    cleanup()
    restore()
    resetBookStore()
    resetThumbCache()
    resetGallerySelection()
    resetFilmstripThumbHeightForTests()
    setEditorStatus('')
  })

  it('"Unplaced only" shrinks as photos are placed and shows empty copy', () => {
    const ids = seedGallery(2)
    render(<FilmstripDock />)
    fireEvent.click(screen.getByTestId('film-unplaced-only'))
    expect(screen.getByTestId('placed-count').textContent).toBe(
      'Photos · 2 of 2 · 0 used',
    )
    expect(itemIds()).toEqual([...ids])

    placeFirst(ids, 0)
    expect(itemIds()).toEqual([ids[1]])
    expect(screen.getByTestId('placed-count').textContent).toBe(
      'Photos · 1 of 2 · 1 used',
    )
    // The book gallery itself is untouched by the filter.
    expect(getBookStoreSnapshot().book.gallery).toEqual([...ids])
  })

  it('shows the placed badge only on placed assets', () => {
    const ids = seedGallery(2)
    render(<FilmstripDock />)
    expect(screen.queryAllByTestId('filmstrip-placed')).toHaveLength(0)
    placeFirst(ids, 0)
    const badges = screen.getAllByTestId('filmstrip-placed')
    expect(badges).toHaveLength(1)
    expect(
      badges[0]?.closest('[data-asset-id]')?.getAttribute('data-asset-id'),
    ).toBe(ids[0])
  })

  it('shows the name strip only from thumb height 90', () => {
    seedGallery(2)
    setFilmstripThumbHeight(88)
    render(<FilmstripDock />)
    expect(screen.queryAllByTestId('filmstrip-name')).toHaveLength(0)
    act(() => {
      setFilmstripThumbHeight(96)
    })
    expect(screen.getAllByTestId('filmstrip-name')).toHaveLength(2)
    act(() => {
      setFilmstripThumbHeight(88)
    })
    expect(screen.queryAllByTestId('filmstrip-name')).toHaveLength(0)
  })

  it('shows the every-photo-placed copy when the filter hides everything', () => {
    const ids = seedGallery(1)
    render(<FilmstripDock />)
    placeFirst(ids, 0)
    fireEvent.click(screen.getByTestId('film-unplaced-only'))
    expect(screen.getByTestId('filmstrip-filter-empty').textContent).toBe(
      'Every photo is placed. Turn off “Unplaced” to see all.',
    )
    expect(screen.queryByTestId('filmstrip-empty')).toBeNull()
  })

  it('sorts by name from the Sort menu without changing the gallery', async () => {
    const ids = seedGallery(3)
    const snap = getBookStoreSnapshot()
    const names = ['c.jpg', 'a.jpg', 'b.jpg']
    const sessionMeta = new Map(snap.sessionMeta)
    ids.forEach((id, i) => {
      const meta = sessionMeta.get(id)
      if (meta !== undefined) {
        sessionMeta.set(id, { ...meta, name: names[i] ?? id })
      }
    })
    resetBookStore({
      book: snap.book,
      sessionMeta,
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<FilmstripDock />)
    fireEvent.click(screen.getByTestId('film-sort'))
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Name' }))
    expect(itemIds()).toEqual([ids[1], ids[2], ids[0]])
    expect(getBookStoreSnapshot().book.gallery).toEqual([...ids])
  })

  it('removes an unplaced photo immediately with a status message', () => {
    const ids = seedGallery(2)
    render(<FilmstripDock />)
    fireEvent.click(firstOf('filmstrip-remove'))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(getBookStoreSnapshot().book.gallery).toEqual([ids[1]])
    expect(getEditorStatus()).toContain('removed from the gallery')
  })

  it('asks before removing a placed photo and empties its frame', () => {
    const ids = seedGallery(2)
    render(<FilmstripDock />)
    placeFirst(ids, 0)
    fireEvent.click(firstOf('filmstrip-remove'))
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(getBookStoreSnapshot().book.gallery).toEqual([...ids])

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(getBookStoreSnapshot().book.gallery).toEqual([...ids])

    fireEvent.click(firstOf('filmstrip-remove'))
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove and empty frame' }),
    )
    const book = getBookStoreSnapshot().book
    expect(book.gallery).toEqual([ids[1]])
    expect(book.spreads[0]?.frames[0]?.assetId).toBeUndefined()
  })

  function seedNamed(
    entries: readonly { name: string; aspect: number }[],
  ): readonly string[] {
    const ids = seedGallery(entries.length)
    const snap = getBookStoreSnapshot()
    const sessionMeta = new Map(snap.sessionMeta)
    ids.forEach((id, i) => {
      const entry = entries[i]
      if (entry !== undefined) {
        sessionMeta.set(id, {
          name: entry.name,
          correctedWidth: Math.round(100 * entry.aspect),
          correctedHeight: 100,
          orientation: 1,
          aspect: entry.aspect,
        })
      }
    })
    resetBookStore({
      book: snap.book,
      sessionMeta,
      importRunning: false,
      importExpectedCount: 0,
    })
    return ids
  }

  async function pickSort(label: string): Promise<void> {
    fireEvent.click(screen.getByTestId('film-sort'))
    fireEvent.click(await screen.findByRole('menuitemradio', { name: label }))
  }

  it('labels the sort control and checks the active menu item', async () => {
    seedGallery(1)
    render(<FilmstripDock />)
    expect(screen.getByTestId('film-sort').getAttribute('aria-label')).toBe(
      'Sort photos: Added order',
    )
    expect(screen.getByTestId('placed-count').textContent).toBe(
      'Photos · 1 · 0 used',
    )
    fireEvent.click(screen.getByTestId('film-sort'))
    const added = await screen.findByRole('menuitemradio', {
      name: 'Added order',
    })
    expect(added.getAttribute('aria-checked')).toBe('true')
    expect(
      screen
        .getByRole('menuitemradio', { name: 'Name' })
        .getAttribute('aria-checked'),
    ).toBe('false')
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Capture time' }))
    expect(screen.getByTestId('film-sort').getAttribute('aria-label')).toBe(
      'Sort photos: Capture time',
    )
  })

  it('keeps aspects and names aligned with the sorted order', async () => {
    seedNamed([
      { name: 'c.jpg', aspect: 1.5 },
      { name: 'a.jpg', aspect: 0.5 },
      { name: 'b.jpg', aspect: 1 },
    ])
    render(<FilmstripDock />)
    await pickSort('Name')
    const aspects = screen
      .getAllByTestId('filmstrip-item')
      .map((node) => node.getAttribute('data-aspect'))
    expect(aspects).toEqual(['0.5', '1', '1.5'])
    const labels = screen
      .getAllByTestId('filmstrip-remove')
      .map((node) => node.getAttribute('aria-label'))
    expect(labels).toEqual([
      'Remove a.jpg from gallery',
      'Remove b.jpg from gallery',
      'Remove c.jpg from gallery',
    ])
  })

  it('re-sorts by capture time when capturedAt lands after the sort is chosen', async () => {
    const ids = seedGallery(2)
    render(<FilmstripDock />)
    await pickSort('Capture time')
    expect(itemIds()).toEqual([...ids])
    act(() => {
      patchAssetRecord(ids[0] ?? '', { capturedAt: '2024-06-01T00:00:00.000Z' })
      patchAssetRecord(ids[1] ?? '', { capturedAt: '2024-01-01T00:00:00.000Z' })
    })
    expect(itemIds()).toEqual([ids[1], ids[0]])
  })

  it('sizes the strip to the visible photos while filtering', () => {
    const ids = seedGallery(3)
    const snap = getBookStoreSnapshot()
    resetBookStore({
      book: snap.book,
      sessionMeta: snap.sessionMeta,
      importRunning: true,
      importExpectedCount: 10,
    })
    render(<FilmstripDock />)
    const spacer = (): string | undefined =>
      document.querySelector<HTMLElement>('.filmstrip-spacer')?.style.width
    const aspects = [1.5, 1.5, 1.5]
    expect(spacer()).toBe(`${String(spacerWidthPx(aspects, 10))}px`)

    placeFirst(ids, 0)
    fireEvent.click(screen.getByTestId('film-unplaced-only'))
    expect(spacer()).toBe(`${String(spacerWidthPx([1.5, 1.5], 2))}px`)
  })

  it('names the photo and removes it with an exact status when confirmed', () => {
    const ids = seedNamed([{ name: 'beach.jpg', aspect: 1 }])
    render(<FilmstripDock />)
    placeFirst(ids, 0)
    fireEvent.click(firstOf('filmstrip-remove'))
    expect(screen.getByRole('alertdialog').textContent).toContain('“beach.jpg”')
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove and empty frame' }),
    )
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(getEditorStatus()).toBe(
      'beach.jpg removed from the gallery — the file stays on disk',
    )
  })

  it('prevents default on a thumb Delete and ignores Delete elsewhere', () => {
    const ids = seedGallery(2)
    render(<FilmstripDock />)
    const uninstall = installEditorKeys()
    try {
      const outside = document.createElement('div')
      document.body.append(outside)
      expect(fireEvent.keyDown(outside, { key: 'Delete' })).toBe(true)
      expect(getBookStoreSnapshot().book.gallery).toEqual([...ids])
      expect(getEditorStatus()).toBe('')
      outside.remove()

      expect(
        fireEvent.keyDown(firstOf('filmstrip-item'), { key: 'Delete' }),
      ).toBe(false)
      expect(getBookStoreSnapshot().book.gallery).toEqual([ids[1]])
    } finally {
      uninstall()
    }
  })

  it('removes the focused thumb on Delete', () => {
    const ids = seedGallery(2)
    render(<FilmstripDock />)
    const uninstall = installEditorKeys()
    try {
      setSelectedAssetId(ids[0] ?? null)
      fireEvent.keyDown(firstOf('filmstrip-item'), { key: 'Delete' })
      expect(getBookStoreSnapshot().book.gallery).toEqual([ids[1]])
    } finally {
      uninstall()
    }
  })
})

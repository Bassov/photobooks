import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AssetsPanel } from './AssetsPanel'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import { getEditorStatus, setEditorStatus } from './editorStatus'
import { seedGallery } from './gallery.test-helpers'
import {
  getActiveSpreadId,
  resetActiveSpreadIdForTests,
} from './photoRootSession'
import { replaceRelinkStatuses, resetRelinkStore } from './relink/statusStore'
import { ASSET_ROW_HEIGHT } from './assetsPanelModel'
import { ensureThumb, resetThumbCache, setThumbUrl } from './thumbCache'

const accept = vi.hoisted(() => vi.fn<(id: string) => Promise<boolean>>())
vi.mock('./thumbCache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./thumbCache')>()
  return { ...actual, ensureThumb: vi.fn(actual.ensureThumb) }
})
vi.mock('./relink/rescan', () => ({ acceptModifiedAsset: accept }))

function placeTwice(assetId: string): string {
  const { book, sessionMeta } = getBookStoreSnapshot()
  const [first, ...rest] = book.spreads
  if (first === undefined) {
    throw new Error('seed book has no spreads')
  }
  const frame = (id: string, z: number) => ({
    id,
    rect: { x: 0, y: 0, width: 10, height: 10 },
    z,
    assetId,
  })
  resetBookStore({
    book: {
      ...book,
      spreads: [
        { ...first, frames: [frame('fa', 0), frame('fb', 1)] },
        ...rest,
      ],
    },
    sessionMeta,
    importRunning: false,
    importExpectedCount: 0,
  })
  return first.id
}

function ids(): string[] {
  return screen
    .getAllByTestId('assets-row')
    .map((el) => el.getAttribute('data-asset-id') ?? '')
}

describe('AssetsPanel', () => {
  beforeEach(() => {
    accept.mockReset()
    vi.mocked(ensureThumb).mockClear()
    setEditorStatus('')
  })
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetRelinkStore()
    resetActiveSpreadIdForTests()
    resetThumbCache()
    vi.restoreAllMocks()
  })

  it('shows the empty state without photos', () => {
    resetBookStore()
    render(<AssetsPanel />)
    expect(screen.getByTestId('assets-empty')).toBeTruthy()
    expect(screen.queryByTestId('assets-list')).toBeNull()
  })

  it('lists status, uses and spreads, unused photos marked', () => {
    seedGallery(3)
    placeTwice('seed-1')
    replaceRelinkStatuses(new Map([['seed-2', 'missing']]))
    render(<AssetsPanel />)
    const rows = screen.getAllByTestId('assets-row')
    expect(rows).toHaveLength(3)
    // default sort: status → missing first, then most used
    expect(ids()).toEqual(['seed-2', 'seed-1', 'seed-0'])
    expect(rows[1]?.textContent).toContain('2× · spread 1')
    expect(rows[0]?.getAttribute('data-status')).toBe('missing')
    expect(rows[2]?.textContent).toContain('unused')
  })

  it('sorts by uses', () => {
    seedGallery(3)
    placeTwice('seed-1')
    replaceRelinkStatuses(new Map([['seed-2', 'missing']]))
    render(<AssetsPanel />)
    fireEvent.click(screen.getByLabelText('Uses'))
    expect(ids()).toEqual(['seed-1', 'seed-0', 'seed-2'])
  })

  it('jumps to the spread of a used row; unused rows have no jump', () => {
    seedGallery(2)
    const spreadId = placeTwice('seed-1')
    render(<AssetsPanel />)
    const jumps = screen.getAllByTestId('assets-jump')
    expect(jumps).toHaveLength(1)
    fireEvent.click(screen.getByTestId('assets-jump'))
    expect(getActiveSpreadId()).toBe(spreadId)
    expect(getEditorStatus()).toContain('Jumped to')
  })

  it('Update accepts a modified asset and reports it', async () => {
    seedGallery(1)
    replaceRelinkStatuses(new Map([['seed-0', 'modified']]))
    accept.mockResolvedValue(true)
    render(<AssetsPanel />)
    fireEvent.click(screen.getByTestId('assets-update'))
    await waitFor(() => {
      expect(getEditorStatus()).toContain('crop kept')
    })
    expect(accept).toHaveBeenCalledWith('seed-0')
  })

  it('Update without a staged match asks to rescan', async () => {
    seedGallery(1)
    replaceRelinkStatuses(new Map([['seed-0', 'modified']]))
    accept.mockResolvedValue(false)
    render(<AssetsPanel />)
    fireEvent.click(screen.getByTestId('assets-update'))
    await waitFor(() => {
      expect(getEditorStatus()).toContain('Rescan')
    })
  })

  it('virtualizes long galleries', () => {
    seedGallery(1000)
    render(<AssetsPanel />)
    expect(screen.getAllByTestId('assets-row').length).toBeLessThan(40)
    expect(screen.getByTestId('assets-count').textContent).toBe('1000')
  })

  it('renders a thumbnail once the thumb is published', async () => {
    seedGallery(1)
    render(<AssetsPanel />)
    expect(screen.getByTestId('assets-thumb-placeholder')).toBeTruthy()
    setThumbUrl('seed-0', new ArrayBuffer(4), 'image/jpeg')
    await waitFor(() => {
      expect(
        screen.getByTestId('assets-row').querySelector('img.assets-thumb'),
      ).not.toBeNull()
    })
  })

  it('re-windows rows when the list scrolls and resizes', () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200)
    seedGallery(1000)
    render(<AssetsPanel />)
    const list = screen.getByTestId('assets-list')
    const before = ids()[0]
    list.scrollTop = 20000
    fireEvent.scroll(list)
    expect(ids()[0]).not.toBe(before)
  })

  it('requests thumbs for present assets only', () => {
    seedGallery(2)
    replaceRelinkStatuses(new Map([['seed-1', 'missing']]))
    render(<AssetsPanel />)
    const requested = vi.mocked(ensureThumb).mock.calls.map(([id]) => id)
    expect(requested).toContain('seed-0')
    expect(requested).not.toContain('seed-1')
  })

  it('never shows a thumbnail for a missing asset', () => {
    seedGallery(1)
    replaceRelinkStatuses(new Map([['seed-0', 'missing']]))
    setThumbUrl('seed-0', new ArrayBuffer(4), 'image/jpeg')
    render(<AssetsPanel />)
    expect(screen.queryByTestId('assets-thumb')).toBeNull()
    expect(screen.getByTestId('assets-thumb-placeholder')).toBeTruthy()
  })

  it('shows Update only for modified rows and a status badge otherwise', () => {
    seedGallery(2)
    render(<AssetsPanel />)
    expect(screen.queryByTestId('assets-update')).toBeNull()
    expect(screen.getAllByTestId('assets-status')).toHaveLength(2)
  })

  it('switches the sort back to status', () => {
    seedGallery(3)
    placeTwice('seed-1')
    replaceRelinkStatuses(new Map([['seed-2', 'missing']]))
    render(<AssetsPanel />)
    fireEvent.click(screen.getByLabelText('Uses'))
    fireEvent.click(screen.getByLabelText('Status'))
    expect(ids()).toEqual(['seed-2', 'seed-1', 'seed-0'])
  })

  it('positions rows absolutely inside a full-height track', () => {
    seedGallery(3)
    render(<AssetsPanel />)
    const rows = screen.getAllByTestId('assets-row')
    expect(rows[0]?.style.top).toBe('0px')
    expect(rows[1]?.style.top).toBe(`${String(ASSET_ROW_HEIGHT)}px`)
    expect(rows[2]?.style.top).toBe(`${String(2 * ASSET_ROW_HEIGHT)}px`)
    expect(rows[0]?.style.height).toBe(`${String(ASSET_ROW_HEIGHT)}px`)
    const track = screen.getByTestId('assets-list').firstElementChild
    expect((track as HTMLElement).style.height).toBe(
      `${String(3 * ASSET_ROW_HEIGHT)}px`,
    )
  })

  it('windows rows to the measured list height', () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200)
    seedGallery(1000)
    render(<AssetsPanel />)
    // ceil(200 / 48) = 5 visible + 6 overscan
    expect(screen.getAllByTestId('assets-row')).toHaveLength(11)
  })

  it('keeps the default window while the list is unmeasured', () => {
    seedGallery(1000)
    render(<AssetsPanel />)
    // default 480px: 10 visible + 6 overscan
    expect(screen.getAllByTestId('assets-row')).toHaveLength(16)
  })
})

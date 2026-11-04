import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import { FIELD, SUB, T } from './editorChromeTokens'
import { getFrameSource, setFrameSource } from './frameSelection'
import { LeftPanel } from './LeftPanel'
import {
  getPickedParentId,
  resetLeftPanelTabForTests,
  setLeftPanelTab,
} from './leftPanelTabStore'

function loadBook(parents: { id: string; name: string }[]): void {
  resetBookStore({
    book: makeBook({
      spreads: [makeSpread({ id: 's1', parentId: parents[0]?.id ?? null })],
      parents: parents.map((parent) => ({
        ...parent,
        frames: [makeFrame({ id: 'logo' })],
        guides: [],
      })),
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

const parents = () => getBookStoreSnapshot().book.parents ?? []
const options = () =>
  within(screen.getByRole('listbox', { name: 'Masters' })).getAllByRole(
    'option',
  )

describe('LeftPanel', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetLeftPanelTabForTests()
    setFrameSource(null)
  })

  it('shows Pages first and switches to Masters and back', () => {
    render(<LeftPanel />)
    expect(screen.getByTestId('spreads-panel')).toBeTruthy()
    expect(
      screen.getByTestId('left-tab-pages').getAttribute('aria-selected'),
    ).toBe('true')

    fireEvent.click(screen.getByTestId('left-tab-masters'))
    // A new book has its empty default master, named in the note and tagged.
    expect(screen.queryByTestId('masters-empty')).toBeNull()
    expect(screen.getByTestId('masters-intro').textContent).toBe(
      'Anything on a master repeats on its pages. Spreads use the default, Master A, unless they pick another.',
    )
    expect(options().map((o) => o.getAttribute('aria-label'))).toEqual([
      'Master A, default',
    ])
    expect(screen.getByTestId('master-default-tag').textContent).toBe('Default')
    expect(screen.queryByTestId('spreads-panel')).toBeNull()
    expect(
      screen.getByTestId('left-tab-masters').getAttribute('aria-selected'),
    ).toBe('true')
    expect(
      screen.getByTestId('left-tab-pages').getAttribute('aria-selected'),
    ).toBe('false')
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Pages',
      'Masters',
    ])

    fireEvent.click(screen.getByTestId('left-tab-pages'))
    expect(screen.getByTestId('spreads-panel')).toBeTruthy()
  })

  it('switching modes drops the picked frame; the same tab keeps it', () => {
    render(<LeftPanel />)
    setFrameSource({ spreadId: 'spread-1', frameId: 'frame-1' })

    fireEvent.click(screen.getByTestId('left-tab-pages'))
    const kept = getFrameSource()
    fireEvent.click(screen.getByTestId('left-tab-masters'))

    expect(kept).toEqual({ spreadId: 'spread-1', frameId: 'frame-1' })
    expect(getFrameSource()).toBeNull()
  })
})

describe('MastersPanel', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetLeftPanelTabForTests()
    vi.restoreAllMocks()
  })

  it('lists the parents with the first one selected', () => {
    loadBook([
      { id: 'p1', name: 'Master A' },
      { id: 'p2', name: 'Master B' },
    ])
    setLeftPanelTab('masters')

    render(<LeftPanel />)

    expect(options().map((row) => row.textContent)).toEqual([
      'Master A',
      'Master B',
    ])
    expect(options().map((row) => row.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
    ])
    expect(screen.queryByTestId('masters-empty')).toBeNull()
  })

  it('New master adds and selects "Master A" in an empty book', () => {
    loadBook([])
    setLeftPanelTab('masters')
    render(<LeftPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'New master' }))

    expect(parents().map((parent) => parent.name)).toEqual(['Master A'])
    expect(getPickedParentId()).toBe(parents()[0]?.id)
    expect(options()[0]?.getAttribute('aria-selected')).toBe('true')
  })

  it('clicking a row picks it and drops the frame selection', () => {
    loadBook([
      { id: 'p1', name: 'Master A' },
      { id: 'p2', name: 'Master B' },
    ])
    setLeftPanelTab('masters')
    render(<LeftPanel />)
    setFrameSource({ spreadId: 'p1', frameId: 'logo' })

    fireEvent.click(screen.getByTestId('master-list-item-p2'))

    expect(getPickedParentId()).toBe('p2')
    expect(getFrameSource()).toBeNull()
  })

  it.each([
    ['Enter commits the trimmed name', 'Enter', '  Logo  ', 'Logo'],
    ['Escape keeps the old name', 'Escape', 'Logo', 'Master A'],
  ])('rename: %s', (_, key, typed, stored) => {
    loadBook([{ id: 'p1', name: 'Master A' }])
    setLeftPanelTab('masters')
    render(<LeftPanel />)
    fireEvent.doubleClick(screen.getByTestId('master-list-item-p1'))
    const input = screen.getByTestId('master-rename-input')

    fireEvent.change(input, { target: { value: typed } })
    fireEvent.keyDown(input, { key })
    act(() => {
      input.blur()
    })

    expect(parents()[0]?.name).toBe(stored)
    expect(screen.queryByTestId('master-rename-input')).toBeNull()
  })

  it.each([
    ['Rename opens the name field', 'master-menu-rename', 2, true],
    [
      'Delete drops the master; its spread shows None',
      'master-menu-delete',
      1,
      false,
    ],
  ])('row menu: %s', async (_, item, count, renaming) => {
    loadBook([
      { id: 'p1', name: 'Master A' },
      { id: 'p2', name: 'Master B' },
    ])
    setLeftPanelTab('masters')
    render(<LeftPanel />)

    fireEvent.click(screen.getByTestId('master-menu-p1'))
    fireEvent.click(await screen.findByTestId(item))

    expect(parents()).toHaveLength(count)
    expect(screen.queryByTestId('master-rename-input') !== null).toBe(renaming)
    expect(getBookStoreSnapshot().book.spreads[0]?.parentId).toBe(
      renaming ? 'p1' : undefined,
    )
  })

  it('row menu: Make default moves the tag and the note; the default cannot be deleted', async () => {
    resetBookStore({
      book: makeBook({
        parents: ['A', 'B'].map((letter) => ({
          id: `p${letter}`,
          name: `Master ${letter}`,
          frames: [],
          guides: [],
        })),
        defaultParentId: 'pA',
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    setLeftPanelTab('masters')
    render(<LeftPanel />)
    const tagged = () =>
      options()
        .filter((o) => within(o).queryByTestId('master-default-tag') !== null)
        .map((o) => o.getAttribute('data-item'))

    // Kit tokens: the note in SUB with the name in T; the tag on the shown
    // (selected) row in T, on another row in SUB.
    const intro = screen.getByTestId('masters-intro')
    expect(intro.style.color.toUpperCase()).toBe(SUB)
    expect(intro.querySelector('b')?.style.color.toUpperCase()).toBe(T)
    const tagColor = () =>
      screen.getByTestId('master-default-tag').style.color.toUpperCase()
    expect(tagColor()).toBe(T)

    fireEvent.click(screen.getByTestId('master-menu-pA'))
    expect(await screen.findByTestId('master-menu-rename')).toBeTruthy()
    expect(screen.queryByTestId('master-menu-make-default')).toBeNull()
    const remove = screen.getByTestId('master-menu-delete')
    expect(remove.getAttribute('aria-disabled')).toBe('true')
    expect(
      within(remove).getByTitle('Make another master the default first'),
    ).toBeTruthy()
    fireEvent.keyDown(remove, { key: 'Escape' })

    fireEvent.click(screen.getByTestId('master-menu-pB'))
    fireEvent.click(await screen.findByTestId('master-menu-make-default'))

    expect(getBookStoreSnapshot().book.defaultParentId).toBe('pB')
    expect(options().map((o) => o.getAttribute('data-item'))).toEqual([
      'pA',
      'pB',
    ])
    expect(tagged()).toEqual(['pB'])
    expect(tagColor()).toBe(SUB)
    expect(screen.getByTestId('masters-intro').textContent).toContain(
      'the default, Master B, unless',
    )
  })

  it('fits each thumb to a two-page spread of the list width', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(232)
    loadBook([{ id: 'p1', name: 'Master A' }])
    setLeftPanelTab('masters')

    render(<LeftPanel />)

    // 232 px list − 32 px insets = 200 px box; 300 × 300 mm pages → 2:1.
    const thumb = screen
      .getByTestId('master-list-item-p1')
      .querySelector<HTMLElement>('.editor-spread-thumb')
    expect(thumb?.style.height).toBe('100px')
  })

  it('styles the quiet New master action and the rename field with kit tokens', () => {
    loadBook([{ id: 'p1', name: 'Master A' }])
    setLeftPanelTab('masters')
    render(<LeftPanel />)
    fireEvent.doubleClick(screen.getByTestId('master-list-item-p1'))
    const input = screen.getByTestId('master-rename-input')

    fireEvent.keyDown(input, { key: 'a' })

    expect(screen.getByTestId('master-rename-input')).toBe(input)
    expect(input.style.backgroundColor).toBe(FIELD)
    expect(input.style.color).toBe(T)
    expect(screen.getByRole('button', { name: 'New master' }).style.color).toBe(
      SUB,
    )
  })

  it('blur commits a rename', () => {
    loadBook([{ id: 'p1', name: 'Master A' }])
    setLeftPanelTab('masters')
    render(<LeftPanel />)
    fireEvent.doubleClick(screen.getByTestId('master-list-item-p1'))
    const input = screen.getByTestId('master-rename-input')

    fireEvent.change(input, { target: { value: 'Cover logo' } })
    fireEvent.blur(input)

    expect(parents()[0]?.name).toBe('Cover logo')
  })
})

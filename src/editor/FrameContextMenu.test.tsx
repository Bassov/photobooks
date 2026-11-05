import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Book, BookOp, ZMove } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import * as bookStore from './bookStore'
import { resetBookStore } from './bookStore'
import { FrameContextMenu } from './FrameContextMenu'
import { installArrangeKeys } from './frameArrange'
import { ArrangeSection, FrameLockButton } from './FrameSections'
import {
  getFrameSelection,
  getFrameSource,
  resetFrameSelection,
  setFrameSelection,
} from './frameSelection'

function stackBook(count: number, locked = false): Book {
  return makeBook({
    spreads: [
      makeSpread({
        id: 's',
        frames: Array.from({ length: count }, (_, at) =>
          makeFrame({
            id: `f${String(at)}`,
            z: at + 1,
            ...(locked ? { locked: true } : {}),
          }),
        ),
      }),
    ],
  })
}

function seed(book: Book) {
  resetBookStore({
    book,
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

/** Editor frames are buttons inside their spread, as `SpreadView` paints them. */
function Canvas({
  frameIds,
  spreadId = 's',
}: {
  frameIds: string[]
  spreadId?: string
}) {
  return (
    <div data-spread-id={spreadId}>
      {frameIds.map((id) => (
        <button
          key={id}
          type="button"
          className="spread-frame"
          data-frame-id={id}
        >
          {id}
        </button>
      ))}
      <div className="spread-frame" data-frame-id="preview">
        preview
      </div>
    </div>
  )
}

function openMenu(frameId: string, point = { clientX: 40, clientY: 50 }) {
  const frame = screen.getByText(frameId)
  return fireEvent.contextMenu(frame, point)
}

const SHORTCUTS: Record<ZMove, KeyboardEventInit> = {
  front: { code: 'BracketRight', ctrlKey: true, shiftKey: true },
  forward: { code: 'BracketRight', ctrlKey: true },
  backward: { code: 'BracketLeft', ctrlKey: true },
  back: { code: 'BracketLeft', ctrlKey: true, shiftKey: true },
}

describe('FrameContextMenu', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    resetFrameSelection()
    resetBookStore()
  })

  it('menu, shortcut and inspector dispatch the same op', () => {
    seed(stackBook(3))
    const sent: BookOp[] = []
    vi.spyOn(bookStore, 'dispatchBookOp').mockImplementation((op) => {
      sent.push(op)
    })
    const target = { spreadId: 's', frameId: 'f1' }
    const off = installArrangeKeys()
    render(
      <>
        <Canvas frameIds={['f0', 'f1', 'f2']} />
        <FrameContextMenu />
        <ArrangeSection target={target} />
        <FrameLockButton target={target} />
      </>,
    )

    for (const move of ['front', 'forward', 'backward', 'back'] as const) {
      sent.length = 0
      fireEvent.click(screen.getByTestId(`z-${move}`))
      openMenu('f1')
      fireEvent.click(screen.getByTestId(`frame-menu-${move}`))
      fireEvent.keyDown(window, SHORTCUTS[move])
      expect(sent).toEqual([
        { type: 'reorderFrame', ...target, move },
        { type: 'reorderFrame', ...target, move },
        { type: 'reorderFrame', ...target, move },
      ])
      expect(screen.queryByTestId('frame-menu')).toBeNull()
    }

    sent.length = 0
    fireEvent.click(screen.getByTestId('frame-lock'))
    openMenu('f1')
    fireEvent.click(screen.getByTestId('frame-menu-lock'))
    fireEvent.keyDown(window, { code: 'KeyL', ctrlKey: true, shiftKey: true })
    const lock = { type: 'setFrameLocked', ...target, locked: true }
    expect(sent).toEqual([lock, lock, lock])
    off()
  })

  it('selects the frame and lists only moves that change the stack', () => {
    seed(stackBook(3))
    render(
      <>
        <Canvas frameIds={['f0', 'f1', 'f2']} />
        <FrameContextMenu />
      </>,
    )
    const event = openMenu('f2')
    expect(event).toBe(false)
    expect(getFrameSource()).toEqual({ spreadId: 's', frameId: 'f2' })
    const items = screen
      .getAllByRole('menuitem')
      .map((item) => item.getAttribute('data-testid'))
    expect(items).toEqual([
      'frame-menu-backward',
      'frame-menu-back',
      'frame-menu-lock',
    ])
    expect(screen.getByTestId('frame-menu-back').textContent).toContain(
      'Shift+Ctrl+[',
    )
    expect(screen.getByRole('separator')).toBeTruthy()
    expect(screen.getByTestId('frame-menu-anchor').style.left).toBe('40px')
    expect(screen.getByTestId('frame-menu-anchor').style.top).toBe('50px')
  })

  it('a lone locked frame offers only Unlock', () => {
    seed(stackBook(1, true))
    render(
      <>
        <Canvas frameIds={['f0']} />
        <FrameContextMenu />
      </>,
    )
    openMenu('f0')
    expect(screen.getAllByRole('menuitem')).toHaveLength(1)
    expect(screen.getByTestId('frame-menu-lock').textContent).toContain(
      'Unlock',
    )
    expect(screen.queryByRole('separator')).toBeNull()
  })

  it('ignores a right-click off an editor frame', () => {
    seed(stackBook(2))
    render(
      <>
        <Canvas frameIds={['f0', 'f1']} />
        <FrameContextMenu />
      </>,
    )
    expect(fireEvent.contextMenu(screen.getByText('preview'))).toBe(true)
    expect(fireEvent.contextMenu(document.body)).toBe(true)
    expect(screen.queryByTestId('frame-menu')).toBeNull()
    expect(getFrameSource()).toBeNull()
  })

  it('the keyboard menu opens at the frame corner and Escape closes it', () => {
    seed(stackBook(2))
    render(
      <>
        <Canvas frameIds={['f0', 'f1']} />
        <FrameContextMenu />
      </>,
    )
    vi.spyOn(screen.getByText('f0'), 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 30, y: 10, width: 20, height: 30 }),
    )
    openMenu('f0', { clientX: 0, clientY: 0 })
    const anchor = screen.getByTestId('frame-menu-anchor')
    expect([anchor.style.left, anchor.style.top]).toEqual(['30px', '40px'])
    fireEvent.keyDown(screen.getByTestId('frame-menu'), { key: 'Escape' })
    expect(screen.queryByTestId('frame-menu')).toBeNull()
  })

  it('stays open on a Masters-canvas parent frame and restacks it', () => {
    const frames = stackBook(2).spreads[0]?.frames ?? []
    seed(
      makeBook({
        parents: [{ id: 'm', name: 'Master A', frames, guides: [] }],
      }),
    )
    render(
      <>
        <Canvas frameIds={['f0', 'f1']} spreadId="m" />
        <FrameContextMenu />
      </>,
    )
    openMenu('f0')
    expect(getFrameSource()).toEqual({ spreadId: 'm', frameId: 'f0' })
    expect(screen.getByTestId('frame-menu')).toBeTruthy()
    const dispatch = vi.spyOn(bookStore, 'dispatchBookOp')
    fireEvent.click(screen.getByTestId('frame-menu-front'))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'reorderFrame',
      spreadId: 'm',
      frameId: 'f0',
      move: 'front',
    })
    const after = bookStore.getBookStoreSnapshot().book.parents?.[0]?.frames
    expect(after?.find((frame) => frame.id === 'f0')?.z).toBeGreaterThan(
      after?.find((frame) => frame.id === 'f1')?.z ?? Infinity,
    )
  })

  it('closes when its frame is removed', () => {
    seed(stackBook(2))
    render(
      <>
        <Canvas frameIds={['f0', 'f1']} />
        <FrameContextMenu />
      </>,
    )
    openMenu('f0')
    expect(screen.getByTestId('frame-menu')).toBeTruthy()
    act(() => {
      bookStore.dispatchBookOp({
        type: 'removeFrames',
        spreadId: 's',
        frameIds: ['f0'],
      })
    })
    expect(screen.queryByTestId('frame-menu')).toBeNull()
  })
})

describe('FrameContextMenu on a multi-selection', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    resetFrameSelection()
    resetBookStore()
  })

  const set = { spreadId: 's', frameIds: ['f0', 'f1'] }
  const layerOrder = () =>
    [...(bookStore.getBookStoreSnapshot().book.spreads[0]?.frames ?? [])]
      .sort((a, b) => a.z - b.z)
      .map((frame) => frame.id)

  function renderSet(book: Book) {
    seed(book)
    setFrameSelection(set)
    render(
      <>
        <Canvas frameIds={['f0', 'f1', 'f2', 'f3']} />
        <FrameContextMenu />
      </>,
    )
  }

  it('a right-click inside the set keeps it; z and lock act on the set; Delete N frames', () => {
    renderSet(stackBook(4))
    openMenu('f1')
    expect(getFrameSelection()).toEqual(set)
    expect(
      screen
        .getAllByRole('menuitem')
        .map((item) => item.getAttribute('data-testid')),
    ).toEqual([
      'frame-menu-front',
      'frame-menu-forward',
      'frame-menu-lock',
      'frame-menu-delete',
    ])
    expect(screen.getByTestId('frame-menu-delete').textContent).toContain(
      'Delete 2 frames',
    )

    fireEvent.click(screen.getByTestId('frame-menu-front'))
    expect(layerOrder()).toEqual(['f2', 'f3', 'f0', 'f1'])
    expect(bookStore.getHistorySnapshot().undoLabel).toBe('Reorder frames')
    expect(document.querySelector('.pb-menu-popover')).toBeNull()

    openMenu('f0')
    expect(screen.getByTestId('frame-menu-lock').textContent).toContain('Lock')
    fireEvent.click(screen.getByTestId('frame-menu-lock'))
    const frames = bookStore.getBookStoreSnapshot().book.spreads[0]?.frames
    expect(frames?.map((frame) => frame.locked === true)).toEqual([
      true,
      true,
      false,
      false,
    ])
    expect(bookStore.getHistorySnapshot().undoLabel).toBe('Lock 2 frames')

    openMenu('f0')
    expect(screen.getByTestId('frame-menu-lock').textContent).toContain(
      'Unlock',
    )
    fireEvent.click(screen.getByTestId('frame-menu-delete'))
    expect(layerOrder()).toEqual(['f2', 'f3'])
    expect(bookStore.getHistorySnapshot().undoLabel).toBe('Delete 2 frames')
    expect(screen.queryByTestId('frame-menu')).toBeNull()
  })

  it('offers Lock while any selected frame is unlocked', () => {
    renderSet(stackBook(4, false))
    act(() => {
      bookStore.dispatchBookOp({
        type: 'setFrameLocked',
        spreadId: 's',
        frameId: 'f1',
        locked: true,
      })
    })
    openMenu('f0')
    expect(screen.getByTestId('frame-menu-lock').textContent).toContain('Lock')
    expect(screen.getByTestId('frame-menu-lock').textContent).not.toContain(
      'Unlock',
    )
  })

  it('a right-click outside the set selects that frame alone', () => {
    renderSet(stackBook(4))
    openMenu('f3')
    expect(getFrameSource()).toEqual({ spreadId: 's', frameId: 'f3' })
    expect(screen.queryByTestId('frame-menu-delete')).toBeNull()
  })

  it('a frame with a selected id on another spread is outside the set', () => {
    renderSet(stackBook(4))
    render(<Canvas frameIds={['other']} spreadId="o" />)
    const twin = screen.getByText('other')
    twin.setAttribute('data-frame-id', 'f0')
    fireEvent.contextMenu(twin, { clientX: 40, clientY: 50 })
    expect(getFrameSource()).toEqual({ spreadId: 'o', frameId: 'f0' })
  })

  it('closes when the whole set is removed', () => {
    renderSet(stackBook(4))
    openMenu('f0')
    act(() => {
      bookStore.dispatchBookOp({
        type: 'removeFrames',
        spreadId: 's',
        frameIds: ['f0', 'f1'],
      })
    })
    expect(screen.queryByTestId('frame-menu')).toBeNull()
    expect(document.querySelector('.pb-menu-popover')).toBeNull()
  })
})

describe('FrameContextMenu on parent items and override copies', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    resetFrameSelection()
    resetBookStore()
  })

  // Master A: a logo at 20,4 (24 × 8 mm) and a vertical guide at 100 mm on
  // the middle (two-page, 600 mm) spread; the own frame covers the logo.
  const LOGO = makeFrame({
    id: 'logo',
    rect: { x: 20, y: 4, width: 24, height: 8 },
    z: 1,
  })
  function parentBook(
    parentOverrides?: Book['spreads'][number]['parentOverrides'],
  ) {
    return makeBook({
      parents: [
        {
          id: 'm',
          name: 'Master A',
          frames: [LOGO],
          guides: [{ id: 'g', orientation: 'vertical', offsetMm: 100 }],
        },
      ],
      defaultParentId: 'm',
      spreads: [
        makeSpread({ id: 'p1', frames: [] }),
        makeSpread({
          id: 's',
          frames: [makeFrame({ id: 'own', z: 1 })],
          ...(parentOverrides === undefined ? {} : { parentOverrides }),
        }),
        makeSpread({ id: 'p9', frames: [] }),
      ],
    })
  }

  /** The book spread at 2 px/mm with the copy buttons it paints. */
  function renderSpread(copyIds: string[] = []) {
    render(
      <>
        <div data-testid="spread-view" data-spread-id="s">
          <span>paper</span>
          {copyIds.map((id) => (
            <button
              key={id}
              type="button"
              className="spread-frame"
              data-frame-id={id}
            >
              {id}
            </button>
          ))}
        </div>
        <FrameContextMenu />
      </>,
    )
    vi.spyOn(
      screen.getByTestId('spread-view'),
      'getBoundingClientRect',
    ).mockReturnValue(
      DOMRect.fromRect({ x: 10, y: 20, width: 1200, height: 600 }),
    )
  }

  /** Right-click the paper at spread mm. */
  function openAt(xMm: number, yMm: number) {
    fireEvent.contextMenu(screen.getByText('paper'), {
      clientX: 10 + xMm * 2,
      clientY: 20 + yMm * 2,
    })
  }

  const rows = () =>
    screen
      .getAllByRole('menuitem')
      .map((item) => item.getAttribute('data-testid'))

  it('opens the parent item menu through the own frame; Override selects the copy', () => {
    seed(parentBook())
    renderSpread()
    openAt(32, 8)
    const menu = screen.getByTestId('parent-menu')
    expect(menu.getAttribute('aria-label')).toBe('Parent item')
    expect(rows()).toEqual(['parent-menu-override', 'parent-menu-hide'])
    expect(screen.getByTestId('parent-menu-override').textContent).toBe(
      'Override on this spreadCtrl+Shift+Click',
    )
    const dispatch = vi.spyOn(bookStore, 'dispatchBookOp')
    fireEvent.click(screen.getByTestId('parent-menu-override'))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'overrideParentFrame',
      spreadId: 's',
      parentFrameId: 'logo',
    })
    const copy =
      bookStore.getBookStoreSnapshot().book.spreads[1]?.parentOverrides
        ?.frames?.[0]
    expect(copy?.overridesId).toBe('logo')
    expect(getFrameSource()).toEqual({ spreadId: 's', frameId: copy?.id })
    expect(screen.queryByTestId('parent-menu')).toBeNull()
  })

  it('Hide on this spread hides the logo and keeps the selection', () => {
    seed(parentBook())
    renderSpread()
    openAt(32, 8)
    fireEvent.click(screen.getByTestId('parent-menu-hide'))
    expect(
      bookStore.getBookStoreSnapshot().book.spreads[1]?.parentOverrides,
    ).toEqual({ hiddenIds: ['logo'] })
    expect(getFrameSource()).toBeNull()
  })

  it('shows ⌘⇧Click on a Mac', () => {
    vi.spyOn(globalThis.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    )
    seed(parentBook())
    renderSpread()
    openAt(32, 8)
    expect(screen.getByTestId('parent-menu-override').textContent).toBe(
      'Override on this spread⌘⇧Click',
    )
  })

  it('opens the parent guide menu within 4.5 px of a shown guide', () => {
    seed(parentBook())
    renderSpread()
    openAt(102, 200)
    expect(screen.getByTestId('parent-menu').getAttribute('aria-label')).toBe(
      'Parent guide',
    )
    // The guide override has no press shortcut (PO5 is the guides item).
    expect(screen.getByTestId('parent-menu-override').textContent).toBe(
      'Override on this spread',
    )
    fireEvent.click(screen.getByTestId('parent-menu-override'))
    expect(
      bookStore.getBookStoreSnapshot().book.spreads[1]?.parentOverrides
        ?.guides?.[0],
    ).toMatchObject({ overridesId: 'g', offsetMm: 100 })
    expect(getFrameSource()).toBeNull()

    openAt(150, 200)
    expect(screen.queryByTestId('parent-menu')).toBeNull()
  })

  it('hides a parent guide from its menu', () => {
    seed(parentBook())
    renderSpread()
    openAt(98, 200)
    fireEvent.click(screen.getByTestId('parent-menu-hide'))
    expect(
      bookStore.getBookStoreSnapshot().book.spreads[1]?.parentOverrides,
    ).toEqual({ hiddenIds: ['g'] })
  })

  it('opens nothing off parent items, on a hidden logo or on the Masters canvas', () => {
    seed(parentBook({ hiddenIds: ['logo'] }))
    renderSpread()
    const event = fireEvent.contextMenu(screen.getByText('paper'), {
      clientX: 10 + 32 * 2,
      clientY: 20 + 8 * 2,
    })
    expect(event).toBe(true)
    openAt(300, 200)
    expect(screen.queryByTestId('parent-menu')).toBeNull()
    cleanup()

    seed(parentBook())
    render(
      <>
        <div data-testid="spread-view" data-spread-id="m">
          <span>paper</span>
        </div>
        <FrameContextMenu />
      </>,
    )
    openAt(32, 8)
    expect(screen.queryByTestId('parent-menu')).toBeNull()
  })

  it('a copy reads Reset to parent, Hide on this spread, then Lock, without z rows', () => {
    seed(
      parentBook({
        frames: [{ ...LOGO, id: 'copy', overridesId: 'logo' }],
      }),
    )
    renderSpread(['copy'])
    openMenu('copy')
    expect(getFrameSource()).toEqual({ spreadId: 's', frameId: 'copy' })
    expect(rows()).toEqual([
      'frame-menu-reset-parent',
      'frame-menu-hide-parent',
      'frame-menu-lock',
    ])
    expect(document.querySelectorAll('[role="separator"]')).toHaveLength(1)
    fireEvent.click(screen.getByTestId('frame-menu-reset-parent'))
    expect(
      bookStore.getBookStoreSnapshot().book.spreads[1]?.parentOverrides,
    ).toBeUndefined()
    expect(getFrameSource()).toBeNull()
  })

  it("a right-click on a selected copy's handle peer opens the copy menu", () => {
    seed(
      parentBook({
        frames: [{ ...LOGO, id: 'copy', overridesId: 'logo' }],
      }),
    )
    renderSpread(['copy'])
    const peer = document.createElement('div')
    peer.setAttribute('data-selection-for', 'copy')
    const handle = document.createElement('span')
    handle.setAttribute('data-handle', 'n')
    peer.append(handle)
    screen.getByTestId('spread-view').append(peer)
    fireEvent.contextMenu(handle, { clientX: 40, clientY: 50 })
    expect(screen.getByTestId('frame-menu-reset-parent')).toBeTruthy()
    expect(getFrameSource()).toEqual({ spreadId: 's', frameId: 'copy' })
  })

  it('Hide on a copy removes it and hides its parent item; Lock still locks it', () => {
    seed(
      parentBook({
        frames: [{ ...LOGO, id: 'copy', overridesId: 'logo' }],
      }),
    )
    renderSpread(['copy'])
    openMenu('copy')
    fireEvent.click(screen.getByTestId('frame-menu-lock'))
    expect(
      bookStore.getBookStoreSnapshot().book.spreads[1]?.parentOverrides
        ?.frames?.[0]?.locked,
    ).toBe(true)
    openMenu('copy')
    fireEvent.click(screen.getByTestId('frame-menu-hide-parent'))
    expect(
      bookStore.getBookStoreSnapshot().book.spreads[1]?.parentOverrides,
    ).toEqual({ hiddenIds: ['logo'] })
    expect(getFrameSource()).toBeNull()
  })
})

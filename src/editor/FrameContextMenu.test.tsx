import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FRAMES_PAYLOAD_TYPE,
  type Book,
  type BookOp,
  type Frame,
  type ZMove,
} from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { runAtInterfaceScale } from '../ui/uiScale.test-helpers'
import * as bookStore from './bookStore'
import { resetBookStore } from './bookStore'
import { enterCropMode, exitCropMode, getCropTarget } from './cropMode'
import { FrameContextMenu } from './FrameContextMenu'
import { installArrangeKeys } from './frameArrange'
import { frameClipboardMirror, resetFrameClipboard } from './frameClipboard'
import { ArrangeSection, FrameLockButton } from './FrameSections'
import {
  getFrameSelection,
  getFrameSource,
  resetFrameSelection,
  setFrameSelection,
} from './frameSelection'
import { setLeftPanelTab } from './leftPanelTabStore'
import { endPhotoPick, getPhotoPick } from './photoPick'

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

/** The open menu's popover classes (its width utilities). */
const popoverClass = (testId: string) =>
  screen.getByTestId(testId).closest('.pb-menu-popover')?.className

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

  it('selects the frame; moves that cannot change the stack are disabled', () => {
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
    expect(popoverClass('frame-menu')).toBe('pb-menu-popover w-56')
    const items = screen
      .getAllByRole('menuitem')
      .map((item) => item.getAttribute('data-testid'))
    expect(items).toEqual([
      'frame-menu-place',
      'frame-menu-cut',
      'frame-menu-copy',
      'frame-menu-paste',
      'frame-menu-duplicate',
      'frame-menu-front',
      'frame-menu-forward',
      'frame-menu-backward',
      'frame-menu-back',
      'frame-menu-lock',
      'frame-menu-delete',
    ])
    const disabled = screen
      .getAllByRole('menuitem')
      .filter((item) => item.getAttribute('aria-disabled') === 'true')
      .map((item) => item.getAttribute('data-testid'))
    // No gallery photo to place; nothing copied.
    expect(disabled).toEqual([
      'frame-menu-place',
      'frame-menu-paste',
      'frame-menu-front',
      'frame-menu-forward',
    ])
    expect(screen.getByTestId('frame-menu-back').textContent).toContain(
      'Shift+Ctrl+[',
    )
    expect(screen.getByTestId('frame-menu-delete').textContent).toBe(
      'Delete frameDel',
    )
    // M1: photo · edit · order · lock + delete.
    expect(screen.getAllByRole('separator')).toHaveLength(3)
    // M5: a pointer open highlights no row.
    expect(document.querySelector('[data-focused]')).toBeNull()
    expect(screen.getByTestId('frame-menu-anchor').style.left).toBe('40px')
    expect(screen.getByTestId('frame-menu-anchor').style.top).toBe('50px')
  })

  it('at interface scale 1.5 the anchor is the pointer in app px (÷ 1.5)', () => {
    seed(stackBook(2))
    render(
      <>
        <Canvas frameIds={['f0', 'f1']} />
        <FrameContextMenu />
      </>,
    )
    const restore = runAtInterfaceScale(1.5)
    try {
      openMenu('f0', { clientX: 2431, clientY: 974 })
      const anchor = screen.getByTestId('frame-menu-anchor')
      expect(Number.parseFloat(anchor.style.left)).toBeCloseTo(2431 / 1.5, 3)
      expect(Number.parseFloat(anchor.style.top)).toBeCloseTo(974 / 1.5, 3)
    } finally {
      restore()
    }
  })

  it('a lone locked frame keeps every row, the moves, Place and Cut disabled', () => {
    seed(stackBook(1, true))
    render(
      <>
        <Canvas frameIds={['f0']} />
        <FrameContextMenu />
      </>,
    )
    openMenu('f0')
    expect(screen.getByTestId('frame-menu-lock').textContent).toContain(
      'Unlock',
    )
    // M2: Cut leaves locked frames; Copy, Duplicate and Delete still act.
    const disabled = screen
      .getAllByRole('menuitem')
      .filter((item) => item.getAttribute('aria-disabled') === 'true')
      .map((item) => item.getAttribute('data-testid'))
    expect(disabled).toEqual([
      'frame-menu-place',
      'frame-menu-cut',
      'frame-menu-paste',
      'frame-menu-front',
      'frame-menu-forward',
      'frame-menu-backward',
      'frame-menu-back',
    ])
    expect(screen.getAllByRole('menuitem')).toHaveLength(11)
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
    expect(fireEvent.contextMenu(document)).toBe(true)
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

describe('FrameContextMenu photo pick rows (FM4)', () => {
  afterEach(() => {
    cleanup()
    endPhotoPick()
    setLeftPanelTab('pages')
    resetFrameSelection()
    resetBookStore()
  })

  function photoBook(gallery: string[], frame: Partial<Frame> = {}): Book {
    return makeBook({
      assets: Object.fromEntries(gallery.map((id) => [id, {}])),
      gallery,
      spreads: [
        makeSpread({ id: 's', frames: [makeFrame({ id: 'f0', ...frame })] }),
      ],
    })
  }

  function open(book: Book) {
    seed(book)
    render(
      <>
        <Canvas frameIds={['f0']} />
        <FrameContextMenu />
      </>,
    )
    openMenu('f0')
  }

  it('a filled photo frame offers Replace photo…, which starts the pick', () => {
    open(photoBook(['a', 'b'], { assetId: 'a' }))
    const row = screen.getByTestId('frame-menu-replace')
    expect(row.textContent).toBe('Replace photo…')
    expect(row.hasAttribute('aria-disabled')).toBe(false)
    expect(screen.queryByTestId('frame-menu-place')).toBeNull()
    fireEvent.click(row)
    expect(getPhotoPick()).toEqual({
      spreadId: 's',
      frameId: 'f0',
      kind: 'replace',
    })
    expect(document.querySelector('.pb-menu-popover')).toBeNull()
  })

  it('an empty photo frame offers Place photo…', () => {
    open(photoBook(['a']))
    expect(screen.getByTestId('frame-menu-place').textContent).toBe(
      'Place photo…',
    )
    expect(screen.queryByTestId('frame-menu-replace')).toBeNull()
    fireEvent.click(screen.getByTestId('frame-menu-place'))
    expect(getPhotoPick()?.kind).toBe('place')
  })

  it('an empty filmstrip disables the row', () => {
    open(photoBook([]))
    expect(
      screen.getByTestId('frame-menu-place').getAttribute('aria-disabled'),
    ).toBe('true')
  })

  it('text frames and Masters have no photo row', () => {
    open(photoBook(['a'], { kind: 'text' }))
    expect(screen.getByTestId('frame-menu-lock')).toBeTruthy()
    expect(screen.queryByTestId('frame-menu-place')).toBeNull()
    expect(screen.queryByTestId('frame-menu-replace')).toBeNull()
    cleanup()
    setLeftPanelTab('masters')
    open(photoBook(['a']))
    expect(screen.queryByTestId('frame-menu-place')).toBeNull()
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
    expect(popoverClass('frame-menu')).toBe('pb-menu-popover w-56')
    expect(
      screen
        .getAllByRole('menuitem')
        .map((item) => item.getAttribute('data-testid')),
    ).toEqual([
      'frame-menu-cut',
      'frame-menu-copy',
      'frame-menu-paste',
      'frame-menu-duplicate',
      'frame-menu-front',
      'frame-menu-forward',
      'frame-menu-backward',
      'frame-menu-back',
      'frame-menu-lock',
      'frame-menu-delete',
    ])
    // A set has no photo group; its own z moves stay enabled.
    expect(
      screen.getByTestId('frame-menu-back').getAttribute('aria-disabled'),
    ).toBe('true')
    expect(
      screen.getByTestId('frame-menu-front').hasAttribute('aria-disabled'),
    ).toBe(false)
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
    expect(screen.getByTestId('frame-menu-delete').textContent).toBe(
      'Delete frameDel',
    )
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
  const STAMP = makeFrame({
    id: 'stamp',
    rect: { x: 400, y: 4, width: 24, height: 8 },
    z: 2,
  })
  function parentBook(
    parentOverrides?: Book['spreads'][number]['parentOverrides'],
  ) {
    return makeBook({
      parents: [
        {
          id: 'm',
          name: 'Master A',
          frames: [LOGO, STAMP],
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

  /** Right-click the paper at spread mm; false once the menu took it. */
  function openAt(xMm: number, yMm: number) {
    return fireEvent.contextMenu(screen.getByText('paper'), {
      clientX: 10 + xMm * 2,
      clientY: 20 + yMm * 2,
    })
  }

  const rows = () =>
    screen
      .getAllByRole('menuitem')
      .map((item) => item.getAttribute('data-testid'))

  /** An (empty) override copy: Reset / Hide, photo, edit, Lock. */
  const COPY_ROWS = [
    'frame-menu-reset-parent',
    'frame-menu-hide-parent',
    'frame-menu-place',
    'frame-menu-cut',
    'frame-menu-copy',
    'frame-menu-paste',
    'frame-menu-duplicate',
    'frame-menu-lock',
  ]

  it('opens the parent item menu through the own frame; Override selects the copy', () => {
    // The spread already overrides another parent frame.
    seed(
      parentBook({
        frames: [{ ...STAMP, id: 'stamp-copy', overridesId: 'stamp' }],
      }),
    )
    renderSpread()
    expect(openAt(32, 8)).toBe(false)
    const menu = screen.getByTestId('parent-menu')
    expect(menu.getAttribute('aria-label')).toBe('Parent item')
    // PO4: the menu grows to fit a one-line row; its rows never wrap.
    expect(popoverClass('parent-menu')).toBe('pb-menu-popover w-max min-w-56')
    expect(menu.className).toContain('whitespace-nowrap')
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
    const copies =
      bookStore.getBookStoreSnapshot().book.spreads[1]?.parentOverrides
        ?.frames ?? []
    expect(copies.map((copy) => copy.overridesId)).toEqual(['stamp', 'logo'])
    expect(getFrameSource()).toEqual({
      spreadId: 's',
      frameId: copies[1]?.id,
    })
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
    // PO4: the same two rows as the item menu, press hint included (PO5).
    expect(screen.getByTestId('parent-menu-override').textContent).toBe(
      'Override on this spreadCtrl+Shift+Click',
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

  it('at interface scale 1.5 the 4.5 px guide radius is app px (6.75 screen px)', () => {
    seed(parentBook())
    renderSpread()
    // 3 mm off the guide = 6 screen px: outside 4.5 screen px at 100 %…
    openAt(103, 200)
    expect(screen.queryByTestId('parent-menu')).toBeNull()
    const restore = runAtInterfaceScale(1.5)
    try {
      // …inside 4.5 app px = 6.75 screen px at 150 %.
      openAt(103, 200)
      expect(screen.getByTestId('parent-menu').getAttribute('aria-label')).toBe(
        'Parent guide',
      )
    } finally {
      restore()
    }
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

  it('a copy reads Reset to parent, Hide on this spread, photo, edit, then Lock, without z rows or Delete', () => {
    seed(
      parentBook({
        frames: [{ ...LOGO, id: 'copy', overridesId: 'logo' }],
      }),
    )
    renderSpread(['copy'])
    openMenu('copy')
    expect(getFrameSource()).toEqual({ spreadId: 's', frameId: 'copy' })
    expect(rows()).toEqual(COPY_ROWS)
    expect(document.querySelectorAll('[role="separator"]')).toHaveLength(3)
    fireEvent.click(screen.getByTestId('frame-menu-reset-parent'))
    expect(
      bookStore.getBookStoreSnapshot().book.spreads[1]?.parentOverrides,
    ).toBeUndefined()
    expect(getFrameSource()).toBeNull()
  })

  it('a right-click through the own frame hits a covered copy first and opens its menu', () => {
    seed(
      parentBook({
        frames: [{ ...LOGO, id: 'copy', overridesId: 'logo' }],
      }),
    )
    renderSpread()
    expect(openAt(32, 8)).toBe(false)
    expect(screen.queryByTestId('parent-menu')).toBeNull()
    expect(getFrameSource()).toEqual({ spreadId: 's', frameId: 'copy' })
    expect(rows()).toEqual(COPY_ROWS)
    // A pointer open: no row takes the roving focus.
    expect(
      screen
        .getAllByRole('menuitem')
        .filter((item) => item.getAttribute('tabindex') === '0'),
    ).toEqual([])
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

describe('FrameContextMenu rows and commands (FM3)', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    exitCropMode()
    endPhotoPick()
    resetFrameClipboard()
    resetFrameSelection()
    resetBookStore()
  })

  /** A filled frame f0 (asset a) and an empty f1 on spread s. */
  function filledBook(fit?: Frame['fit']): Book {
    return makeBook({
      assets: { a: {}, b: {} },
      gallery: ['a', 'b'],
      spreads: [
        makeSpread({
          id: 's',
          frames: [
            makeFrame({
              id: 'f0',
              z: 1,
              assetId: 'a',
              ...(fit === undefined ? {} : { fit }),
            }),
            makeFrame({ id: 'f1', z: 2 }),
          ],
        }),
      ],
    })
  }

  /** The canvas inside a pasteboard slot, with its paper (2 px/mm). */
  function renderCanvas(book: Book) {
    seed(book)
    render(
      <>
        <div data-pasteboard-slot="">
          <div data-testid="spread-view" data-spread-id="s">
            <span>paper</span>
            <Canvas frameIds={['f0', 'f1']} />
          </div>
        </div>
        <FrameContextMenu />
      </>,
    )
    vi.spyOn(
      screen.getByTestId('spread-view'),
      'getBoundingClientRect',
    ).mockReturnValue(
      DOMRect.fromRect({ x: 0, y: 0, width: 1200, height: 600 }),
    )
  }

  const frames = () =>
    bookStore.getBookStoreSnapshot().book.spreads[0]?.frames ?? []
  const pick = (id: string) => {
    fireEvent.click(screen.getByTestId(`frame-menu-${id}`))
  }

  it('a filled photo frame has 14 rows in the Spec order', () => {
    renderCanvas(filledBook())
    openMenu('f0')
    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent),
    ).toEqual([
      'Replace photo…',
      'Remove photo',
      'Fit photo to frame',
      'Crop',
      'CutCtrl+X',
      'CopyCtrl+C',
      'PasteCtrl+V',
      'DuplicateCtrl+D',
      'Bring to frontShift+Ctrl+]',
      'Bring forwardCtrl+]',
      'Send backwardCtrl+[',
      'Send to backShift+Ctrl+[',
      'LockCtrl+Shift+L',
      'Delete frameDel',
    ])
    expect(screen.getAllByRole('separator')).toHaveLength(3)
    expect(
      screen.getByTestId('frame-menu-delete').getAttribute('data-variant'),
    ).toBe('destructive')
  })

  it('Fit / Fill, Remove and Crop run the inspector commands', () => {
    renderCanvas(filledBook('fit'))
    openMenu('f0')
    expect(screen.getByTestId('frame-menu-fit').textContent).toBe('Fill frame')
    pick('fit')
    expect(frames()[0]?.fit ?? 'fill').toBe('fill')
    openMenu('f0')
    expect(screen.getByTestId('frame-menu-fit').textContent).toBe(
      'Fit photo to frame',
    )
    pick('fit')
    expect(frames()[0]?.fit).toBe('fit')
    openMenu('f0')
    pick('crop')
    expect(getCropTarget()).toEqual({
      spreadId: 's',
      frameId: 'f0',
      assetId: 'a',
    })
    openMenu('f0')
    pick('remove')
    expect(frames()[0]?.assetId).toBeUndefined()
  })

  it('Copy, Paste, Duplicate, Cut and Delete are one step each', () => {
    renderCanvas(filledBook())
    openMenu('f0')
    pick('copy')
    expect(frameClipboardMirror()?.frames).toHaveLength(1)
    openMenu('f0')
    expect(
      screen.getByTestId('frame-menu-paste').hasAttribute('aria-disabled'),
    ).toBe(false)
    pick('paste')
    expect(frames()).toHaveLength(3)
    expect(bookStore.getHistorySnapshot().undoLabel).toBe('Paste frame')
    // Not in place: the D3 step.
    expect(frames()[2]?.rect.x).toBe((frames()[0]?.rect.x ?? 0) + 5)
    openMenu('f0')
    pick('duplicate')
    expect(frames()).toHaveLength(4)
    openMenu('f1')
    pick('cut')
    expect(frames().map((frame) => frame.id)).not.toContain('f1')
    openMenu('f0')
    pick('delete')
    expect(frames().map((frame) => frame.id)).not.toContain('f0')
    expect(frames()).toHaveLength(2)
  })

  it('menu Copy also puts the frames on the system clipboard, once', () => {
    renderCanvas(filledBook())
    const setData = vi.fn()
    const later = vi.fn()
    /** A copy event as the browser sends it; false when cancelled. */
    const copyEvent = (clipboard: boolean) => {
      const event = new Event('copy', { bubbles: true, cancelable: true })
      if (clipboard) {
        Object.defineProperty(event, 'clipboardData', { value: { setData } })
      }
      return document.dispatchEvent(event)
    }
    const sent: boolean[] = []
    const execCommand = vi.fn(() => {
      sent.push(copyEvent(true))
      return true
    })
    document.addEventListener('copy', later)
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
    })
    try {
      openMenu('f0')
      // Scope left after the menu opened: nothing copied, no clipboard write.
      setLeftPanelTab('masters')
      pick('copy')
      expect(execCommand).not.toHaveBeenCalled()
      setLeftPanelTab('pages')
      openMenu('f0')
      pick('copy')
      expect(execCommand).toHaveBeenCalledWith('copy')
      expect(sent).toEqual([false])
      expect(setData).toHaveBeenCalledWith(
        FRAMES_PAYLOAD_TYPE,
        JSON.stringify(frameClipboardMirror()),
      )
      // Ahead of the editor's own copy listener; then gone.
      expect(later).not.toHaveBeenCalled()
      expect(copyEvent(false)).toBe(true)
      expect(later).toHaveBeenCalledTimes(1)
      // No clipboardData on the event: no throw.
      execCommand.mockImplementation(() => copyEvent(false))
      openMenu('f0')
      pick('copy')
      expect(setData).toHaveBeenCalledTimes(1)
    } finally {
      setLeftPanelTab('pages')
      Reflect.deleteProperty(document, 'execCommand')
      document.removeEventListener('copy', later)
    }
  })

  it('a click lands at the pointer unless both coordinates are 0 or a menu key came first', () => {
    seed(stackBook(1))
    render(
      <>
        <Canvas frameIds={['f0']} />
        <FrameContextMenu />
      </>,
    )
    vi.spyOn(screen.getByText('f0'), 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 30, y: 10, width: 20, height: 30 }),
    )
    const anchorAfter = (point: { clientX: number; clientY: number }) => {
      openMenu('f0', point)
      const anchor = screen.getByTestId('frame-menu-anchor')
      const at = [anchor.style.left, anchor.style.top]
      fireEvent.keyDown(screen.getByTestId('frame-menu'), { key: 'Escape' })
      return at
    }
    expect(anchorAfter({ clientX: 0, clientY: 50 })).toEqual(['0px', '50px'])
    expect(anchorAfter({ clientX: 40, clientY: 0 })).toEqual(['40px', '0px'])
    fireEvent.keyDown(window, { key: 'ContextMenu' })
    expect(anchorAfter({ clientX: 40, clientY: 25 })).toEqual(['30px', '40px'])
    // The key flag is one-shot; other keys (Shift+A, F10) are no menu key.
    expect(anchorAfter({ clientX: 40, clientY: 25 })).toEqual(['40px', '25px'])
    fireEvent.keyDown(window, { key: 'A', shiftKey: true })
    expect(anchorAfter({ clientX: 40, clientY: 25 })).toEqual(['40px', '25px'])
    fireEvent.keyDown(window, { key: 'F10' })
    expect(anchorAfter({ clientX: 40, clientY: 25 })).toEqual(['40px', '25px'])
  })

  it('names the menu Frame or Frames and closes when the frame goes', () => {
    renderCanvas(filledBook())
    openMenu('f0')
    expect(screen.getByTestId('frame-menu').getAttribute('aria-label')).toBe(
      'Frame',
    )
    expect(
      screen.getByTestId('frame-menu-copy').getAttribute('data-variant'),
    ).toBe('default')
    act(() => {
      bookStore.dispatchBookOp({
        type: 'removeFrames',
        spreadId: 's',
        frameIds: ['f0'],
      })
    })
    expect(document.querySelector('.pb-menu-popover')).toBeNull()
    seed(filledBook())
    setFrameSelection({ spreadId: 's', frameIds: ['f0', 'f1'] })
    openMenu('f1')
    expect(screen.getByTestId('frame-menu').getAttribute('aria-label')).toBe(
      'Frames',
    )
  })

  // DOM focus itself is pinned in e2e (jsdom defers it by input modality).
  it('the keyboard open puts focus on the first enabled row', () => {
    seed(stackBook(1, true))
    render(
      <>
        <Canvas frameIds={['f0']} />
        <FrameContextMenu />
      </>,
    )
    vi.spyOn(screen.getByText('f0'), 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 30, y: 10, width: 20, height: 30 }),
    )
    // Chromium's Shift+F10 contextmenu carries a point inside the frame.
    fireEvent.keyDown(screen.getByText('f0'), { key: 'F10', shiftKey: true })
    openMenu('f0', { clientX: 40, clientY: 25 })
    const anchor = screen.getByTestId('frame-menu-anchor')
    expect([anchor.style.left, anchor.style.top]).toEqual(['30px', '40px'])
    // Place and Cut are disabled on a locked frame: Copy is first.
    const roving = screen
      .getAllByRole('menuitem')
      .filter((item) => item.getAttribute('tabindex') === '0')
    expect(roving.map((item) => item.getAttribute('data-testid'))).toEqual([
      'frame-menu-copy',
    ])
  })

  it('a pointer open puts focus on no row', () => {
    renderCanvas(filledBook())
    openMenu('f0')
    expect(
      screen
        .getAllByRole('menuitem')
        .filter((item) => item.getAttribute('tabindex') === '0'),
    ).toEqual([])
  })

  it('shows macOS glyphs for the keys', () => {
    vi.spyOn(globalThis.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    )
    renderCanvas(filledBook())
    openMenu('f0')
    expect(screen.getByTestId('frame-menu-front').textContent).toBe(
      'Bring to front⇧⌘]',
    )
    expect(screen.getByTestId('frame-menu-delete').textContent).toBe(
      'Delete frame⌫',
    )
  })

  it('the paper opens the page menu only with frames copied', () => {
    renderCanvas(filledBook())
    const openPaper = () =>
      fireEvent.contextMenu(screen.getByText('paper'), {
        clientX: 400,
        clientY: 300,
      })
    expect(openPaper()).toBe(true)
    expect(screen.queryByTestId('page-menu')).toBeNull()

    openMenu('f0')
    pick('copy')
    // Off the pasteboard (previews): no page menu.
    const slot = document.querySelector('[data-pasteboard-slot]')
    slot?.removeAttribute('data-pasteboard-slot')
    expect(openPaper()).toBe(true)
    slot?.setAttribute('data-pasteboard-slot', '')
    // Crop ends: paste must not target the cropped frame's selection.
    enterCropMode('s', 'f0')
    expect(openPaper()).toBe(false)
    expect(getFrameSource()).toBeNull()
    expect(getCropTarget()).toBeNull()
    expect(popoverClass('page-menu')).toBe('pb-menu-popover w-max min-w-56')
    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent),
    ).toEqual(['PasteCtrl+V', 'Paste in placeShift+Ctrl+V'])
    fireEvent.click(screen.getByTestId('page-menu-paste-in-place'))
    expect(frames()).toHaveLength(3)
    expect(frames()[2]?.rect).toEqual(frames()[0]?.rect)
    expect(getFrameSelection()?.frameIds).toEqual([frames()[2]?.id])

    expect(openPaper()).toBe(false)
    fireEvent.click(screen.getByTestId('page-menu-paste'))
    expect(frames()).toHaveLength(4)
    expect(frames()[3]?.rect.x).toBe((frames()[0]?.rect.x ?? 0) + 5)
  })

  it('the paper on Masters keeps the browser menu', () => {
    renderCanvas(filledBook())
    openMenu('f0')
    pick('copy')
    setLeftPanelTab('masters')
    try {
      expect(
        fireEvent.contextMenu(screen.getByText('paper'), {
          clientX: 400,
          clientY: 300,
        }),
      ).toBe(true)
    } finally {
      setLeftPanelTab('pages')
    }
  })
})

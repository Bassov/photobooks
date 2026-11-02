import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Book, BookOp, ZMove } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import * as bookStore from './bookStore'
import { resetBookStore } from './bookStore'
import { FrameContextMenu } from './FrameContextMenu'
import { installArrangeKeys } from './frameArrange'
import { ArrangeSection, FrameLockButton } from './FrameSections'
import { getFrameSource, resetFrameSelection } from './frameSelection'

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
      'Ctrl+Shift+[',
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

import { cleanup, render, screen } from '@testing-library/react'
import assert from 'node:assert/strict'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyBookOp,
  resolveSpread,
  type Book,
  type ResolvedItem,
} from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { SpreadView, type FrameControl } from './SpreadView'

const previewUrlFor = (assetId: string): string | undefined =>
  assetId === 'logo-asset' ? 'data:image/svg+xml,logo' : undefined

/** Spread s1 (one frame, z 1) using parent p1 (one logo frame, z 99) when `applied`. */
function book(applied: boolean): Book {
  return makeBook({
    parents: [
      {
        id: 'p1',
        name: 'Master A',
        frames: [makeFrame({ id: 'logo', z: 99, assetId: 'logo-asset' })],
        guides: [],
      },
    ],
    spreads: [
      makeSpread({
        id: 's1',
        ...(applied ? { parentId: 'p1' } : {}),
        frames: [makeFrame({ id: 'own', z: 1 })],
      }),
    ],
  })
}

function paint(
  target: Book,
  thumb = false,
  pxPerMm = 1,
  pressed: readonly string[] = [],
  pressedControl: Partial<FrameControl> = {},
) {
  const resolved = resolveSpread(target, 's1')
  assert(resolved !== undefined, 'expected resolved spread')
  const control: FrameControl = { label: 'Frame', onActivate: vi.fn() }
  const frameControlFor = vi.fn<(item: ResolvedItem) => FrameControl>((item) =>
    pressed.includes(item.frameId)
      ? { ...control, ...pressedControl, pressed: true }
      : control,
  )
  const view = render(
    <SpreadView
      spreadId="s1"
      resolved={resolved}
      previewUrlFor={previewUrlFor}
      pxPerMm={pxPerMm}
      {...(thumb ? { thumb } : { frameControlFor })}
    />,
  )
  return { ...view, frameControlFor }
}

describe('SpreadView parent layer', () => {
  afterEach(cleanup)

  it('paints parent items in an inert layer before the spread frames, below them', () => {
    const { frameControlFor } = paint(book(true))

    const layer = screen.getByTestId('parent-layer')
    const root = screen.getByTestId('spread-view')

    expect(root.firstElementChild).toBe(layer)
    expect(layer.style.zIndex).toBe('0')
    expect(layer.style.pointerEvents).toBe('none')
    expect(layer.style.position).toBe('absolute')
    expect(layer.querySelectorAll('.spread-frame')).toHaveLength(1)
    expect(layer.querySelector('[data-frame-id]')).toBeNull()
    expect(layer.querySelector('button')).toBeNull()
    expect(layer.querySelector('img')?.getAttribute('src')).toBe(
      'data:image/svg+xml,logo',
    )
    expect(
      screen.getAllByTestId('spread-frame').map((el) => el.dataset.frameId),
    ).toEqual(['own'])
    expect(frameControlFor.mock.calls.map(([item]) => item.frameId)).toEqual([
      'own',
    ])
  })

  it('paints no parent layer for a spread without a parent', () => {
    paint(book(false))

    expect(screen.queryByTestId('parent-layer')).toBeNull()
    expect(screen.getAllByTestId('spread-frame')).toHaveLength(1)
  })

  it('keeps the parent layer in list thumbs, without test ids', () => {
    const { container } = paint(book(true), true)

    expect(
      container.querySelectorAll('.spread-view-parent-layer .spread-frame'),
    ).toHaveLength(1)
    expect(container.querySelector('[data-testid]')).toBeNull()
    expect(container.querySelector('[data-parent-item]')).toBeNull()
  })

  it('marks inherited items with the dashed outline on the editor canvas only', () => {
    paint(book(true))
    const item = screen.getByTestId('parent-layer').firstElementChild

    expect(item?.getAttribute('data-parent-item')).toBe('true')
    expect(item?.hasAttribute('data-camera-frame')).toBe(true)
    cleanup()

    const resolved = resolveSpread(book(true), 's1')
    assert(resolved !== undefined, 'expected resolved spread')
    // Preview: no frame controls, so no editor chrome.
    render(
      <SpreadView
        spreadId="s1"
        resolved={resolved}
        previewUrlFor={previewUrlFor}
      />,
    )
    expect(
      screen.getByTestId('parent-layer').querySelector('[data-parent-item]'),
    ).toBeNull()
  })
})

/** `book(true)` with the logo overridden by local copy `copy-1`. */
function overridden(): Book {
  return applyBookOp(book(true), {
    type: 'overrideParentFrame',
    spreadId: 's1',
    parentFrameId: 'logo',
    id: 'copy-1',
  })
}

describe('SpreadView override copies', () => {
  afterEach(cleanup)

  it('paints a copy as a control in the parent layer, under the spread frames, with the badge', () => {
    const { frameControlFor } = paint(overridden())

    const layer = screen.getByTestId('parent-layer')
    const copy = layer.querySelector('button.spread-frame')
    expect(copy?.getAttribute('data-frame-id')).toBe('copy-1')
    expect(copy?.getAttribute('data-override')).toBe('true')
    expect(copy?.hasAttribute('data-parent-item')).toBe(false)
    expect(layer.style.pointerEvents).toBe('none')
    expect(root().firstElementChild).toBe(layer)
    expect(frameControlFor.mock.calls.map(([item]) => item.frameId)).toEqual([
      'copy-1',
      'own',
    ])
    const badge = screen.getByTestId('override-badge')
    expect(copy?.contains(badge)).toBe(true)
    expect(badge.dataset.fit).toBe('full')
    expect(badge.textContent).toBe('override')
    expect(badge.hasAttribute('aria-label')).toBe(false)
    expect(badge.hasAttribute('title')).toBe(false)
    expect(badge.querySelector('[data-glyph="unlink2"]')).not.toBeNull()
    expect(copy?.getAttribute('aria-label')).toBe('Frame, override')
    // The own frame is not a copy.
    const own = root().querySelector('[data-frame-id="own"]')
    expect(own?.hasAttribute('data-override')).toBe(false)
    expect(own?.getAttribute('aria-label')).toBe('Frame')
  })

  it('shows the icon-only badge on a narrow copy and none on a short one', () => {
    paint(overridden(), false, 0.3)
    const badge = screen.getByTestId('override-badge')
    expect(badge.dataset.fit).toBe('icon')
    expect(badge.getAttribute('aria-label')).toBe('Override')
    cleanup()

    // Still mounted (CSS hides it), so a live zoom-in can show it again.
    paint(overridden(), false, 0.2)
    expect(screen.getByTestId('override-badge').dataset.fit).toBe('none')
  })

  it('puts a selected copy ring and handles above the spread frames, not in the parent layer', () => {
    paint(overridden(), false, 1, ['copy-1'])
    const copy = screen.getByTestId('parent-layer').querySelector('button')
    const peer = screen.getByTestId('copy-selection')

    expect(copy?.getAttribute('aria-pressed')).toBe('true')
    expect(copy?.querySelector('[data-handle]')).toBeNull()
    expect(peer.parentElement).toBe(root())
    expect(peer.dataset.selectionFor).toBe('copy-1')
    expect(peer.style.width).toBe(copy?.style.width)
    expect(peer.style.height).toBe(copy?.style.height)
    expect(peer.style.left).toBe(copy?.style.left)
    expect(peer.style.top).toBe(copy?.style.top)
    expect(peer.style.transform).toBe('')
    expect(
      Array.from(peer.querySelectorAll('[data-handle]'), (el) =>
        el.getAttribute('data-handle'),
      ),
    ).toEqual(['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'])
  })

  it('keeps own frame handles on the frame and draws no peer for it', () => {
    paint(overridden(), false, 1, ['own'])
    const own = root().querySelector('button[data-frame-id="own"]')

    expect(screen.queryByTestId('copy-selection')).toBeNull()
    expect(own?.querySelectorAll('[data-handle]')).toHaveLength(8)
  })

  it('draws a locked copy ring above the frames without handles', () => {
    const locked = applyBookOp(overridden(), {
      type: 'setFrameLocked',
      spreadId: 's1',
      frameId: 'copy-1',
      locked: true,
    })
    paint(locked, false, 1, ['copy-1'])

    expect(screen.getByTestId('copy-selection').children).toHaveLength(0)
  })

  it('draws no peer while a set or a cropping copy is selected', () => {
    paint(overridden(), false, 1, ['copy-1', 'own'])
    expect(screen.getByTestId('group-box')).toBeDefined()
    expect(screen.queryByTestId('copy-selection')).toBeNull()
    cleanup()

    paint(overridden(), false, 1, ['copy-1'], { cropActive: true })
    expect(screen.queryByTestId('copy-selection')).toBeNull()
  })

  it('draws an editing copy ring without handles', () => {
    paint(overridden(), false, 1, ['copy-1'], { editing: true })

    expect(screen.getByTestId('copy-selection').children).toHaveLength(0)
  })

  it('turns the peer with a rotated copy', () => {
    const rotated = applyBookOp(overridden(), {
      type: 'rotateFrame',
      spreadId: 's1',
      frameId: 'copy-1',
      rotationDeg: 30,
    })
    paint(rotated, false, 1, ['copy-1'])
    const copy = screen.getByTestId('parent-layer').querySelector('button')

    expect(screen.getByTestId('copy-selection').style.transform).toBe(
      'rotate(30deg)',
    )
    expect(copy?.style.transform).toBe('rotate(30deg)')
  })

  it('gives the badge the copy layout px for the live zoom refit', () => {
    paint(overridden())
    const copy = screen.getByTestId('parent-layer').querySelector('button')
    const badge = screen.getByTestId('override-badge')
    expect(badge.hasAttribute('data-camera-frame')).toBe(true)
    expect(Number(badge.dataset.badgeW)).toBeCloseTo(
      Number.parseFloat(copy?.style.width ?? ''),
    )
    expect(Number(badge.dataset.badgeH)).toBeCloseTo(
      Number.parseFloat(copy?.style.height ?? ''),
    )
  })

  it('paints a copy inert and without the badge in list thumbs', () => {
    const { container } = paint(overridden(), true)

    expect(container.querySelector('button')).toBeNull()
    expect(container.querySelector('.spread-frame-override')).toBeNull()
    expect(
      container.querySelectorAll('.spread-view-parent-layer .spread-frame'),
    ).toHaveLength(1)
  })
})

function root(): HTMLElement {
  return screen.getByTestId('spread-view')
}

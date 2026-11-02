import { cleanup, render, screen } from '@testing-library/react'
import assert from 'node:assert/strict'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveSpread, type Book, type ResolvedItem } from '../core'
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

function paint(target: Book, thumb = false) {
  const resolved = resolveSpread(target, 's1')
  assert(resolved !== undefined, 'expected resolved spread')
  const control: FrameControl = { label: 'Frame', onActivate: vi.fn() }
  const frameControlFor = vi.fn<(item: ResolvedItem) => FrameControl>(
    () => control,
  )
  const view = render(
    <SpreadView
      spreadId="s1"
      resolved={resolved}
      previewUrlFor={previewUrlFor}
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
  })
})

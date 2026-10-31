import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveSpread } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { SpreadView } from './SpreadView'

afterEach(cleanup)

// 2540 px over a 254 mm frame at zoom 2 = 127 dpi.
const book = (zoom: number) =>
  makeBook({
    assets: { a: { widthPx: 2540, heightPx: 2540 } },
    spreads: [
      makeSpread({
        frames: [
          makeFrame({
            rect: { x: 0, y: 0, width: 254, height: 254 },
            assetId: 'a',
            crop: { zoom, center: { x: 0.5, y: 0.5 } },
          }),
        ],
      }),
    ],
  })

function view(
  zoom: number,
  opts: { control?: boolean; thumb?: boolean; badge?: boolean },
) {
  const resolved = resolveSpread(book(zoom), 'spread-1')
  if (resolved === undefined) {
    throw new Error('expected resolved spread')
  }
  return render(
    <SpreadView
      spreadId="spread-1"
      resolved={resolved}
      previewUrlFor={() => 'blob:a'}
      thumb={opts.thumb ?? false}
      lowDpiBadge={opts.badge ?? true}
      {...(opts.control === false
        ? {}
        : { frameControlFor: () => ({ label: 'Frame', onActivate: vi.fn() }) })}
    />,
  )
}

describe('SpreadView dpi badge', () => {
  it('shows one badge with the dpi on a low-resolution frame', () => {
    view(2, {})
    const badge = screen.getByTestId('dpi-badge')
    expect(badge.textContent).toBe('127 dpi')
    expect(badge.dataset.level).toBe('min')
    // Screen px through a live zoom (usePasteboardCamera --cam-scale).
    expect(badge.dataset.cameraFrame).toBe('')
  })

  it('shows the warn level between min and warn', () => {
    view(1.5, {})
    expect(screen.getByTestId('dpi-badge').dataset.level).toBe('warn')
  })

  it('clears when the photo is zoomed back out', () => {
    view(1, {})
    expect(screen.queryByTestId('dpi-badge')).toBeNull()
  })

  it('never paints in a control-less (preview) view or a thumbnail', () => {
    view(2, { control: false })
    expect(screen.queryByTestId('dpi-badge')).toBeNull()
    cleanup()
    view(2, { thumb: true })
    expect(screen.queryByTestId('dpi-badge')).toBeNull()
    cleanup()
    view(2, { badge: false })
    expect(screen.queryByTestId('dpi-badge')).toBeNull()
  })
})

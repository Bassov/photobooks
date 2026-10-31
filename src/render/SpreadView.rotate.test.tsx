import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveSpread } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { PHOTO_LAYER_ATTR } from './photoLayout'
import { SpreadView } from './SpreadView'

afterEach(cleanup)

function view(crop?: {
  quarterTurns?: 1 | 2 | 3
  straightenDeg?: number
  flipH?: boolean
  flipV?: boolean
}) {
  const book = makeBook({
    assets: { a: {} },
    spreads: [
      makeSpread({
        frames: [
          makeFrame({
            rect: { x: 0, y: 0, width: 400, height: 200 },
            assetId: 'a',
            crop: { zoom: 1, center: { x: 0.5, y: 0.5 }, ...crop },
          }),
        ],
      }),
    ],
  })
  const resolved = resolveSpread(book, 'spread-1', { getAspectRatio: () => 2 })
  if (resolved === undefined) throw new Error('expected resolved spread')
  return render(
    <SpreadView
      spreadId="spread-1"
      resolved={resolved}
      previewUrlFor={() => 'blob:a'}
    />,
  )
}

describe('SpreadView turned photos', () => {
  it('keeps the percent box and no layer for an unturned photo', () => {
    const { container } = view()
    const img = screen.getByTestId('spread-frame-image')
    expect(img.style.left).toBe('0%')
    expect(img.style.transform).toBe('')
    expect(container.querySelector(`[${PHOTO_LAYER_ATTR}]`)).toBeNull()
  })

  it('rotates the image about the frame center inside a preview layer', () => {
    const { container } = view({ straightenDeg: 10 })
    const img = screen.getByTestId('spread-frame-image')
    expect(img.style.transform).toContain('rotate(10deg)')
    expect(img.parentElement?.hasAttribute(PHOTO_LAYER_ATTR)).toBe(true)
    expect(container.querySelectorAll(`[${PHOTO_LAYER_ATTR}]`)).toHaveLength(1)
  })

  it('mirrors a flipped photo inside a preview layer (kit canvas.tsx:35)', () => {
    const { container } = view({ flipH: true })
    const img = screen.getByTestId('spread-frame-image')
    expect(img.style.transform).toContain('scale(-1, 1)')
    expect(img.parentElement?.hasAttribute(PHOTO_LAYER_ATTR)).toBe(true)
    expect(container.querySelectorAll(`[${PHOTO_LAYER_ATTR}]`)).toHaveLength(1)
  })

  it('mirrors vertically and on both axes', () => {
    const { unmount } = view({ flipV: true })
    expect(screen.getByTestId('spread-frame-image').style.transform).toContain(
      'scale(1, -1)',
    )
    unmount()
    view({ flipH: true, flipV: true })
    expect(screen.getByTestId('spread-frame-image').style.transform).toContain(
      'scale(-1, -1)',
    )
  })

  it('lays a quarter-turned photo out in source orientation', () => {
    view({ quarterTurns: 1 })
    const img = screen.getByTestId('spread-frame-image')
    expect(img.style.transform).toContain('rotate(90deg)')
    // Frame 200 x 100 px; turned, the 2:1 photo is 100 x 200 per 100 px of
    // width, so covering the frame needs 200 px across: the source box is
    // 400 px wide (now vertical) and 200 px tall (now horizontal).
    expect(img.style.width).toBe('400px')
    expect(img.style.height).toBe('200px')
  })
})

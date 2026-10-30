import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveSpread } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { SPREAD_PX_PER_MM } from './frameBox'
import { SpreadView } from './SpreadView'

const PREVIEW =
  'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22/%3E'

function paint(
  patch: Record<string, unknown>,
  settings: { pageColor?: string } = {},
) {
  const book = makeBook({
    settings,
    assets: { a: {} },
    gallery: ['a'],
    spreads: [
      makeSpread({
        frames: [{ ...makeFrame({ assetId: 'a' }), ...patch }],
      }),
    ],
  })
  const resolved = resolveSpread(book, 'spread-1')
  if (resolved === undefined) {
    throw new Error('unresolved')
  }
  return render(
    <SpreadView
      spreadId="spread-1"
      resolved={resolved}
      previewUrlFor={() => PREVIEW}
    />,
  )
}

afterEach(cleanup)

describe('SpreadView frame look', () => {
  it('paints the book page colour as the spread background', () => {
    paint({}, { pageColor: '#f4f1ea' })
    expect(screen.getByTestId('spread-view').style.background).toBe('#f4f1ea')
  })

  it('leaves the background alone without a page colour', () => {
    paint({})
    expect(screen.getByTestId('spread-view').style.background).toBe('')
  })

  it('prints the caption 1.5 mm under the frame', () => {
    paint({ caption: 'By the sea' })
    const caption = screen.getByTestId('frame-caption')
    expect(caption.textContent).toBe('By the sea')
    expect(caption.style.top).toBe(
      `calc(100% + ${String(1.5 * SPREAD_PX_PER_MM)}px)`,
    )
  })

  it('has no caption node without a caption', () => {
    paint({})
    expect(screen.queryByTestId('frame-caption')).toBeNull()
  })

  it('applies adjust as a CSS filter on the photo', () => {
    paint({ adjust: { brightness: 50, contrast: -50, saturation: 100 } })
    const image = screen.getByTestId('spread-frame-image')
    expect(image.style.filter).toBe('brightness(1.5) contrast(0.5) saturate(2)')
  })

  it('sets no filter on an untouched photo', () => {
    paint({})
    expect(screen.getByTestId('spread-frame-image').style.filter).toBe('')
  })
})

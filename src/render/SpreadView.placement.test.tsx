import { cleanup, render } from '@testing-library/react'
import { afterEach, expect } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { addSpread, placeAsset, resolveSpread } from '../core'
import { makeBook } from '../core/testing/fixtures'
import { SpreadView } from './SpreadView'

afterEach(cleanup)

function paintedImageStyle(thumb: boolean, aspect: number, pxPerMm: number) {
  let book = makeBook({
    id: 'p',
    spreads: [],
    gallery: ['a'],
    assets: { a: {} },
  })
  book = addSpread(book, { id: 's0' })
  const frame = book.spreads[0]?.frames[0]
  if (frame === undefined) {
    throw new Error('expected a frame')
  }
  book = placeAsset(book, 's0', frame.id, 'a')
  const resolved = resolveSpread(book, 's0', { getAspectRatio: () => aspect })
  if (resolved === undefined) {
    throw new Error('expected a resolved spread')
  }
  const { container, unmount } = render(
    <SpreadView
      spreadId="s0"
      resolved={resolved}
      pxPerMm={pxPerMm}
      thumb={thumb}
      previewUrlFor={() => 'blob:photo'}
    />,
  )
  const img = container.querySelector('img')
  const style = img?.getAttribute('style') ?? ''
  unmount()
  return style
}

test.prop(
  [
    fc.double({ min: 0.2, max: 5, noNaN: true }),
    fc.double({ min: 0.05, max: 3, noNaN: true }),
  ],
  { numRuns: Number(process.env.FC_NUM_RUNS ?? 25) },
)(
  'a Pages thumb paints the photo with the same crop box as the canvas',
  (aspect, thumbPxPerMm) => {
    const canvas = paintedImageStyle(false, aspect, 0.5)
    const thumb = paintedImageStyle(true, aspect, thumbPxPerMm)
    expect(canvas).not.toBe('')
    expect(thumb).toBe(canvas)
  },
)

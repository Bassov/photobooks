import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveSpread } from '../core'
import { makeBook, makeBookWithAsset } from '../core/testing/fixtures'
import { frameBox, imageCropBox, SPREAD_PX_PER_MM } from './frameBox'
import { SpreadView } from './SpreadView'

const previewUrlFor = (assetId: string): string | undefined =>
  assetId === 'asset-1'
    ? 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22/%3E'
    : undefined

describe('SpreadView', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows a placeholder and no image for an empty frame', () => {
    const book = makeBook()
    const resolved = resolveSpread(book, 'spread-1')
    if (resolved === undefined) {
      throw new Error('expected resolved spread')
    }

    render(
      <SpreadView
        spreadId="spread-1"
        resolved={resolved}
        previewUrlFor={previewUrlFor}
      />,
    )

    expect(screen.getByTestId('spread-frame-placeholder')).toBeTruthy()
    expect(screen.queryByTestId('spread-frame-image')).toBeNull()
  })

  it('shows an async image framed to the source crop when a preview exists', () => {
    const book = makeBook()
    const spread = book.spreads[0]
    const frame = spread?.frames[0]
    if (spread === undefined || frame === undefined) {
      throw new Error('expected a frame')
    }
    const placed = {
      ...book,
      assets: { 'asset-1': {} },
      gallery: ['asset-1'],
      spreads: [
        {
          ...spread,
          frames: [
            {
              ...frame,
              assetId: 'asset-1',
              crop: { zoom: 2, center: { x: 0.5, y: 0.5 } },
            },
          ],
        },
      ],
    }
    const resolved = resolveSpread(placed, 'spread-1', {
      getAspectRatio: () => 2,
    })
    const item = resolved?.items[0]
    if (resolved === undefined || item?.sourceCropRect === undefined) {
      throw new Error('expected a cropped item')
    }

    render(
      <SpreadView
        spreadId="spread-1"
        resolved={resolved}
        previewUrlFor={previewUrlFor}
      />,
    )

    const image = screen.getByTestId('spread-frame-image')
    const crop = imageCropBox(item.sourceCropRect)
    expect(image.getAttribute('decoding')).toBe('async')
    expect(image.hasAttribute('data-tier')).toBe(false)
    expect(image.getAttribute('alt')).toBe('')
    expect(image.style.left).toBe(crop.left)
    expect(image.style.top).toBe(crop.top)
    expect(image.style.width).toBe(crop.width)
    expect(image.style.height).toBe(crop.height)
    expect(screen.queryByTestId('spread-frame-placeholder')).toBeNull()

    const box = frameBox(item.rectMm)
    const frameNode = screen.getByTestId('spread-frame')
    expect(frameNode.style.left).toBe(`${String(box.left)}px`)
    expect(frameNode.style.top).toBe(`${String(box.top)}px`)
    expect(frameNode.style.width).toBe(`${String(box.width)}px`)
    expect(frameNode.style.height).toBe(`${String(box.height)}px`)
  })

  it('keeps a placeholder when the asset has no preview URL', () => {
    const book = makeBook()
    const spread = book.spreads[0]
    const frame = spread?.frames[0]
    if (spread === undefined || frame === undefined) {
      throw new Error('expected a frame')
    }
    const placed = {
      ...book,
      assets: { 'asset-missing': {} },
      gallery: ['asset-missing'],
      spreads: [
        {
          ...spread,
          frames: [{ ...frame, assetId: 'asset-missing' }],
        },
      ],
    }
    const resolved = resolveSpread(placed, 'spread-1')
    if (resolved === undefined) {
      throw new Error('expected resolved spread')
    }

    render(
      <SpreadView
        spreadId="spread-1"
        resolved={resolved}
        previewUrlFor={previewUrlFor}
      />,
    )

    expect(screen.getByTestId('spread-frame-placeholder')).toBeTruthy()
    expect(screen.queryByTestId('spread-frame-image')).toBeNull()
  })

  it('paints a vertical page cut on an interior spread', () => {
    const book = makeBook({
      spreads: [
        { id: 's0', frames: [] },
        { id: 's1', frames: [] },
        { id: 's2', frames: [] },
      ],
    })
    const resolved = resolveSpread(book, 's1')
    if (resolved === undefined) {
      throw new Error('expected resolved spread')
    }

    render(
      <SpreadView
        spreadId="s1"
        resolved={resolved}
        previewUrlFor={previewUrlFor}
      />,
    )

    const cut = screen.getByTestId('spread-page-cut')
    expect(cut.getAttribute('data-orientation')).toBe('vertical')
    expect(cut.getAttribute('aria-hidden')).toBe('true')
    expect(cut.style.left).toBe(
      `${String(book.settings.trim.widthMm * SPREAD_PX_PER_MM)}px`,
    )
  })

  it('sizes frames with the camera px per mm', () => {
    const book = makeBook()
    const spread = book.spreads[0]
    if (spread === undefined) {
      throw new Error('expected spread')
    }
    const resolved = resolveSpread(book, spread.id)
    if (resolved === undefined) {
      throw new Error('expected resolved spread')
    }
    const pxPerMm = SPREAD_PX_PER_MM * 2

    render(
      <SpreadView
        spreadId={spread.id}
        resolved={resolved}
        previewUrlFor={() => undefined}
        pxPerMm={pxPerMm}
      />,
    )

    expect(screen.getByTestId('spread-view').style.width).toBe(
      `${String(resolved.spreadWidthMm * pxPerMm)}px`,
    )
  })

  it('keeps a plain frame when no control is provided', () => {
    const book = makeBook()
    const resolved = resolveSpread(book, 'spread-1')
    if (resolved === undefined) {
      throw new Error('expected resolved spread')
    }

    render(
      <SpreadView
        spreadId="spread-1"
        resolved={resolved}
        previewUrlFor={previewUrlFor}
      />,
    )

    expect(screen.getByTestId('spread-frame').tagName).toBe('DIV')
  })

  it('calls onActivate from the frame button', () => {
    const book = makeBook()
    const resolved = resolveSpread(book, 'spread-1')
    if (resolved === undefined) {
      throw new Error('expected resolved spread')
    }
    const onActivate = vi.fn()

    render(
      <SpreadView
        spreadId="spread-1"
        resolved={resolved}
        previewUrlFor={previewUrlFor}
        frameControlFor={() => ({ label: 'Place photo', onActivate })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Place photo' }))
    expect(onActivate).toHaveBeenCalledOnce()
  })

  it('makes a filled frame body draggable without pressing an empty frame', () => {
    const empty = resolveSpread(makeBook(), 'spread-1')
    const filled = resolveSpread(makeBookWithAsset(), 'spread-1')
    if (empty === undefined || filled === undefined) {
      throw new Error('expected resolved spreads')
    }

    const { unmount } = render(
      <SpreadView
        spreadId="spread-1"
        resolved={empty}
        previewUrlFor={previewUrlFor}
        frameControlFor={() => ({ label: 'Place photo', onActivate: vi.fn() })}
      />,
    )
    expect(
      document.querySelector('.spread-frame-body')?.getAttribute('draggable'),
    ).toBe('false')
    unmount()

    render(
      <SpreadView
        spreadId="spread-1"
        resolved={filled}
        previewUrlFor={previewUrlFor}
        frameControlFor={() => ({
          label: 'Select photo to move',
          pressed: true,
          onActivate: vi.fn(),
          onDragStart: vi.fn(),
        })}
      />,
    )
    expect(
      document.querySelector('.spread-frame-body')?.getAttribute('draggable'),
    ).toBe('true')
    expect(
      screen
        .getByRole('button', { name: 'Select photo to move' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })
})

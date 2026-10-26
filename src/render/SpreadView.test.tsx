import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveSpread } from '../core'
import { makeBook, makeBookWithAsset } from '../core/testing/fixtures'
import { frameBox, imageCropBox, SPREAD_PX_PER_MM } from './frameBox'
import { SpreadView } from './SpreadView'
import assert from 'node:assert/strict'

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
    assert(resolved !== undefined, 'expected resolved spread')

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
    assert(spread !== undefined && frame !== undefined, 'expected a frame')
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
    assert(
      resolved !== undefined && item?.sourceCropRect !== undefined,
      'expected a cropped item',
    )

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
    expect(frameNode.getAttribute('data-asset-id')).toBe(item.assetId)
    expect(frameNode.style.left).toBe(`${String(box.left)}px`)
    expect(frameNode.style.top).toBe(`${String(box.top)}px`)
    expect(frameNode.style.width).toBe(`${String(box.width)}px`)
    expect(frameNode.style.height).toBe(`${String(box.height)}px`)
  })

  it('keeps a placeholder when the asset has no preview URL', () => {
    const book = makeBook()
    const spread = book.spreads[0]
    const frame = spread?.frames[0]
    assert(spread !== undefined && frame !== undefined, 'expected a frame')
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
    assert(resolved !== undefined, 'expected resolved spread')

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

  it('shows a hatched missing placeholder instead of a stale preview', () => {
    const book = makeBook()
    const spread = book.spreads[0]
    const frame = spread?.frames[0]
    assert(spread !== undefined && frame !== undefined, 'expected a frame')
    const placed = {
      ...book,
      assets: { 'asset-gone': {} },
      gallery: ['asset-gone'],
      spreads: [
        {
          ...spread,
          frames: [{ ...frame, assetId: 'asset-gone' }],
        },
      ],
    }
    const resolved = resolveSpread(placed, 'spread-1')
    assert(resolved !== undefined, 'expected resolved spread')

    render(
      <SpreadView
        spreadId="spread-1"
        resolved={resolved}
        previewUrlFor={() => 'blob:stale'}
        isMissingAsset={(id) => id === 'asset-gone'}
      />,
    )

    expect(screen.getByTestId('spread-frame-missing')).toBeTruthy()
    expect(screen.queryByTestId('spread-frame-image')).toBeNull()
  })

  it('keeps empty-frame placeholder when isMissingAsset is provided', () => {
    const book = makeBook()
    const resolved = resolveSpread(book, 'spread-1')
    assert(resolved !== undefined, 'expected resolved spread')

    render(
      <SpreadView
        spreadId="spread-1"
        resolved={resolved}
        previewUrlFor={() => 'blob:x'}
        isMissingAsset={() => true}
      />,
    )

    expect(screen.getByTestId('spread-frame-placeholder')).toBeTruthy()
    expect(screen.queryByTestId('spread-frame-missing')).toBeNull()
  })

  it('shows the image when the asset is present and not missing', () => {
    const book = makeBook()
    const spread = book.spreads[0]
    const frame = spread?.frames[0]
    assert(spread !== undefined && frame !== undefined, 'expected a frame')
    const placed = {
      ...book,
      assets: { 'asset-ok': {} },
      gallery: ['asset-ok'],
      spreads: [
        {
          ...spread,
          frames: [{ ...frame, assetId: 'asset-ok' }],
        },
      ],
    }
    const resolved = resolveSpread(placed, 'spread-1')
    assert(resolved !== undefined, 'expected resolved spread')

    render(
      <SpreadView
        spreadId="spread-1"
        resolved={resolved}
        previewUrlFor={() => 'blob:ok'}
        isMissingAsset={() => false}
      />,
    )

    expect(screen.getByTestId('spread-frame-image')).toBeTruthy()
    expect(screen.queryByTestId('spread-frame-missing')).toBeNull()
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
    assert(resolved !== undefined, 'expected resolved spread')

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
    assert(spread !== undefined, 'expected spread')
    const resolved = resolveSpread(book, spread.id)
    assert(resolved !== undefined, 'expected resolved spread')
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
    assert(resolved !== undefined, 'expected resolved spread')

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
    assert(resolved !== undefined, 'expected resolved spread')
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
    assert(
      empty !== undefined && filled !== undefined,
      'expected resolved spreads',
    )

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
    expect(screen.queryByTestId('spread-frame-handles')).toBeNull()
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
    const selected = screen.getByRole('button', {
      name: 'Select photo to move',
    })
    expect(selected.getAttribute('aria-pressed')).toBe('true')
    // Ring is CSS ::after inset box-shadow (not inline outline under the photo).
    expect(selected.style.outline).toBe('')
    expect(screen.getAllByTestId('spread-frame-handles')).toHaveLength(1)
    const handles = [
      ...selected.querySelectorAll<HTMLElement>('.spread-frame-handle'),
    ]
    expect(handles).toHaveLength(8)
    expect(handles.map((h) => `${h.style.left} ${h.style.top}`)).toEqual([
      '0% 0%',
      '50% 0%',
      '100% 0%',
      '0% 50%',
      '100% 50%',
      '0% 100%',
      '50% 100%',
      '100% 100%',
    ])
  })
})

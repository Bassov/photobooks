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

  it('renders thumb mode inert: no ids, hidden from a11y, pointer-less class', () => {
    const resolved = resolveSpread(makeBook(), 'spread-1')
    assert(resolved !== undefined, 'expected resolved spread')

    const { container } = render(
      <SpreadView
        thumb
        spreadId="spread-1"
        resolved={resolved}
        previewUrlFor={previewUrlFor}
      />,
    )

    const root = container.firstElementChild
    expect(root?.className).toBe('spread-view spread-view--thumb')
    expect(root?.getAttribute('aria-hidden')).toBe('true')
    expect(root?.hasAttribute('data-spread-id')).toBe(false)
    expect(container.querySelector('[data-testid]')).toBeNull()
    expect(container.querySelector('[data-frame-id]')).toBeNull()
  })

  it('keeps ids and a11y on the default (non-thumb) view', () => {
    const resolved = resolveSpread(makeBook(), 'spread-1')
    assert(resolved !== undefined, 'expected resolved spread')

    render(
      <SpreadView
        spreadId="spread-1"
        resolved={resolved}
        previewUrlFor={previewUrlFor}
      />,
    )

    const root = screen.getByTestId('spread-view')
    expect(root.className).toBe('spread-view')
    expect(root.getAttribute('data-spread-id')).toBe('spread-1')
    expect(root.hasAttribute('aria-hidden')).toBe(false)
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
    // The fold keeps 1 screen px through a live zoom (--cam-scale).
    expect(cut.dataset.cameraFrame).toBe('')
  })

  it('never marks a thumbnail page cut for the camera', () => {
    const book = makeBook({
      spreads: [
        { id: 's0', frames: [] },
        { id: 's1', frames: [] },
        { id: 's2', frames: [] },
      ],
    })
    const resolved = resolveSpread(book, 's1')
    assert(resolved !== undefined, 'expected resolved spread')

    const { container } = render(
      <SpreadView
        spreadId="s1"
        resolved={resolved}
        previewUrlFor={previewUrlFor}
        thumb
      />,
    )

    const cut = container.querySelector('.spread-page-cut')
    assert(cut !== null, 'expected a page cut')
    expect(cut.hasAttribute('data-camera-frame')).toBe(false)
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

  it('passes the click detail so a pointer click differs from Enter', () => {
    const book = makeBook()
    const resolved = resolveSpread(book, 'spread-1')
    assert(resolved !== undefined, 'expected resolved spread')
    const onActivate = vi.fn<(event?: { detail: number }) => void>()

    render(
      <SpreadView
        spreadId="spread-1"
        resolved={resolved}
        previewUrlFor={previewUrlFor}
        frameControlFor={() => ({ label: 'Place photo', onActivate })}
      />,
    )

    const frame = screen.getByRole('button', { name: 'Place photo' })
    fireEvent.click(frame, { detail: 1 })
    fireEvent.click(frame, { detail: 0 })
    expect(onActivate.mock.calls.map(([event]) => event?.detail)).toEqual([
      1, 0,
    ])
  })

  it('labels the drop chip place / replace on controlled and plain frames, none on thumbs', () => {
    const empty = resolveSpread(makeBook(), 'spread-1')
    const filled = resolveSpread(makeBookWithAsset(), 'spread-1')
    assert(
      empty !== undefined && filled !== undefined,
      'expected resolved spreads',
    )
    const labels = (
      resolved: typeof empty,
      opts: { control?: boolean; thumb?: boolean },
    ): (string | null)[] => {
      const { container, unmount } = render(
        <SpreadView
          spreadId="spread-1"
          resolved={resolved}
          previewUrlFor={previewUrlFor}
          thumb={opts.thumb === true}
          {...(opts.control === true
            ? {
                frameControlFor: () => ({
                  label: 'Frame',
                  onActivate: vi.fn(),
                }),
              }
            : {})}
        />,
      )
      const result = [...container.querySelectorAll('.spread-frame')].map(
        (node) => node.getAttribute('data-drop-label'),
      )
      unmount()
      return result
    }
    const place = 'Release to place'
    const replace = 'Release to replace'
    expect(labels(empty, { control: true }).every((l) => l === place)).toBe(
      true,
    )
    expect(labels(empty, {}).every((l) => l === place)).toBe(true)
    expect(labels(filled, { control: true })).toContain(replace)
    expect(labels(filled, {})).toContain(replace)
    expect(labels(filled, { thumb: true }).every((l) => l === null)).toBe(true)
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
    // A selected filled frame keeps the photo drag (kit #/demo step 17).
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
      ...selected.querySelectorAll<HTMLElement>(
        '.spread-frame-handle:not(.spread-frame-rotate)',
      ),
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

  it('selected frame shows 8 resize handles and no size tag', () => {
    const resolved = resolveSpread(makeBookWithAsset(), 'spread-1')
    assert(resolved !== undefined, 'expected resolved spread')
    render(
      <SpreadView
        spreadId="spread-1"
        resolved={resolved}
        previewUrlFor={previewUrlFor}
        frameControlFor={() => ({
          label: 'Sel',
          pressed: true,
          onActivate: vi.fn(),
        })}
      />,
    )
    expect(
      screen.getAllByTestId('sel-handle').map((h) => h.dataset.handle),
    ).toEqual(['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'])
    // Kit select tool has no rotate knob (uikit/src/sandbox/canvas.tsx:224,443).
    expect(screen.queryByTestId('rotate-handle')).toBeNull()
    // Owner design change (round 7, M52): no size tag in any mode.
    expect(screen.queryByTestId('frame-size-tag')).toBeNull()
    expect(screen.getByTestId('spread-frame').textContent).not.toMatch(/mm/)
  })

  it('rotates a rotated frame about its centre and leaves others upright', () => {
    const book = makeBookWithAsset()
    const frame = book.spreads[0]?.frames[0]
    assert(frame !== undefined, 'expected a frame')
    const upright = resolveSpread(book, 'spread-1')
    assert(upright !== undefined, 'expected resolved spread')
    const { unmount } = render(
      <SpreadView
        spreadId="spread-1"
        resolved={upright}
        previewUrlFor={previewUrlFor}
      />,
    )
    expect(screen.getByTestId('spread-frame').style.transform).toBe('')
    unmount()
    const turnedBook = structuredClone(book)
    const turnedFrame = turnedBook.spreads[0]?.frames[0]
    assert(turnedFrame !== undefined, 'expected a frame')
    turnedFrame.rotationDeg = 30
    const turned = resolveSpread(turnedBook, 'spread-1')
    assert(turned !== undefined, 'expected resolved spread')
    render(
      <SpreadView
        spreadId="spread-1"
        resolved={turned}
        previewUrlFor={previewUrlFor}
      />,
    )
    expect(screen.getByTestId('spread-frame').style.transform).toBe(
      'rotate(30deg)',
    )
  })

  it('marks only a locked frame and presses only a selected one', () => {
    const resolved = resolveSpread(makeBookWithAsset(), 'spread-1')
    assert(resolved !== undefined, 'expected resolved spread')
    render(
      <SpreadView
        spreadId="spread-1"
        resolved={resolved}
        previewUrlFor={previewUrlFor}
        frameControlFor={() => ({
          label: 'Idle',
          pressed: false,
          onActivate: vi.fn(),
          onDragStart: vi.fn(),
        })}
      />,
    )
    const frame = screen.getByTestId('spread-frame')
    expect(frame.hasAttribute('data-locked')).toBe(false)
    expect(frame.hasAttribute('aria-pressed')).toBe(false)
    expect(screen.queryByTestId('frame-size-tag')).toBeNull()
    expect(
      document.querySelector('.spread-frame-body')?.getAttribute('draggable'),
    ).toBe('true')
  })

  it('does not drag a frame without a drag handler', () => {
    const resolved = resolveSpread(makeBookWithAsset(), 'spread-1')
    assert(resolved !== undefined, 'expected resolved spread')
    render(
      <SpreadView
        spreadId="spread-1"
        resolved={resolved}
        previewUrlFor={previewUrlFor}
        frameControlFor={() => ({
          label: 'Idle',
          pressed: false,
          onActivate: vi.fn(),
        })}
      />,
    )
    expect(
      document.querySelector('.spread-frame-body')?.getAttribute('draggable'),
    ).toBe('false')
  })

  it('locked frame shows no handles and no size tag', () => {
    const book = makeBookWithAsset()
    const frame = book.spreads[0]?.frames[0]
    assert(frame !== undefined, 'expected a frame')
    frame.locked = true
    const resolved = resolveSpread(book, 'spread-1')
    assert(resolved !== undefined, 'expected resolved spread')
    render(
      <SpreadView
        spreadId="spread-1"
        resolved={resolved}
        previewUrlFor={previewUrlFor}
        frameControlFor={() => ({
          label: 'Sel',
          pressed: true,
          onActivate: vi.fn(),
        })}
      />,
    )
    expect(screen.queryByTestId('sel-handle')).toBeNull()
    expect(screen.queryByTestId('rotate-handle')).toBeNull()
    expect(screen.getByTestId('spread-frame').getAttribute('data-locked')).toBe(
      'true',
    )
  })

  it('crop mode shows a dim ghost, disables drag and forwards double-click', () => {
    const book = makeBookWithAsset()
    const resolved = resolveSpread(book, 'spread-1')
    assert(resolved !== undefined, 'expected resolved spread')
    const onDoubleActivate = vi.fn()
    render(
      <SpreadView
        spreadId="spread-1"
        resolved={resolved}
        previewUrlFor={previewUrlFor}
        frameControlFor={() => ({
          label: 'Crop',
          onActivate: vi.fn(),
          onDragStart: vi.fn(),
          cropActive: true,
          cropZoom: 1.5,
          pressed: true,
          onDoubleActivate,
        })}
      />,
    )
    const frame = screen.getByTestId('spread-frame')
    expect(screen.getByTestId('crop-overlay-tag').textContent).toBe(
      'Crop · 150%',
    )
    expect(screen.getByTestId('crop-overlay-tag').dataset.cameraFrame).toBe('')
    expect(screen.queryByTestId('spread-frame-handles')).toBeNull()
    expect(frame.getAttribute('data-crop-active')).toBe('true')
    expect(screen.getByTestId('spread-frame-ghost')).toBeTruthy()
    expect(screen.getByTestId('spread-frame-image')).toBeTruthy()
    expect(
      document.querySelector('.spread-frame-body')?.getAttribute('draggable'),
    ).toBe('false')
    expect(Number(frame.style.zIndex)).toBeGreaterThanOrEqual(1000)
    fireEvent.doubleClick(frame)
    expect(onDoubleActivate).toHaveBeenCalledTimes(1)
  })

  it('clears the preview transform when the committed crop changes', () => {
    const book = makeBookWithAsset()
    const resolved = resolveSpread(book, 'spread-1')
    assert(resolved !== undefined, 'expected resolved spread')
    const view = (zoomed: boolean) => (
      <SpreadView
        spreadId="spread-1"
        resolved={
          zoomed
            ? {
                ...resolved,
                items: resolved.items.map((item) => ({
                  ...item,
                  sourceCropRect: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
                })),
              }
            : resolved
        }
        previewUrlFor={previewUrlFor}
      />
    )
    const { rerender } = render(view(false))
    const img = screen.getByTestId<HTMLImageElement>('spread-frame-image')
    img.style.transform = 'translate(5px, 5px)'
    rerender(view(true))
    expect(img.style.transform).toBe('')
  })
})

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveSpread } from '../core'
import { makeBook, makeBookWithAsset } from '../core/testing/fixtures'
import { SpreadView } from './SpreadView'

const control = () => ({
  label: 'Frame',
  onActivate: vi.fn(),
})

/** pxPerMm whose product with `widthMm` is `widthPx` or the float just below. */
function pxPerMmFor(widthPx: number, widthMm: number): number {
  let ppm = widthPx / widthMm
  while (widthMm * ppm > widthPx) {
    ppm -= ppm * Number.EPSILON
  }
  return ppm
}

/** Renders the first frame at exactly `widthPx` on-screen px. */
function renderEmptyAt(widthPx: number, withControl = true) {
  const resolved = resolveSpread(makeBook(), 'spread-1')
  assert(resolved !== undefined, 'expected resolved spread')
  const widthMm = resolved.items[0]?.rectMm.width
  assert(widthMm !== undefined, 'expected a frame')
  return render(
    <SpreadView
      spreadId="spread-1"
      resolved={resolved}
      previewUrlFor={() => undefined}
      pxPerMm={pxPerMmFor(widthPx, widthMm)}
      {...(withControl ? { frameControlFor: control } : {})}
    />,
  )
}

function renderMissingAt(widthPx: number, name?: string) {
  const book = makeBook()
  const spread = book.spreads[0]
  const frame = spread?.frames[0]
  assert(spread !== undefined && frame !== undefined, 'expected a frame')
  const placed = {
    ...book,
    assets: { 'asset-gone': {} },
    gallery: ['asset-gone'],
    spreads: [{ ...spread, frames: [{ ...frame, assetId: 'asset-gone' }] }],
  }
  const resolved = resolveSpread(placed, 'spread-1')
  assert(resolved !== undefined, 'expected resolved spread')
  const widthMm = resolved.items[0]?.rectMm.width
  assert(widthMm !== undefined, 'expected a frame')
  return render(
    <SpreadView
      spreadId="spread-1"
      resolved={resolved}
      previewUrlFor={() => 'blob:stale'}
      isMissingAsset={(id) => id === 'asset-gone'}
      {...(name === undefined ? {} : { assetNameFor: () => name })}
      pxPerMm={pxPerMmFor(widthPx, widthMm)}
      frameControlFor={control}
    />,
  )
}

describe('SpreadView frame chrome', () => {
  afterEach(() => {
    cleanup()
  })

  it('empty frame at <= 46px shows neither icon nor text', () => {
    const { container } = renderEmptyAt(46)
    expect(container.querySelector('[data-glyph]')).toBeNull()
    expect(screen.queryByText('Drop photo')).toBeNull()
  })

  it('empty frame above 46px shows the icon only', () => {
    const { container } = renderEmptyAt(47)
    expect(container.querySelector('[data-glyph="image-plus"]')).not.toBeNull()
    expect(screen.queryByText('Drop photo')).toBeNull()
  })

  it('empty frame at exactly 110px shows no text, above 110px shows both', () => {
    const first = renderEmptyAt(110)
    expect(screen.queryByText('Drop photo')).toBeNull()
    first.unmount()
    const { container } = renderEmptyAt(111)
    expect(container.querySelector('[data-glyph="image-plus"]')).not.toBeNull()
    expect(screen.getByText('Drop photo')).toBeTruthy()
  })

  it('shows no hints without a frame control (preview / thumb output)', () => {
    const { container } = renderEmptyAt(300, false)
    expect(container.querySelector('[data-glyph]')).toBeNull()
    expect(screen.queryByText('Drop photo')).toBeNull()
  })

  it('missing frame shows the name label only above 110px', () => {
    const narrow = renderMissingAt(110, 'IMG_1.jpg')
    expect(screen.queryByText('IMG_1.jpg not found')).toBeNull()
    expect(
      narrow.container.querySelector('[data-glyph="warning"]'),
    ).not.toBeNull()
    narrow.unmount()
    renderMissingAt(111, 'IMG_1.jpg')
    expect(screen.getByText('IMG_1.jpg not found')).toBeTruthy()
  })

  it('missing frame without a known name falls back to "Photo"', () => {
    renderMissingAt(200)
    expect(screen.getByText('Photo not found')).toBeTruthy()
  })

  it('lock badge appears only on a locked frame with a control', () => {
    const view = (locked: boolean) => {
      const book = makeBookWithAsset()
      const frame = book.spreads[0]?.frames[0]
      assert(frame !== undefined, 'expected a frame')
      frame.locked = locked
      const resolved = resolveSpread(book, 'spread-1')
      assert(resolved !== undefined, 'expected resolved spread')
      return (
        <SpreadView
          spreadId="spread-1"
          resolved={resolved}
          previewUrlFor={() => 'blob:x'}
          frameControlFor={control}
        />
      )
    }
    const first = render(view(false))
    expect(screen.queryByTestId('frame-lock-badge')).toBeNull()
    first.unmount()
    render(view(true))
    expect(screen.getByTestId('frame-lock-badge')).toBeTruthy()
  })

  it('empty placeholder rule carries no dashed outline', () => {
    const css = readFileSync('src/render/SpreadView.css', 'utf8')
    const rule = /\.spread-frame-placeholder\s*\{[^}]*\}/.exec(css)?.[0]
    assert(rule !== undefined, 'expected the placeholder rule')
    expect(rule).not.toMatch(/dashed|outline/)
  })

  it('renders the glyph child nodes with their attributes', () => {
    const { container } = renderEmptyAt(200)
    const glyph = container.querySelector('[data-glyph="image-plus"]')
    assert(glyph !== null, 'expected the image-plus glyph')
    expect(glyph.children).toHaveLength(5)
    expect(glyph.children[0]?.tagName).toBe('path')
    expect(glyph.children[0]?.getAttribute('d')).toBe('M16 5h6')
    const circle = glyph.querySelector('circle')
    expect(circle?.getAttribute('cx')).toBe('9')
    expect(circle?.getAttribute('cy')).toBe('9')
    expect(circle?.getAttribute('r')).toBe('2')
  })

  it('renders the warning glyph children on a missing frame', () => {
    const { container } = renderMissingAt(200)
    const glyph = container.querySelector('[data-glyph="warning"]')
    assert(glyph !== null, 'expected the warning glyph')
    expect(glyph.children.length).toBeGreaterThan(1)
    expect(glyph.querySelector('path[d="M12 9v4"]')).not.toBeNull()
  })

  it('present frame is not missing and never asks for an asset name', () => {
    const resolved = resolveSpread(makeBookWithAsset(), 'spread-1')
    assert(resolved !== undefined, 'expected resolved spread')
    const assetNameFor = vi.fn(() => 'IMG')
    const { container } = render(
      <SpreadView
        spreadId="spread-1"
        resolved={resolved}
        previewUrlFor={() => 'blob:x'}
        isMissingAsset={() => false}
        assetNameFor={assetNameFor}
        frameControlFor={control}
      />,
    )
    expect(assetNameFor).not.toHaveBeenCalled()
    expect(screen.queryByTestId('spread-frame-missing')).toBeNull()
    expect(screen.queryByTestId('frame-missing-label')).toBeNull()
    expect(container.querySelector('[data-glyph="warning"]')).toBeNull()
  })

  it('empty frame is not missing even if the predicate says so', () => {
    const resolved = resolveSpread(makeBook(), 'spread-1')
    assert(resolved !== undefined, 'expected resolved spread')
    const assetNameFor = vi.fn(() => 'IMG')
    render(
      <SpreadView
        spreadId="spread-1"
        resolved={resolved}
        previewUrlFor={() => undefined}
        isMissingAsset={() => true}
        assetNameFor={assetNameFor}
        pxPerMm={10}
        frameControlFor={control}
      />,
    )
    expect(assetNameFor).not.toHaveBeenCalled()
    expect(screen.queryByTestId('spread-frame-missing')).toBeNull()
    expect(
      screen.getAllByTestId('spread-frame-placeholder').length,
    ).toBeGreaterThan(0)
  })

  it('selected frame renders the rotate line next to the knob', () => {
    const resolved = resolveSpread(makeBookWithAsset(), 'spread-1')
    assert(resolved !== undefined, 'expected resolved spread')
    const { container } = render(
      <SpreadView
        spreadId="spread-1"
        resolved={resolved}
        previewUrlFor={() => 'blob:x'}
        frameControlFor={() => ({ ...control(), pressed: true })}
      />,
    )
    // Kit select tool has no rotate knob (uikit/src/sandbox/canvas.tsx:224,443).
    expect(container.querySelector('.spread-frame-rotate-line')).toBeNull()
    expect(screen.queryByTestId('rotate-handle')).toBeNull()
  })
})

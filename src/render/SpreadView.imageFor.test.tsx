import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveSpread } from '../core'
import { makeBookWithAsset } from '../core/testing/fixtures'
import { SpreadView, type FrameImage } from './SpreadView'
import assert from 'node:assert/strict'

const previewUrlFor = (assetId: string): string | undefined =>
  assetId === 'asset-1' ? 'blob:preview-1' : undefined

const SITE_IMAGE: FrameImage = {
  src: 'a-400.jpg',
  srcset: 'a-400.jpg 400w, a-2000.jpg 2000w',
  sizes: '380px',
  loading: 'lazy',
}

function resolved() {
  const spread = resolveSpread(makeBookWithAsset(), 'spread-1')
  assert(spread !== undefined, 'expected resolved spread')
  return spread
}

function paint(
  imageFor?: (assetId: string, share: number) => FrameImage | undefined,
) {
  return render(
    <SpreadView
      spreadId="spread-1"
      resolved={resolved()}
      previewUrlFor={previewUrlFor}
      {...(imageFor === undefined ? {} : { imageFor })}
    />,
  ).container.innerHTML
}

describe('SpreadView imageFor', () => {
  afterEach(() => {
    cleanup()
  })

  it('paints the srcset source with the frame share of the spread width', () => {
    const spread = resolved()
    const frame = spread.items[0]
    assert(frame !== undefined, 'expected one frame')
    const imageFor = vi.fn(() => SITE_IMAGE)

    paint(imageFor)

    expect(imageFor).toHaveBeenCalledWith(
      'asset-1',
      frame.rectMm.width / spread.spreadWidthMm,
    )
    const img = screen.getByTestId('spread-frame-image')
    expect(img.getAttribute('src')).toBe('a-400.jpg')
    expect(img.getAttribute('srcset')).toBe('a-400.jpg 400w, a-2000.jpg 2000w')
    expect(img.getAttribute('sizes')).toBe('380px')
    expect(img.getAttribute('loading')).toBe('lazy')
  })

  it('leaves loading to the browser when the source sets none', () => {
    paint(() => ({
      src: SITE_IMAGE.src,
      srcset: SITE_IMAGE.srcset,
      sizes: SITE_IMAGE.sizes,
    }))

    const img = screen.getByTestId('spread-frame-image')
    expect(img.hasAttribute('loading')).toBe(false)
    expect(img.getAttribute('srcset')).toBe(SITE_IMAGE.srcset)
  })

  it('keeps today’s DOM without the prop or when it has no source', () => {
    const plain = paint()
    cleanup()
    const fallback = paint(() => undefined)

    expect(fallback).toBe(plain)
    const img = screen.getByTestId('spread-frame-image')
    expect(img.getAttribute('src')).toBe('blob:preview-1')
    expect(img.hasAttribute('srcset')).toBe(false)
    expect(img.hasAttribute('sizes')).toBe(false)
  })

  it('keeps the missing placeholder over a srcset source', () => {
    const imageFor = vi.fn(() => SITE_IMAGE)

    render(
      <SpreadView
        spreadId="spread-1"
        resolved={resolved()}
        previewUrlFor={previewUrlFor}
        imageFor={imageFor}
        isMissingAsset={() => true}
      />,
    )

    expect(imageFor).not.toHaveBeenCalled()
    expect(screen.queryByTestId('spread-frame-image')).toBeNull()
  })
})

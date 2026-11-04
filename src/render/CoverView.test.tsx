import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultCover } from '../core'
import { makeBook } from '../core/testing/fixtures'
import { CoverView } from './CoverView'

function coverBook() {
  const cover = defaultCover('Lake trip')
  return makeBook({
    cover: { ...cover, front: { ...cover.front, assetId: 'a1' } },
  })
}

describe('CoverView', () => {
  afterEach(() => {
    cleanup()
  })

  it('paints the mini cover without editor chrome at the parent width', () => {
    const { container } = render(
      <CoverView book={coverBook()} frontUrl="a1-2000.jpg" frontTier={2048} />,
    )

    const spread = container.querySelector<HTMLElement>('.cover-spread')
    expect(spread?.dataset.mini).toBe('true')
    expect(spread?.style.width).toBe('100%')
    expect(container.querySelector('[data-testid]')).toBeNull()
    expect(container.querySelector('.cover-panel-label')).toBeNull()
    expect(container.querySelector('.cover-wrap-guide')).toBeNull()
    const front = container.querySelector<HTMLElement>('.cover-front')
    expect(front?.style.backgroundImage).toBe('url("a1-2000.jpg")')
    expect(front?.dataset.photoId).toBe('a1')
    expect(front?.dataset.tier).toBe('2048')
    expect(container.querySelector('.cover-spine-text')?.textContent).toBe(
      'Lake trip',
    )
  })

  it('sizes the mini cover to widthPx and leaves an empty front bare', () => {
    const { container } = render(<CoverView book={makeBook()} widthPx={480} />)

    const spread = container.querySelector<HTMLElement>('.cover-spread')
    expect(spread?.style.width).toBe('480px')
    const front = container.querySelector<HTMLElement>('.cover-front')
    expect(front?.style.backgroundImage).toBe('')
    expect(front?.hasAttribute('data-tier')).toBe(false)
  })

  it('adds the editor chrome and drop target with edit', () => {
    const onDragOver = vi.fn()
    const onDrop = vi.fn()

    render(<CoverView book={coverBook()} edit={{ onDragOver, onDrop }} />)

    expect(screen.getByTestId('cover-stage')).toBeTruthy()
    const spread = screen.getByTestId('canvas-cover')
    expect(spread.hasAttribute('data-mini')).toBe(false)
    expect(spread.style.width).not.toBe('100%')
    expect(screen.getByTestId('cover-label-back').textContent).toBe('Back')
    expect(screen.getByTestId('cover-label-spine').textContent).toBe('Spine')
    expect(screen.getByTestId('cover-label-front').textContent).toBe('Front')
    expect(screen.getByTestId('cover-wrap-chip').textContent).toBe('Wrap 15 mm')
    expect(screen.getByTestId('cover-safe').style.inset).not.toBe('')
    const front = screen.getByTestId('cover-front')
    fireEvent.dragOver(front)
    fireEvent.drop(front)
    expect(onDragOver).toHaveBeenCalledTimes(1)
    expect(onDrop).toHaveBeenCalledTimes(1)
  })
})

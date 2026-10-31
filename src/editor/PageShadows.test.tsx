import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PageShadows } from './PageShadows'

describe('PageShadows', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders one shadow box per page rect with its world-px vars', () => {
    render(
      <PageShadows
        originPx={24}
        rects={[
          { spreadId: 's-a', u: 10, v: 0, w: 150, h: 90 },
          { spreadId: 's-b', u: 5.5, v: 120, w: 300, h: 90 },
        ]}
      />,
    )
    const layer = screen.getByTestId('pasteboard-shadows')
    expect(layer.getAttribute('aria-hidden')).toBe('true')
    expect(layer.className).toBe('pasteboard-shadows')
    expect(layer.style.getPropertyValue('--cam-origin')).toBe('24px')

    const boxes = screen.getAllByTestId('pasteboard-page-shadow')
    expect(boxes).toHaveLength(2)
    expect(
      boxes.map((box) => ({
        className: box.className,
        spreadId: box.getAttribute('data-spread-id'),
        u: box.style.getPropertyValue('--u'),
        v: box.style.getPropertyValue('--v'),
        w: box.style.getPropertyValue('--w'),
        h: box.style.getPropertyValue('--h'),
      })),
    ).toEqual([
      {
        className: 'pasteboard-page-shadow',
        spreadId: 's-a',
        u: '10px',
        v: '0px',
        w: '150px',
        h: '90px',
      },
      {
        className: 'pasteboard-page-shadow',
        spreadId: 's-b',
        u: '5.5px',
        v: '120px',
        w: '300px',
        h: '90px',
      },
    ])
  })

  it('renders an empty layer when no spread is mounted', () => {
    render(<PageShadows originPx={0} rects={[]} />)
    const layer = screen.getByTestId('pasteboard-shadows')
    expect(layer.style.getPropertyValue('--cam-origin')).toBe('0px')
    expect(screen.queryAllByTestId('pasteboard-page-shadow')).toHaveLength(0)
  })
})
